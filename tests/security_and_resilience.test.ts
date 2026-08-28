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
  });
});
