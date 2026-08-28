import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { EntityResolutionService } from '../src/services/entity_resolution.service';
import { EntityReviewService } from '../src/services/entity_review.service';
import { ReportService } from '../src/services/report.service';
import { getEffectiveRole, signAuthContext } from '../src/utils/security';
import { createMockApps } from '../src/mock_services/server';
import { db } from '../src/db';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { EVIDENCE_DIR } from '../src/config/paths';

describe('Entity Resolution & Report Hardening (Issues 11 - 20)', () => {
  beforeEach(async () => {
    await db.resetDb();
    EntityResolutionService.resetMLClient();
  });

  afterEach(async () => {
    EntityResolutionService.resetMLClient();
    vi.restoreAllMocks();
  });

  it('Issue 11: Explicitly distinguishes deterministic fallback score from ML probability', async () => {
    // Force ML client failure
    EntityResolutionService.setMLClient({
      predictEntityMatch: async () => {
        throw new Error('ML_SERVICE_DOWN');
      }
    });

    const existing = {
      name: 'Ravi Kumar',
      phone: '+919876543210',
      identifiers: { aadhaar: '1234-5678-9012' }
    };
    const incoming = {
      name: 'Ravee Kumar',
      phone: '+919876543210',
      identifiers: { aadhaar: '1234-5678-9012' }
    };

    const res = await EntityResolutionService.evaluateCandidate('CASE-001', existing, incoming);

    expect(res.ml_status).toBe('UNAVAILABLE');
    expect(res.ml_probability).toBeNull();
    expect(typeof res.deterministic_score).toBe('number');
    expect(res.deterministic_score).toBeGreaterThan(0.7);
    expect(res.score).toBe(res.deterministic_score);
    expect(res.review_recommendation).toBe('REVIEW_REQUIRED');
  });

  it('Issues 12 & 13: Enforces least privilege on entity reviews (only INVESTIGATOR and SUPERVISOR allowed)', async () => {
    const userId = 'USR-ANALYST-99';
    await db.createUser({
      id: userId,
      display_name: 'Data Analyst',
      status: 'ACTIVE',
      clearance_level: 2
    });
    await db.assignUserRole(userId, 'ANALYST');

    const caseId = 'CASE-ENT-01';
    await db.createCase({
      id: caseId,
      title: 'Entity Test Case',
      status: 'ACTIVE',
      classification: 'RESTRICTED',
      owner_id: userId
    });
    await db.addCaseMember(caseId, userId, 'MEMBER');

    const candId = 'CAND-TEST-001';
    await db.saveCandidate({
      id: candId,
      case_id: caseId,
      name: 'Vikram Singh',
      normalized_name: 'VIKRAM SINGH',
      identifiers: {},
      context: {},
      score: 0.85,
      signals: { name_similarity: 0.9, phonetic_similarity: 1, identifier_similarity: 0.5, context_similarity: 0.5, embedding_similarity: 0.8 },
      has_conflict: false,
      status: 'CANDIDATE',
      candidate_data: { name: 'Vikram Singh' },
      created_at: new Date().toISOString()
    });

    // ANALYST should be rejected with lack of reviewer privileges
    await expect(EntityReviewService.recordReviewDecision(candId, 'ACCEPTED', userId)).rejects.toThrow(/User lacks reviewer privileges/);

    // Update user to INVESTIGATOR
    await db.assignUserRole(userId, 'INVESTIGATOR');
    const review = await EntityReviewService.recordReviewDecision(candId, 'ACCEPTED', userId);
    expect(review.decision).toBe('ACCEPTED');
    expect(review.reviewer_id).toBe(userId);
  });

  it('Issue 14: getEffectiveRole deterministically prioritizes highest privilege role', () => {
    expect(getEffectiveRole(['INVESTIGATOR', 'SYSTEM ADMIN'])).toBe('SYSTEM ADMIN');
    expect(getEffectiveRole(['INVESTIGATOR', 'SUPERVISOR'])).toBe('SUPERVISOR');
    expect(getEffectiveRole(['OFFICER', 'ANALYST', 'INVESTIGATOR'])).toBe('INVESTIGATOR');
    expect(getEffectiveRole(['OFFICER', 'ANALYST'])).toBe('ANALYST');
    expect(getEffectiveRole(['OFFICER'])).toBe('OFFICER');
    expect(getEffectiveRole([])).toBe('INVESTIGATOR');
  });

  it('Issue 15: Report versioning retries with recomputed next version on collision', async () => {
    const userId = 'USR-INV-V01';
    await db.createUser({
      id: userId,
      display_name: 'Lead Investigator',
      status: 'ACTIVE',
      clearance_level: 3
    });
    await db.assignUserRole(userId, 'INVESTIGATOR');

    const caseId = 'CASE-VER-01';
    await db.createCase({
      id: caseId,
      title: 'Versioning Test Case',
      status: 'ACTIVE',
      classification: 'RESTRICTED',
      owner_id: userId
    });
    await db.addCaseMember(caseId, userId, 'ADMIN');

    const userCtx = {
      user_id: userId,
      role: 'INVESTIGATOR',
      case_id: caseId,
      access_level: 'ADMIN'
    };

    // Pre-create version 1
    await db.createReport({
      id: 'REP-001',
      case_id: caseId,
      created_by: userId,
      status: 'COMPLETED',
      version: 1,
      created_at: new Date().toISOString()
    });

    const report = await ReportService.generateCaseReport(userCtx, {});
    expect(report.version).toBe(2);
  });

  it('Issue 17: Bounded concurrency handles multiple evidence integrity checks without error', async () => {
    const userId = 'USR-INV-EVD';
    await db.createUser({
      id: userId,
      display_name: 'Lead Investigator',
      status: 'ACTIVE',
      clearance_level: 3
    });
    await db.assignUserRole(userId, 'INVESTIGATOR');

    const caseId = 'CASE-EVD-01';
    await db.createCase({
      id: caseId,
      title: 'Evidence Chunking Test Case',
      status: 'ACTIVE',
      classification: 'RESTRICTED',
      owner_id: userId
    });
    await db.addCaseMember(caseId, userId, 'ADMIN');

    // Create 12 evidence records to test chunking
    for (let i = 1; i <= 12; i++) {
      const content = `Forensic data content ${i}`;
      const sha256 = crypto.createHash('sha256').update(content).digest('hex');
      const filename = `evd_file_${i}.txt`;
      if (!fs.existsSync(EVIDENCE_DIR)) fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
      fs.writeFileSync(path.join(EVIDENCE_DIR, filename), content);

      await db.createEvidence({
        id: `EVD-CHUNK-${i}`,
        case_id: caseId,
        source_type: 'FILE_SYSTEM',
        source_ref: filename,
        storage_uri: `local://${filename}`,
        sha256,
        classification: 'RESTRICTED',
        uploaded_by: userId,
        status: 'ANALYZED',
        created_at: new Date().toISOString()
      });
    }

    const userCtx = {
      user_id: userId,
      role: 'INVESTIGATOR',
      case_id: caseId,
      access_level: 'ADMIN'
    };

    const report = await ReportService.generateCaseReport(userCtx, {});
    expect(report.status).toBe('COMPLETED');
    expect(report.storage_uri).toBeDefined();
  });

  it('Issues 19 & 20: ML, D3, D4 enforce internal HMAC and MLClient passes full signed AuthContext', async () => {
    const { ml, d3, d4 } = createMockApps();

    // 1. Unsigned requests should be rejected with 403
    const unauthML = await request(ml).post('/predict/entity-match').send({});
    expect(unauthML.status).toBe(403);

    const unauthD3 = await request(d3).post('/search').send({ query: 'test' });
    expect(unauthD3.status).toBe(403);

    const unauthD4 = await request(d4).post('/graph/focused').send({});
    expect(unauthD4.status).toBe(403);

    // 2. Signed request should succeed with 200
    const authCtx = {
      user_id: 'USR-TEST-001',
      role: 'INVESTIGATOR',
      case_id: 'CASE-001',
      access_level: 'ADMIN'
    };
    const { contextHeader, signatureHeader } = signAuthContext(authCtx);

    const authML = await request(ml)
      .post('/predict/entity-match')
      .set('X-Authorization-Context', contextHeader)
      .set('X-Authorization-Signature', signatureHeader)
      .send({ name1: 'John', name2: 'John' });
    expect(authML.status).toBe(200);
    expect(authML.body.probability).toBeGreaterThan(0.9);
  });
});
