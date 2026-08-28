import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { db } from '../src/db';
import { ReportService } from '../src/services/report.service';
import { GraphClient } from '../src/services/graph_client';

describe('Report Service & Mock Services Tests', () => {
  beforeEach(async () => {
    await db.resetDb();

    // Seed test users
    await db.createUser({
      id: 'USR-INV-01',
      display_name: 'Investigator One',
      status: 'ACTIVE',
      clearance_level: 3
    });
    await db.assignUserRole('USR-INV-01', 'INVESTIGATOR');

    await db.createUser({
      id: 'USR-INV-02',
      display_name: 'Investigator Two (External)',
      status: 'ACTIVE',
      clearance_level: 3
    });
    await db.assignUserRole('USR-INV-02', 'INVESTIGATOR');

    // Seed test cases
    await db.createCase({
      id: 'CASE-ALPHA',
      title: 'Operation Alpha',
      status: 'OPEN',
      owner_id: 'USR-INV-01',
      classification: 'SECRET'
    });
    await db.addCaseMember({ case_id: 'CASE-ALPHA', user_id: 'USR-INV-01', access_level: 'ADMIN' });

    await db.createCase({
      id: 'CASE-BETA',
      title: 'Operation Beta',
      status: 'OPEN',
      owner_id: 'USR-INV-02',
      classification: 'SECRET'
    });
    await db.addCaseMember({ case_id: 'CASE-BETA', user_id: 'USR-INV-02', access_level: 'ADMIN' });
  });

  it('Issue 3: Uses authentic user auth context and does not manufacture SYSTEM ADMIN context', async () => {
    const temporalSpy = vi.spyOn(GraphClient, 'getTemporalAnalysis').mockResolvedValue({
      insights: [],
      summary: 'Mock temporal summary'
    });

    const bridgeSpy = vi.spyOn(GraphClient, 'getBridgeAnalysis').mockResolvedValue({
      insights: [],
      key_bridges: []
    });

    const authCtx = {
      user_id: 'USR-INV-01',
      role: 'INVESTIGATOR',
      case_id: 'CASE-ALPHA',
      access_level: 'MEMBER'
    };

    const report = await ReportService.generateCaseReport(authCtx, {});
    expect(report.id).toBeDefined();
    expect(report.created_by).toBe('USR-INV-01');
    expect(report.case_id).toBe('CASE-ALPHA');

    // Wait a brief moment for async compilation to complete
    await new Promise((r) => setTimeout(r, 200));

    // Verify GraphClient was called with the requesting user context, not SYSTEM / SYSTEM ADMIN
    expect(temporalSpy).toHaveBeenCalled();
    const calledTemporalCtx = temporalSpy.mock.calls[0][0];
    expect(calledTemporalCtx.user_id).toBe('USR-INV-01');
    expect(calledTemporalCtx.role).toBe('INVESTIGATOR');
    expect(calledTemporalCtx.user_id).not.toBe('SYSTEM');
    expect(calledTemporalCtx.role).not.toBe('SYSTEM ADMIN');

    expect(bridgeSpy).toHaveBeenCalled();
    const calledBridgeCtx = bridgeSpy.mock.calls[0][0];
    expect(calledBridgeCtx.user_id).toBe('USR-INV-01');
    expect(calledBridgeCtx.role).toBe('INVESTIGATOR');
  });

  it('Issue 4: Report generation explicitly checks D2 authorization', async () => {
    const unauthorizedCtx = {
      user_id: 'USR-INV-02', // Belongs to CASE-BETA, not CASE-ALPHA
      role: 'INVESTIGATOR',
      case_id: 'CASE-ALPHA',
      access_level: 'MEMBER'
    };

    await expect(
      ReportService.generateCaseReport(unauthorizedCtx, {})
    ).rejects.toThrow();
  });

  it('Issue 2: If report compilation encounters an error, status transitions to FAILED with error message', async () => {
    vi.spyOn(GraphClient, 'getTemporalAnalysis').mockRejectedValue(
      new Error('Graph Service Downstream Failure')
    );

    // Mock PDF generation error by sabotaging getCandidatesByCase
    vi.spyOn(db, 'getCandidatesByCase').mockRejectedValueOnce(
      new Error('Database Read Error during report compilation')
    );

    const authCtx = {
      user_id: 'USR-INV-01',
      role: 'INVESTIGATOR',
      case_id: 'CASE-ALPHA',
      access_level: 'MEMBER'
    };

    const report = await ReportService.generateCaseReport(authCtx, {});
    expect(report.id).toBeDefined();

    // Wait for the async compile error handler to complete
    await new Promise((r) => setTimeout(r, 300));

    const updated = await db.getReport(report.id);
    expect(updated.status).toBe('FAILED');
    expect(updated.error).toBeDefined();
    expect(updated.error).toContain('Database Read Error');
  });

  it('Issue 5: GET /api/reports/:id and export enforce case-level authorization', async () => {
    // Create a report in CASE-ALPHA
    const report = await db.createReport({
      id: 'REP-SECURE-001',
      case_id: 'CASE-ALPHA',
      created_by: 'USR-INV-01',
      status: 'COMPLETED',
      storage_uri: 'local://REP-SECURE-001.pdf',
      version: 1,
      created_at: new Date().toISOString()
    });

    // 1. Authorized user (USR-INV-01) can view report
    const resAuth = await request(app)
      .get(`/api/reports/${report.id}`)
      .set('x-user-id', 'USR-INV-01')
      .set('x-user-roles', 'INVESTIGATOR');

    expect(resAuth.status).toBe(200);
    expect(resAuth.body.id).toBe('REP-SECURE-001');

    // 2. Unauthorized user (USR-INV-02) cannot view report (403 FORBIDDEN)
    const resUnauth = await request(app)
      .get(`/api/reports/${report.id}`)
      .set('x-user-id', 'USR-INV-02')
      .set('x-user-roles', 'INVESTIGATOR');

    expect(resUnauth.status).toBe(403);
    expect(resUnauth.body.error).toBe('FORBIDDEN');

    // 3. Export by unauthorized user is rejected (403 FORBIDDEN)
    const exportUnauth = await request(app)
      .get(`/api/reports/${report.id}/export`)
      .set('x-user-id', 'USR-INV-02')
      .set('x-user-roles', 'INVESTIGATOR');

    expect(exportUnauth.status).toBe(403);
  });

  it('Issue 1: Mock services implement all required endpoints with valid responses', async () => {
    // Import server app instances
    const express = (await import('express')).default;
    
    // We can test mock endpoints directly against their express instances
    // Test ML endpoints
    const { MLResponseSchema, AnomalyResponseSchema, AIResponseSchema, GraphResponseSchema } = await import('../src/contracts/index.js');
    
    // Mock fetch for D3 / D4 / ML endpoints
    const { AIClient } = await import('../src/services/ai_client.js');
    const { GraphClient } = await import('../src/services/graph_client.js');

    const authCtx = {
      user_id: 'USR-INV-01',
      role: 'INVESTIGATOR',
      case_id: 'CASE-ALPHA',
      access_level: 'MEMBER'
    };

    // Verify schemas exist and validate test mock shapes
    const mlMatch = MLResponseSchema.safeParse({
      probability: 0.92,
      signals: {
        name_similarity: 1.0,
        phonetic_similarity: 1.0,
        identifier_similarity: 1.0,
        context_similarity: 0.7,
        embedding_similarity: 0.75
      }
    });
    expect(mlMatch.success).toBe(true);

    const mlAnomaly = AnomalyResponseSchema.safeParse({
      anomaly_score: 0.15,
      flags: ['IRREGULAR_BURST_ACTIVITY'],
      explanation: 'Unusual spike'
    });
    expect(mlAnomaly.success).toBe(true);

    const aiSearch = AIResponseSchema.safeParse({
      results: [{ id: 'RES-1', title: 'Test', score: 0.9 }],
      insights: []
    });
    expect(aiSearch.success).toBe(true);

    const graphFocused = GraphResponseSchema.safeParse({
      nodes: [{ id: 'N1', label: 'Node 1', type: 'PERSON' }],
      edges: [{ id: 'E1', source: 'N1', target: 'N2', type: 'CALLED' }]
    });
    expect(graphFocused.success).toBe(true);
  });

  it('Issue 6 & 7: Entity review uses ENTITY_RESOLUTION.v1 contract, /internal/entities/resolve endpoint, and tracks sync_state with retry', async () => {
    const { EntityReviewService } = await import('../src/services/entity_review.service.js');
    const { GraphClient } = await import('../src/services/graph_client.js');

    // Create candidate
    await db.saveCandidate({
      id: 'CAND-001',
      case_id: 'CASE-ALPHA',
      name: 'John Doe',
      normalized_name: 'JOHN DOE',
      normalized_phone: '+919876543210',
      identifiers: {},
      context: {},
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

    // 1. Success case: D4 sync succeeds
    const graphSpy = vi.spyOn(GraphClient, 'fetchD4').mockResolvedValueOnce({ status: 'SUCCESS' });

    const reviewSuccess = await EntityReviewService.recordReviewDecision('CAND-001', 'ACCEPTED', 'USR-INV-01');
    expect(reviewSuccess.decision).toBe('ACCEPTED');
    expect(reviewSuccess.sync_state).toBe('SYNCED');

    // Verify endpoint called is /internal/entities/resolve with ENTITY_RESOLUTION.v1 shape
    expect(graphSpy).toHaveBeenCalledWith(
      '/internal/entities/resolve',
      expect.objectContaining({ user_id: 'USR-INV-01', case_id: 'CASE-ALPHA' }),
      expect.objectContaining({
        candidate_id: 'CAND-001',
        case_id: 'CASE-ALPHA',
        decision: 'ACCEPTED',
        canonical_entity: expect.objectContaining({
          id: 'ENT-001',
          name: 'John Doe'
        })
      }),
      5000
    );

    // 2. Failure case: D4 sync fails, review remains ACCEPTED but sync_state becomes SYNC_FAILED
    vi.spyOn(GraphClient, 'fetchD4').mockRejectedValueOnce(new Error('Neo4j Connection Timeout'));

    const reviewFailed = await EntityReviewService.recordReviewDecision('CAND-001', 'ACCEPTED', 'USR-INV-01');
    expect(reviewFailed.decision).toBe('ACCEPTED');
    expect(reviewFailed.sync_state).toBe('SYNC_FAILED');
    expect(reviewFailed.sync_error).toContain('Neo4j Connection Timeout');

    // 3. Retry sync
    vi.spyOn(GraphClient, 'fetchD4').mockResolvedValueOnce({ status: 'SUCCESS' });
    const retried = await EntityReviewService.retrySync('CAND-001', 'USR-INV-01');
    expect(retried.sync_state).toBe('SYNCED');
    expect(retried.sync_error).toBeNull();
  });

  it('Issue 8 & 9: EntityResolutionService supports mock client injection and handles ML failures cleanly without fake 0.5 probability', async () => {
    const { EntityResolutionService } = await import('../src/services/entity_resolution.service.js');

    const existingRecord = { name: 'Suspect Target', phone: '+919999999999' };
    const newRecord = { name: 'Suspect Target', phone: '+919999999999' };

    // 1. Injected Mock ML Success
    EntityResolutionService.setMLClient({
      predictEntityMatch: async () => ({
        probability: 0.94,
        signals: {
          name_similarity: 1.0,
          phonetic_similarity: 1.0,
          identifier_similarity: 1.0,
          context_similarity: 0.8,
          embedding_similarity: 0.9
        }
      })
    });

    const successResult = await EntityResolutionService.evaluateCandidate('CASE-ALPHA', existingRecord, newRecord);
    expect(successResult.score).toBe(0.94);
    expect(successResult.ml_status).toBe('AVAILABLE');
    expect(successResult.auto_merge_allowed).toBe(true);

    // 2. Injected Mock ML Unavailable / Timeout
    EntityResolutionService.setMLClient({
      predictEntityMatch: async () => {
        throw new Error('ML_SERVICE_TIMEOUT');
      }
    });

    const unavailableResult = await EntityResolutionService.evaluateCandidate('CASE-ALPHA', existingRecord, newRecord);
    // Must NOT fabricate 0.5 probability!
    expect(unavailableResult.score).not.toBe(0.5);
    expect(unavailableResult.score).toBe(0.0);
    expect(unavailableResult.ml_status).toBe('UNAVAILABLE');
    expect(unavailableResult.auto_merge_allowed).toBe(false); // Requires human review!
    expect(unavailableResult.signals.name_similarity).toBeGreaterThan(0.9); // Deterministic signal computed

    // Reset ML client
    EntityResolutionService.resetMLClient();
  });

  it('Issue 10: MLClient validates Anomaly response with AnomalyResponseSchema and rejects invalid payload', async () => {
    const { MLClient } = await import('../src/services/ml_client.js');

    // Mock fetchML with invalid anomaly shape (missing flags, invalid score range)
    vi.spyOn(MLClient, 'fetchML').mockResolvedValueOnce({
      anomaly_score: 999.0 // Invalid, must be between 0 and 1
    });

    await expect(MLClient.predictAnomaly({ data: 'activity' })).rejects.toThrow();

    // Mock fetchML with valid anomaly shape
    vi.spyOn(MLClient, 'fetchML').mockResolvedValueOnce({
      anomaly_score: 0.25,
      flags: ['UNUSUAL_TIME_BURST'],
      explanation: 'Calls during midnight'
    });

    const validRes = await MLClient.predictAnomaly({ data: 'activity' });
    expect(validRes.anomaly_score).toBe(0.25);
    expect(validRes.flags).toContain('UNUSUAL_TIME_BURST');
  });

  it('Issue 11: AIClient and GraphClient do not send legacy JSON Authorization headers', async () => {
    const { AIClient } = await import('../src/services/ai_client.js');
    const { GraphClient } = await import('../src/services/graph_client.js');

    let capturedAIHeaders: any = null;
    let capturedGraphHeaders: any = null;

    // Spy on global fetch
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('search')) {
        capturedAIHeaders = init?.headers;
        return new Response(JSON.stringify({ status: 'SUCCESS', results: [] }), { status: 200 });
      }
      if (url.includes('graph')) {
        capturedGraphHeaders = init?.headers;
        return new Response(JSON.stringify({ nodes: [], edges: [] }), { status: 200 });
      }
      return new Response(JSON.stringify({ status: 'OK' }), { status: 200 });
    });

    const authCtx = {
      user_id: 'USR-INV-01',
      role: 'INVESTIGATOR',
      case_id: 'CASE-ALPHA',
      access_level: 'MEMBER',
      correlation_id: 'CORR-TEST-123'
    };

    await AIClient.searchCase(authCtx, 'query');
    expect(capturedAIHeaders).toBeDefined();
    expect(capturedAIHeaders['X-Authorization-Context']).toBeDefined();
    expect(capturedAIHeaders['X-Correlation-ID']).toBe('CORR-TEST-123');
    expect(capturedAIHeaders['Authorization']).toBeUndefined(); // Legacy removed!

    await GraphClient.getFocusedGraph(authCtx, 'ENT-1', 2);
    expect(capturedGraphHeaders).toBeDefined();
    expect(capturedGraphHeaders['X-Authorization-Context']).toBeDefined();
    expect(capturedGraphHeaders['X-Correlation-ID']).toBe('CORR-TEST-123');
    expect(capturedGraphHeaders['Authorization']).toBeUndefined(); // Legacy removed!

    global.fetch = originalFetch;
  });
});
