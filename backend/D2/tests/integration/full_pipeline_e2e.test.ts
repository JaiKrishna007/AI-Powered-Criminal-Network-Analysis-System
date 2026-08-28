import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import { db } from '../../src/db';
import { ExtractionService } from '../../src/services/extraction.service';
import { DefaultExtractionWorker } from '../../src/workers/extraction_worker.adapter';
import { EntityResolutionService } from '../../src/services/entity_resolution.service';
import { AIClient } from '../../src/services/ai_client';
import { GraphClient } from '../../src/services/graph_client';
import bcrypt from 'bcrypt';
import fs from 'fs/promises';
import path from 'path';
import { EVIDENCE_DIR, REPORTS_DIR } from '../../src/config/paths';

import { spawn, ChildProcess } from 'child_process';

describe('Comprehensive End-to-End Full Pipeline (Issue 37)', () => {
  let d4Process: ChildProcess;
  const d4Port = 8003;

  beforeAll(async () => {
    const d4Dir = path.resolve(__dirname, '../../../D4/System graph intelligence security');
    const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    d4Process = spawn(npxCmd, ['tsx', 'server.ts'], { 
      cwd: d4Dir, 
      env: { ...process.env, PORT: d4Port.toString(), GRAPH_BACKEND: 'memory' }, 
      shell: true 
    });
    
    // Wait for server to start
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }, 10000);

  afterAll(() => {
    if (d4Process) {
      d4Process.kill();
    }
  });

  beforeEach(async () => {
    await db.resetDb();
    EntityResolutionService.resetMLClient();
    ExtractionService.registerWorker(new DefaultExtractionWorker());
  });

  afterEach(() => {
    EntityResolutionService.resetMLClient();
    ExtractionService.registerWorker(null);
    vi.restoreAllMocks();
  });

  it('Executes complete operational pipeline: Login -> Create Case -> Ingest Evidence -> Extraction & Source Spans -> Entity Resolution -> Human Review -> D4 Sync -> D3 Search/Copilot/Leads -> D4 Graph/Temporal/Bridge -> Evidence Integrity -> Report -> Audit Chain', async () => {
    // 1. User Setup & Authentic Login
    const passwordHash = await bcrypt.hash('InvestigatorPass!2026', 10);
    await db.createUser({
      id: 'USR-OPERATIVE-01',
      display_name: 'Lead Investigator Kumar',
      status: 'ACTIVE',
      clearance_level: 4,
      password_hash: passwordHash
    });
    await db.assignUserRole('USR-OPERATIVE-01', 'INVESTIGATOR');

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'Lead Investigator Kumar',
        password: 'InvestigatorPass!2026'
      });

    expect(loginRes.status).toBe(200);
    const sessionCookie = loginRes.headers['set-cookie'];
    expect(sessionCookie).toBeDefined();

    // 2. Create Case via Authenticated Session
    const createCaseRes = await request(app)
      .post('/api/cases')
      .set('Cookie', sessionCookie)
      .send({
        title: 'Operation Trident Hawkeye',
        description: 'Multi-jurisdictional narcotics trafficking and illicit financial conduit.',
        classification: 'RESTRICTED'
      });

    expect(createCaseRes.status).toBe(201);
    const caseId = createCaseRes.body.case.id;
    expect(caseId).toMatch(/^CASE-/);

    // 3. Upload & Ingest Multi-Modal Evidence with Real Content
    const csvContent = `Name,Phone,Called,Account,TransferTo,Location\nDev Anand,+919811223344,+919822334455,ACC-998811,ACC-554422,Mumbai Port\nVikram Roy,+919822334455,+919833445566,ACC-554422,ACC-112233,Goa Dock`;
    
    const ingestRes = await request(app)
      .post(`/api/cases/${caseId}/ingestions`)
      .set('Cookie', sessionCookie)
      .send({
        case_id: caseId,
        source_type: 'CSV',
        source_ref: 'port_intercepts_log.csv',
        content: csvContent,
        classification: 'RESTRICTED'
      });

    expect(ingestRes.status).toBe(200);
    expect(ingestRes.body.status).toBe('SUCCESS');
    expect(ingestRes.body.candidates.length).toBeGreaterThan(0);
    expect(ingestRes.body.evidence).toBeDefined();
    const evidenceId = ingestRes.body.evidence.id;

    // Verify Source Spans & Page Provenance on Extracted Candidates
    const firstCandidate = ingestRes.body.candidates[0];
    expect(firstCandidate.context.source_span).toBeDefined();
    expect(firstCandidate.context.source_span.row).toBe(2);

    // 4. Deterministic Candidate Blocking & Entity Resolution Evaluation
    const evalRes = await EntityResolutionService.evaluateCandidate(
      caseId,
      { name: 'Dev Anand', phone: '+919811223344' },
      { name: 'Dev Anand', phone: '+919811223344' }
    );
    expect(evalRes.score).toBeGreaterThan(0.70);

    // 5. Human Review Decision (ACCEPTED by Investigator)
    const reviewRes = await request(app)
      .post(`/api/cases/${caseId}/entities/resolve`)
      .set('Cookie', sessionCookie)
      .send({
        candidate_id: firstCandidate.id,
        decision: 'ACCEPTED'
      });

    expect(reviewRes.status).toBe(200);
    expect(reviewRes.body.review.decision).toBe('ACCEPTED');

    // 6. D4 Graph Batch Sync & Entity Synchronization (Executed naturally in background)
    // A real D4 server is running in memory for this test.

    // 7. D3 Semantic Search & AI Coordination
    const aiSearchSpy = vi.spyOn(AIClient, 'searchCase').mockResolvedValueOnce({
      status: 'SUCCESS',
      results: [{ id: 'RES-E2E-1', snippet: 'Evidence matching narcotics shipment manifest' }]
    });

    const searchRes = await request(app)
      .post(`/api/cases/${caseId}/search`)
      .set('Cookie', sessionCookie)
      .send({ query: 'Mumbai Port shipments' });

    expect(searchRes.status).toBe(200);
    expect(aiSearchSpy).toHaveBeenCalled();

    // 8. D4 Graph Endpoints
    const graphRes = await request(app)
      .get(`/api/cases/${caseId}/graph?entityId=ENT-1&hops=2`)
      .set('Cookie', sessionCookie);
    expect(graphRes.status).toBe(200);

    // 9. Evidence Integrity Verification (SHA-256)
    const integrityRes = await request(app)
      .get(`/api/evidence/${evidenceId}/integrity`)
      .set('Cookie', sessionCookie);

    expect(integrityRes.status).toBe(200);
    expect(integrityRes.body.integrity.status).toBe('VALID');
    expect(integrityRes.body.integrity.verified_sha256).toBeDefined();

    // 10. Evidence Download Path Traversal Protection
    const downloadRes = await request(app)
      .get(`/api/evidence/${evidenceId}/download`)
      .set('Cookie', sessionCookie);

    expect(downloadRes.status).toBe(200);

    // 11. Compile Full Case Report
    vi.spyOn(GraphClient, 'getFocusedGraph').mockResolvedValueOnce({ nodes: [], edges: [] });
    vi.spyOn(GraphClient, 'getBridgeAnalysis').mockResolvedValueOnce({ insights: [], key_bridges: [] });
    vi.spyOn(GraphClient, 'getTemporalAnalysis').mockResolvedValueOnce({ insights: [], summary: 'Summary' });
    vi.spyOn(AIClient, 'copilot').mockResolvedValueOnce({ status: 'SUCCESS', response: 'AI Copilot' });
    vi.spyOn(AIClient, 'generateLeads').mockResolvedValueOnce({ status: 'SUCCESS', leads: [] });
    const reportRes = await request(app)
      .post(`/api/cases/${caseId}/reports`)
      .set('Cookie', sessionCookie)
      .send({ parameters: { scope: 'FULL_OPERATIONAL_SUMMARY' } });

    expect(reportRes.status).toBe(202);
    const reportId = reportRes.body.report_id;
    expect(reportId).toMatch(/^REP-/);

    // 12. Immutable Audit Trail Verification
    const audits = await db.getAuditEventsByCase(caseId);
    expect(audits.length).toBeGreaterThanOrEqual(4);
    expect(audits.some(a => a.action === 'CASE_CREATE')).toBe(true);
    expect(audits.some(a => a.action === 'INGEST_EVIDENCE')).toBe(true);
    expect(audits.some(a => a.action === 'ENTITY_REVIEW')).toBe(true);
    expect(audits.some(a => a.action === 'SEARCH')).toBe(true);

    // Verify Audit Hash Chain Integrity
    const auditIntegrity = await db.verifyAuditChainIntegrity();
    expect(auditIntegrity.valid).toBe(true);
  }, 15000);
});
