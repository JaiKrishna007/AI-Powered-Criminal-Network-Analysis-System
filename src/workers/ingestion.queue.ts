import { Queue, Worker } from 'bullmq';
import { db } from '../db';
import { ExtractionService } from '../services/extraction.service';
import { EntityResolutionService } from '../services/entity_resolution.service';
import { NormalizationService } from '../services/normalization.service';
import { EvidenceService } from '../services/evidence.service';
import { EntityCandidate } from '../models/types';
import fs from 'fs';
import path from 'path';

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379')
};

export const ingestionQueue = new Queue('ingestionQueue', { connection });

// Initialize the worker only if we are not in testing mode (or we explicitly want to test workers)
// For unit tests, we'll process jobs synchronously or mock the queue
export const startIngestionWorker = () => {
  const worker = new Worker('ingestionQueue', async (jobData) => {
    const { jobId, caseId, normalizedType, evidenceId, storageUri } = jobData.data;

    await db.updateIngestionJobState(jobId, 'PROCESSING');

    try {
      const fileName = storageUri.replace('local://', '');
      const filePath = path.resolve(__dirname, '../../../data/evidence', fileName);
      const contentBuffer = await fs.promises.readFile(filePath);

      // Extract
      const extractionResult = await ExtractionService.processExtractionWorker(normalizedType, contentBuffer);
      const existingCandidates = await db.getCandidatesByCase(caseId);
      const candidatesExtracted: EntityCandidate[] = [];

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
          embedding_similarity: 0
        };
        let hasConflict = false;

        for (const existing of existingCandidates) {
          const evalRes = await EntityResolutionService.evaluateCandidate(caseId, existing, rec);
          if (evalRes.score > bestScore) {
            bestScore = evalRes.score;
            highestSignals = evalRes.signals;
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
          }
          if (evalRes.has_conflict) {
            hasConflict = true;
            otherRec.has_conflict = true;
          }
        }

        const candId = `CAND-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const candidate: EntityCandidate = {
          id: candId,
          case_id: caseId,
          name: rec.name,
          normalized_name: normName.normalized,
          original_phone: normPhone?.original || null,
          normalized_phone: normPhone?.normalized || null,
          identifiers: rec.identifiers || {},
          context: rec.context || {},
          score: bestScore,
          signals: highestSignals,
          has_conflict: hasConflict,
          status: 'CANDIDATE',
          candidate_data: rec,
          created_at: new Date().toISOString()
        };

        await db.saveCandidate(candidate);
        candidatesExtracted.push(candidate);
      }

      await db.updateIngestionJobState(jobId, 'COMPLETED');
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
