import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import { db } from '../../src/db';
import { ExtractionService, IExtractionWorker } from '../../src/services/extraction.service';
import { AIClient } from '../../src/services/ai_client';
import { GraphClient } from '../../src/services/graph_client';
import fs from 'fs/promises';

describe('E2E Case 1042 Simulation', () => {
  beforeEach(async () => {
    await db.resetDb();
    
    // Custom test extraction worker for deterministic E2E flow
    const e2eWorker: IExtractionWorker = {
      async extract(sourceType: string, content: string | Buffer) {
        return {
          raw_text: content.toString(),
          records: [
            { name: 'John Doe', phone: '+1-555-0100', type: 'PERSON' },
            { name: 'Jane Smith', phone: '+1-555-0200', type: 'PERSON' }
          ],
          relationships: [
            { source_name: 'John Doe', target_name: '+1-555-0100', type: 'USED' }
          ],
          events: [],
          source_spans: []
        };
      }
    };
    ExtractionService.registerWorker(e2eWorker);

    // Seed investigator user and case
    await db.createUser({ id: 'USR-E2E', display_name: 'E2E Investigator', status: 'ACTIVE', clearance_level: 3, password_hash: '' });
    await db.assignUserRole('USR-E2E', 'INVESTIGATOR');
    
    await db.createCase({
      id: 'CASE-1042',
      title: 'Operation Blue Falcon',
      description: 'Suspected illicit financial network across transit corridors.',
      status: 'ACTIVE',
      owner_id: 'USR-E2E',
      classification: 'RESTRICTED'
    });
  });

  it('Automates full workflow: upload -> ingestion -> resolution -> graph search -> report generation', async () => {
    // 1. Evidence Ingestion
    const ingestRes = await request(app)
      .post('/api/cases/CASE-1042/ingestions')
      .set('x-user-id', 'USR-E2E')
      .set('x-user-roles', 'INVESTIGATOR')
      .send({
        case_id: 'CASE-1042',
        source_type: 'JSON',
        source_ref: 'intel_report.json',
        content: JSON.stringify({ notes: 'Intercepted comms between suspect cell members' })
      });
      
    expect(ingestRes.status).toBe(200);
    expect(ingestRes.body.status).toBe('SUCCESS');
    expect(ingestRes.body.candidates.length).toBeGreaterThan(0);
    const candidateId = ingestRes.body.candidates[0].id;
    expect(candidateId).toBeDefined();

    // 2. Entity Review Resolution (Officer accepts candidate)
    const reviewRes = await request(app)
      .post('/api/cases/CASE-1042/entities/resolve')
      .set('x-user-id', 'USR-E2E')
      .set('x-user-roles', 'INVESTIGATOR')
      .send({
        candidate_id: candidateId,
        decision: 'ACCEPTED'
      });
      
    expect(reviewRes.status).toBe(200);
    expect(reviewRes.body.review.decision).toBe('ACCEPTED');
    expect(reviewRes.body.review.candidate_id).toBe(candidateId);

    // 3. AI Search Coordination
    const aiSearchSpy = vi.spyOn(AIClient, 'searchCase').mockResolvedValueOnce({
      status: 'SUCCESS',
      results: [{ id: 'RES-1', snippet: 'Comms trace matches John Doe' }]
    });

    const searchRes = await request(app)
      .post('/api/cases/CASE-1042/search')
      .set('x-user-id', 'USR-E2E')
      .set('x-user-roles', 'INVESTIGATOR')
      .send({ query: 'John Doe' });

    expect(searchRes.status).toBe(200);
    expect(aiSearchSpy).toHaveBeenCalled();

    // 4. Graph Coordination Query
    const graphSpy = vi.spyOn(GraphClient, 'getFocusedGraph').mockResolvedValueOnce({
      nodes: [{ id: 'ENT-1', label: 'John Doe', type: 'PERSON' }],
      edges: []
    });

    const graphRes = await request(app)
      .get('/api/cases/CASE-1042/graph?entityId=ENT-1&hops=2')
      .set('x-user-id', 'USR-E2E')
      .set('x-user-roles', 'INVESTIGATOR');

    expect(graphRes.status).toBe(200);
    expect(graphSpy).toHaveBeenCalled();

    // 5. Case Report Generation
    const reportRes = await request(app)
      .post('/api/cases/CASE-1042/reports')
      .set('x-user-id', 'USR-E2E')
      .set('x-user-roles', 'INVESTIGATOR')
      .send({ parameters: { notes: 'Finalized operational brief' } });

    expect(reportRes.status).toBe(202);
    expect(reportRes.body.report_id).toMatch(/^REP-/);
    
    // 6. Audit Trail Verification
    const audits = await db.getAllAuditEvents();
    expect(audits.some(a => a.action === 'INGEST_EVIDENCE')).toBe(true);
    expect(audits.some(a => a.action === 'ENTITY_REVIEW')).toBe(true);
    expect(audits.some(a => a.action === 'SEARCH')).toBe(true);
    expect(audits.some(a => a.action === 'GRAPH_ACCESS')).toBe(true);
    expect(audits.some(a => a.action === 'REPORT_GENERATION')).toBe(true);
    
    // Clean up created test artifact
    try {
      const evidence = ingestRes.body.evidence;
      const fileName = evidence.storage_uri.replace('local://', '');
      const { EVIDENCE_DIR } = await import('../../src/config/paths');
      const filePath = require('path').resolve(EVIDENCE_DIR, fileName);
      await fs.unlink(filePath);
    } catch(e) {}
  });
});
