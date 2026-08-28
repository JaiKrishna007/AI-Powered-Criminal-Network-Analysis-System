import { Queue, Worker } from 'bullmq';
import { db } from '../db';
import { ExtractionService } from '../services/extraction.service';
import { EntityResolutionService } from '../services/entity_resolution.service';
import { NormalizationService } from '../services/normalization.service';
import { EvidenceService } from '../services/evidence.service';
import { EntityCandidate } from '../models/types';
import fs from 'fs';
import path from 'path';
import { EVIDENCE_DIR } from '../config/paths';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const Redis = require('ioredis');
let connection: any;
try {
  connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
  connection.on('error', (err: any) => {
    console.warn(`Redis connection error in IngestionQueue: ${err.message}`);
  });
} catch (e: any) {
  console.warn(`Redis initialization error in IngestionQueue: ${e.message}`);
}

export const ingestionQueue = new Queue('ingestionQueue', { connection });

// Initialize the worker only if we are not in testing mode (or we explicitly want to test workers)
// For unit tests, we'll process jobs synchronously or mock the queue
export const startIngestionWorker = () => {
  const worker = new Worker('ingestionQueue', async (jobData) => {
    const { jobId, caseId, normalizedType, evidenceId, storageUri } = jobData.data;

    await db.updateIngestionJobState(jobId, 'PROCESSING');

    try {
      const fileName = storageUri.replace('local://', '');
      const filePath = path.resolve(EVIDENCE_DIR, fileName);
      const contentBuffer = await fs.promises.readFile(filePath);

      // Extract
      const extractionResult = await ExtractionService.processExtractionWorker(normalizedType, contentBuffer);
      const existingCandidates = await db.getCandidatesByCase(caseId);
      const candidatesExtracted: EntityCandidate[] = [];

      const nameToCandidateId = new Map<string, string>();

      for (const rec of extractionResult.records) {
        const normDate = rec.context?.date ? NormalizationService.normalizeDate(rec.context.date) : undefined;
        const normPhone = rec.phone ? NormalizationService.normalizePhone(rec.phone) : undefined;
        const normName = NormalizationService.normalizeIdentifier(rec.name);

        let bestScore = 0;
        let highestSignals = {
          name_similarity: 0,
          phonetic_similarity: 0,
          identifier_similarity: 0,
          context_similarity: 0,
          lexical_similarity: 0
        };
        let hasConflict = false;
        let candidateMLStatus: 'AVAILABLE' | 'UNAVAILABLE' = 'AVAILABLE';
        let candidateMLProbability: number | null = null;
        let candidateDeterministicScore = 0;
        let candidateReviewRecommendation: string = 'REVIEW_REQUIRED';

        for (const existing of existingCandidates) {
          const evalRes = await EntityResolutionService.evaluateCandidate(caseId, existing, rec);
          if (evalRes.score > bestScore) {
            bestScore = evalRes.score;
            highestSignals = evalRes.signals;
            candidateMLStatus = evalRes.ml_status;
            candidateMLProbability = evalRes.ml_probability;
            candidateDeterministicScore = evalRes.deterministic_score;
            candidateReviewRecommendation = evalRes.review_recommendation || 'REVIEW_REQUIRED';
          }
          if (evalRes.has_conflict) {
            hasConflict = true;
          }
        }

        for (const otherRec of candidatesExtracted) {
          const evalRes = await EntityResolutionService.evaluateCandidate(caseId, otherRec, rec);
          if (evalRes.score > bestScore) {
            bestScore = evalRes.score;
            highestSignals = evalRes.signals;
            candidateMLStatus = evalRes.ml_status;
            candidateMLProbability = evalRes.ml_probability;
            candidateDeterministicScore = evalRes.deterministic_score;
            candidateReviewRecommendation = evalRes.review_recommendation || 'REVIEW_REQUIRED';
          }
          if (evalRes.has_conflict) {
            hasConflict = true;
            otherRec.has_conflict = true;
          }
        }

        const candId = `CAND-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        nameToCandidateId.set(rec.name.toLowerCase().trim(), candId);
        if (rec.phone) nameToCandidateId.set(rec.phone.trim(), candId);

        const candidate: EntityCandidate = {
          id: candId,
          case_id: caseId,
          name: rec.name,
          normalized_name: normName.normalized,
          original_phone: normPhone?.original || null,
          normalized_phone: normPhone?.normalized || null,
          identifiers: rec.identifiers || {},
          context: {
            ...rec.context,
            page: rec.page || 1,
            source_span: rec.source_span
          },
          score: bestScore,
          deterministic_score: candidateDeterministicScore || bestScore,
          ml_probability: candidateMLProbability,
          ml_status: candidateMLStatus,
          review_recommendation: candidateReviewRecommendation,
          signals: highestSignals,
          has_conflict: hasConflict,
          status: 'CANDIDATE',
          candidate_data: rec,
          created_at: new Date().toISOString()
        };

        await db.saveCandidate(candidate);
        candidatesExtracted.push(candidate);
      }

      // Publish extracted relationships to D4 (Graph Service / Neo4j) with schema validation
      let graphSyncStatus: 'SYNCED' | 'FAILED' | 'SKIPPED' = 'SKIPPED';
      let jobWarnings: string[] | undefined = undefined;

      if (extractionResult.relationships && extractionResult.relationships.length > 0) {
        const { RelationshipSchema } = await import('../contracts/index.js');
        const validatedRelationships: any[] = [];

        for (const rel of extractionResult.relationships) {
          const sourceId = nameToCandidateId.get(rel.source_name.toLowerCase().trim()) || `CAND-${Date.now()}-SRC`;
          const targetId = nameToCandidateId.get(rel.target_name.toLowerCase().trim()) || `CAND-${Date.now()}-TGT`;
          const relId = rel.id || `REL-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

          const structuredRel = {
            id: relId,
            source_id: sourceId,
            target_id: targetId,
            type: rel.type,
            evidence_ids: [evidenceId],
            properties: {
              ...rel.properties,
              source_name: rel.source_name,
              target_name: rel.target_name,
              provenance: {
                evidence_id: evidenceId,
                page: rel.page || 1,
                source_span: rel.source_span
              }
            },
            created_at: new Date().toISOString()
          };

          const parseRes = RelationshipSchema.safeParse(structuredRel);
          if (parseRes.success) {
            validatedRelationships.push(parseRes.data);
          } else {
            console.warn('Worker rejected invalid relationship schema:', parseRes.error);
          }
        }

        if (validatedRelationships.length > 0) {
          try {
            const { getEffectiveRole } = await import('../utils/security.js');
            const member = await db.getCaseMember(caseId, jobData.data.user_id);
            const accessLevel = member?.access_level || (jobData.data.roles?.includes('SYSTEM ADMIN') ? 'ADMIN' : 'INVESTIGATOR');
            const effectiveRole = getEffectiveRole(jobData.data.roles);
            const authCtx = jobData.data.userContext;
            const { GraphClient } = await import('../services/graph_client.js');
            await GraphClient.fetchD4('/relationships/batch', authCtx, {
              case_id: caseId,
              evidence_id: evidenceId,
              relationships: validatedRelationships
            }, 5000);
            graphSyncStatus = 'SYNCED';
          } catch (err: any) {
            console.warn(`Failed to publish extracted relationships to D4: ${err.message}`);
            graphSyncStatus = 'FAILED';
            jobWarnings = ['GRAPH_SYNC_FAILED'];
          }
        }
      }

      await db.updateIngestionJobState(jobId, 'COMPLETED', null, jobWarnings, graphSyncStatus);
    } catch (error: any) {
      await db.updateIngestionJobState(jobId, 'FAILED', error.message);
      throw error; // Let BullMQ handle retries
    }
  }, { connection });

  worker.on('failed', (job, err) => {
    if (job) {
      console.error(`Job ${job.id} failed with error: ${err.message}`);
    }
  });

  return worker;
};
