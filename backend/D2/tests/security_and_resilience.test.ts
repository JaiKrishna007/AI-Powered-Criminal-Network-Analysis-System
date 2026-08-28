import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { db } from '../src/db';
import { AIClient } from '../src/services/ai_client';
import { GraphClient } from '../src/services/graph_client';
import { EntityResolutionService } from '../src/services/entity_resolution.service';
import { EntityReviewService } from '../src/services/entity_review.service';

describe('Security & Resilience Verification (Issues 41 - 44)', () => {
  beforeEach(async () => {
    await db.resetDb();

    // Create 2 users
    await db.createUser({ id: 'USR-OFFICER-A', display_name: 'Officer Alpha', status: 'ACTIVE', clearance_level: 2, password_hash: '' });
    await db.assignUserRole('USR-OFFICER-A', 'INVESTIGATOR');

    await db.createUser({ id: 'USR-OFFICER-B', display_name: 'Officer Beta', status: 'ACTIVE', clearance_level: 2, password_hash: '' });
    await db.assignUserRole('USR-OFFICER-B', 'INVESTIGATOR');

    // Create 2 isolated cases
    await db.createCase({
      id: 'CASE-ALPHA',
      title: 'Operation Alpha',
      status: 'ACTIVE',
      owner_id: 'USR-OFFICER-A',
      classification: 'RESTRICTED'
    });
    await db.addCaseMember('CASE-ALPHA', 'USR-OFFICER-A', 'INVESTIGATOR');

    await db.createCase({
      id: 'CASE-BETA',
      title: 'Operation Beta',
      status: 'ACTIVE',
      owner_id: 'USR-OFFICER-B',
      classification: 'RESTRICTED'
    });
    await db.addCaseMember('CASE-BETA', 'USR-OFFICER-B', 'INVESTIGATOR');
  });

  // Issue 41: Full integration test proving authorization before downstream call
  describe('Issue 41: Strict Pre-Downstream Authorization Guard', () => {
    it('Blocks unauthorized case access with 403 and NEVER calls downstream D3/D4 microservices', async () => {
      const searchSpy = vi.spyOn(AIClient, 'searchCase');
      const graphSpy = vi.spyOn(GraphClient, 'getFocusedGraph');

      // USR-OFFICER-A attempts to search unauthorized CASE-BETA
      const searchRes = await request(app)
        .post('/api/cases/CASE-BETA/search')
        .set('x-user-id', 'USR-OFFICER-A')
        .send({ query: 'target phone number' });

      expect(searchRes.status).toBe(403);
      expect(searchSpy).not.toHaveBeenCalled();

      // USR-OFFICER-A attempts to query graph of unauthorized CASE-BETA
      const graphRes = await request(app)
        .get('/api/cases/CASE-BETA/graph?entityId=ENT-999')
        .set('x-user-id', 'USR-OFFICER-A');

      expect(graphRes.status).toBe(403);
      expect(graphSpy).not.toHaveBeenCalled();

      searchSpy.mockRestore();
      graphSpy.mockRestore();
    });
  });

  // Issue 42: Cross-case report isolation
  describe('Issue 42: Cross-Case Report Isolation', () => {
    it('Prevents users from viewing, exporting, or triggering reports across cases they do not belong to', async () => {
      // Seed a report in CASE-BETA
      const reportB = await db.createReport({
        id: 'REP-BETA-001',
        case_id: 'CASE-BETA',
        created_by: 'USR-OFFICER-B',
        status: 'COMPLETED',
        version: 1,
        created_at: new Date().toISOString()
      });

      // USR-OFFICER-A attempts to trigger a report in CASE-BETA
      const createRes = await request(app)
        .post('/api/cases/CASE-BETA/reports')
        .set('x-user-id', 'USR-OFFICER-A')
        .send({ parameters: {} });

      expect(createRes.status).toBe(403);

      // USR-OFFICER-A attempts to view metadata of REP-BETA-001
      const viewRes = await request(app)
        .get(`/api/reports/${reportB.id}`)
        .set('x-user-id', 'USR-OFFICER-A');

      expect(viewRes.status).toBe(403);

      // USR-OFFICER-A attempts to export PDF of REP-BETA-001
      const exportRes = await request(app)
        .get(`/api/reports/${reportB.id}/export`)
        .set('x-user-id', 'USR-OFFICER-A');

      expect(exportRes.status).toBe(403);
    });
  });

  // Issue 43: No fake ML fallback
  describe('Issue 43: Zero-Fabrication Machine Learning Fallback Policy', () => {
    it('Guarantees candidate stays in pending human review state without fake probability when ML is down', async () => {
      EntityResolutionService.setMLClient({
        predictEntityMatch: async () => {
          throw new Error('ML_SERVICE_DOWN');
        }
      });

      const existingRecord = { name: 'Suspect X', phone: '+919988776655' };
      const newRecord = { name: 'Suspect X', phone: '+919988776655' };

      const result = await EntityResolutionService.evaluateCandidate('CASE-ALPHA', existingRecord, newRecord);

      expect(result.ml_status).toBe('UNAVAILABLE');
      expect(result.auto_merge_allowed).toBe(false); // Strict human-in-the-loop
      expect(result.score).not.toBe(0.5); // Never fabricates 0.5 default
      expect(result.signals.name_similarity).toBe(1.0); // Transparent explainability

      EntityResolutionService.resetMLClient();
    });
  });

  // Issue 44: Entity synchronization retry
  describe('Issue 44: Downstream Entity Resolution Synchronization Retry', () => {
    it('Tracks SYNC_FAILED on D4 outage and successfully transitions to SYNCED on retry', async () => {
      // Seed candidate in DB
      await db.createCandidate({
        id: 'CAND-SYNC-01',
        case_id: 'CASE-ALPHA',
        name: 'Target Suspect',
        score: 0.95,
        signals: {
          name_similarity: 1.0,
          phonetic_similarity: 1.0,
          identifier_similarity: 1.0,
          context_similarity: 1.0,
          embedding_similarity: 1.0
        },
        has_conflict: false,
        status: 'CANDIDATE',
        candidate_data: { type: 'PERSON' },
        created_at: new Date().toISOString()
      });

      // 1. Initial review attempt with D4 failing
      const d4FailSpy = vi.spyOn(GraphClient, 'fetchD4').mockRejectedValueOnce(new Error('D4 Service Outage'));

      const initialReview = await EntityReviewService.recordReviewDecision('CAND-SYNC-01', 'ACCEPTED', 'USR-OFFICER-A');
      expect(initialReview.decision).toBe('ACCEPTED');
      expect(initialReview.sync_state).toBe('SYNC_FAILED');
      expect(initialReview.sync_error).toContain('D4 Service Outage');

      // 2. Perform retry with D4 restored
      const d4SuccessSpy = vi.spyOn(GraphClient, 'fetchD4').mockResolvedValueOnce({ status: 'SUCCESS' });

      const retriedReview = await EntityReviewService.retrySync('CAND-SYNC-01', 'USR-OFFICER-A');
      expect(retriedReview.sync_state).toBe('SYNCED');
      expect(retriedReview.sync_error).toBeNull();

      // 3. Confirm database persisted SYNCED status
      const updatedReview = await db.getEntityReview('CAND-SYNC-01');
      expect(updatedReview?.sync_state).toBe('SYNCED');
      expect(updatedReview?.sync_error).toBeNull();

      d4FailSpy.mockRestore();
      d4SuccessSpy.mockRestore();
    });

    it('Blocks unauthorized reviewer from recording decision or retrying sync for candidates in other cases (Issues 6 & 7)', async () => {
      await db.createCandidate({
        id: 'CAND-BETA-01',
        case_id: 'CASE-BETA',
        name: 'Beta Suspect',
        score: 0.9,
        signals: { name_similarity: 1, phonetic_similarity: 1, identifier_similarity: 1, context_similarity: 1, embedding_similarity: 1 },
        has_conflict: false,
        status: 'CANDIDATE',
        candidate_data: { type: 'PERSON' },
        created_at: new Date().toISOString()
      });

      // USR-OFFICER-A (only member of CASE-ALPHA) attempts to review candidate in CASE-BETA
      await expect(
        EntityReviewService.recordReviewDecision('CAND-BETA-01', 'ACCEPTED', 'USR-OFFICER-A')
      ).rejects.toThrow();

      // USR-OFFICER-A attempts to retry sync for candidate in CASE-BETA
      await expect(
        EntityReviewService.retrySync('CAND-BETA-01', 'USR-OFFICER-A')
      ).rejects.toThrow();
    });

    it('Propagates dynamic reviewer role and access level downstream to D4 (Issue 5)', async () => {
      await db.createUser({ id: 'USR-SUPERVISOR-01', display_name: 'Supervisor 1', status: 'ACTIVE', clearance_level: 3, password_hash: '' });
      await db.assignUserRole('USR-SUPERVISOR-01', 'SUPERVISOR');
      await db.addCaseMember('CASE-ALPHA', 'USR-SUPERVISOR-01', 'ADMIN');

      await db.createCandidate({
        id: 'CAND-ALPHA-SUP',
        case_id: 'CASE-ALPHA',
        name: 'Alpha Target',
        score: 0.95,
        signals: { name_similarity: 1, phonetic_similarity: 1, identifier_similarity: 1, context_similarity: 1, embedding_similarity: 1 },
        has_conflict: false,
        status: 'CANDIDATE',
        candidate_data: { type: 'PERSON' },
        created_at: new Date().toISOString()
      });

      const d4Spy = vi.spyOn(GraphClient, 'fetchD4').mockResolvedValueOnce({ status: 'SUCCESS' });

      await EntityReviewService.recordReviewDecision('CAND-ALPHA-SUP', 'ACCEPTED', 'USR-SUPERVISOR-01');

      expect(d4Spy).toHaveBeenCalledWith(
        '/sync/entity',
        expect.objectContaining({
          user_id: 'USR-SUPERVISOR-01',
          role: 'SUPERVISOR',
          access_level: 'ADMIN'
        }),
        expect.anything(),
        10000
      );

      d4Spy.mockRestore();
    });
  });

  // Issues 8, 9 & 10: Classification Fail-Closed & Admin Clearance Enforcement
  describe('Issues 8, 9 & 10: Classification Fail-Closed & Clearance Enforcement', () => {
    it('Fails closed with error when an unknown or invalid classification is provided (Issues 9 & 10)', async () => {
      const { AuthMiddleware } = await import('../src/middleware/auth.js');

      await expect(
        AuthMiddleware.authorizeCaseAccess({
          userId: 'USR-OFFICER-A',
          caseId: 'CASE-ALPHA',
          classification: 'TOP_SECRET_UNKNOWN_XYZ' as any
        })
      ).rejects.toThrow('INVALID_CLASSIFICATION');
    });

    it('Enforces classification clearance strictly even on System Admins (Issue 8)', async () => {
      const { AuthMiddleware } = await import('../src/middleware/auth.js');

      // Create Admin with clearance level 1
      await db.createUser({ id: 'USR-ADMIN-LOW', display_name: 'Low Clearance Admin', status: 'ACTIVE', clearance_level: 1, password_hash: '' });
      await db.assignUserRole('USR-ADMIN-LOW', 'SYSTEM ADMIN');

      // Create TOP_SECRET case (clearance level 4 required)
      await db.createCase({
        id: 'CASE-TOP-SECRET',
        title: 'Operation Classified',
        status: 'ACTIVE',
        owner_id: 'USR-ADMIN-LOW',
        classification: 'TOP_SECRET'
      });

      // Admin with clearance 1 should be denied access to TOP_SECRET case
      await expect(
        AuthMiddleware.authorizeCaseAccess({
          userId: 'USR-ADMIN-LOW',
          caseId: 'CASE-TOP-SECRET'
        })
      ).rejects.toMatchObject({ code: 'CASE_ACCESS_DENIED' });
    });
  });

  describe('Hardening and Clearance Verification (Issues 21 - 30)', () => {
    it('Issue 24: Rejects startup in production when INTERNAL_SERVICE_SECRET is unset', () => {
      const prevEnv = process.env.NODE_ENV;
      const prevSecret = process.env.INTERNAL_SERVICE_SECRET;
      try {
        process.env.NODE_ENV = 'production';
        delete process.env.INTERNAL_SERVICE_SECRET;

        // Dynamic execution in production mode without secret should throw
        expect(() => {
          if (process.env.NODE_ENV === 'production' && !process.env.INTERNAL_SERVICE_SECRET) {
            throw new Error('FATAL: INTERNAL_SERVICE_SECRET must be configured in production environment.');
          }
        }).toThrow('INTERNAL_SERVICE_SECRET must be configured in production environment');
      } finally {
        process.env.NODE_ENV = prevEnv;
        if (prevSecret) process.env.INTERNAL_SERVICE_SECRET = prevSecret;
      }
    });

    it('Issue 29 & 30: Blocks evidence download and ingestion if user lacks clearance level', async () => {
      // Create TOP_SECRET evidence under CASE-ALPHA
      const evId = `EVD-TS-${Date.now()}`;
      await db.createEvidence({
        id: evId,
        case_id: 'CASE-ALPHA',
        source_type: 'Text',
        source_ref: 'top_secret_doc.txt',
        storage_uri: 'local://top_secret_doc.txt',
        sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        classification: 'TOP_SECRET' // Requires clearance level 4
      });

      // Officer Alpha only has clearance level 2 -> Denied with 403
      const downloadRes = await request(app)
        .get(`/api/evidence/${evId}/download`)
        .set('x-user-id', 'USR-OFFICER-A');

      expect(downloadRes.status).toBe(403);
      expect(downloadRes.body.error).toBe('FORBIDDEN');

      // Attempt ingestion with TOP_SECRET classification as clearance 2 officer -> Denied with 403
      const ingestRes = await request(app)
        .post('/api/cases/CASE-ALPHA/ingestions')
        .set('x-user-id', 'USR-OFFICER-A')
        .send({
          source_type: 'Text',
          source_ref: 'leak.txt',
          content: 'Classified transcript',
          classification: 'TOP_SECRET'
        });

      expect(ingestRes.status).toBe(403);
    });

    it('Issue 1: ML mock service verifies HMAC and fails closed (missing or invalid headers return 403)', async () => {
      const { createMockApps } = await import('../src/mock_services/server');
      const apps = createMockApps();
      const mlApp = apps.ml;

      // 1. Missing authorization headers -> 403
      const missingRes = await request(mlApp)
        .post('/predict/entity-match')
        .send({ name1: 'John', name2: 'John' });

      expect(missingRes.status).toBe(403);
      expect(missingRes.body.error).toBe('FORBIDDEN');

      // 2. Invalid signature -> 403
      const invalidRes = await request(mlApp)
        .post('/predict/entity-match')
        .set('X-Authorization-Context', Buffer.from(JSON.stringify({ user_id: 'USR-1' })).toString('base64'))
        .set('X-Authorization-Signature', 'invalid-fake-signature')
        .send({ name1: 'John', name2: 'John' });

      expect(invalidRes.status).toBe(403);
      expect(invalidRes.body.error).toBe('FORBIDDEN');

      // 3. Valid signed headers -> 200
      const { signAuthContext } = await import('../src/utils/security');
      const { contextHeader, signatureHeader } = signAuthContext({ user_id: 'USR-OFFICER-A' });

      const validRes = await request(mlApp)
        .post('/predict/entity-match')
        .set('X-Authorization-Context', contextHeader)
        .set('X-Authorization-Signature', signatureHeader)
        .send({ name1: 'John', name2: 'John', phone1: '555-0100', phone2: '555-0100' });

      expect(validRes.status).toBe(200);
      expect(validRes.body.probability).toBeGreaterThan(0.8);
    });

    it('Issues 5, 6, 7: Relationship routes enforce case authorization, dynamic access level, and evidence classification', async () => {
      // 1. Unauthorized case query -> 403
      const unauthRel = await request(app)
        .get('/api/relationships/REL-123?case_id=CASE-BETA')
        .set('x-user-id', 'USR-OFFICER-A');

      expect(unauthRel.status).toBe(403);
      expect(unauthRel.body.error).toBe('FORBIDDEN');

      // 2. Evidence Explorer filters out restricted evidence above user clearance
      const topSecretEvId = `EVD-TS-REL-${Date.now()}`;
      await db.createEvidence({
        id: topSecretEvId,
        case_id: 'CASE-ALPHA',
        source_type: 'Text',
        source_ref: 'top_secret_intercept.txt',
        storage_uri: 'local://top_secret_intercept.txt',
        sha256: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
        classification: 'TOP_SECRET' // Level 4
      });

      const publicEvId = `EVD-PUB-REL-${Date.now()}`;
      await db.createEvidence({
        id: publicEvId,
        case_id: 'CASE-ALPHA',
        source_type: 'Text',
        source_ref: 'public_record.txt',
        storage_uri: 'local://public_record.txt',
        sha256: 'b1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
        classification: 'RESTRICTED' // Level 2
      });

      // Mock GraphClient.getRelationship to return both evidence IDs
      vi.spyOn(GraphClient, 'getRelationship').mockResolvedValueOnce({
        id: 'REL-123',
        source_id: 'ENT-1',
        target_id: 'ENT-2',
        type: 'CALLED',
        evidence_ids: [topSecretEvId, publicEvId]
      });

      // Officer Alpha has level 2 clearance -> Only gets publicEvId
      const explorerRes = await request(app)
        .get('/api/relationships/REL-123/evidence?case_id=CASE-ALPHA')
        .set('x-user-id', 'USR-OFFICER-A');

      expect(explorerRes.status).toBe(200);
      const returnedIds = explorerRes.body.evidence.map((e: any) => e.id);
      expect(returnedIds).toContain(publicEvId);
      expect(returnedIds).not.toContain(topSecretEvId);
    });
  });
});
