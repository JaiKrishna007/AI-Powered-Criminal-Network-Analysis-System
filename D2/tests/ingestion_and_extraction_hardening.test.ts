import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EntityResolutionService } from '../src/services/entity_resolution.service';
import { IngestionService } from '../src/services/ingestion.service';
import { DefaultExtractionWorker } from '../src/workers/extraction_worker.adapter';
import { ExtractionService } from '../src/services/extraction.service';
import { GraphClient } from '../src/services/graph_client';
import { db } from '../src/db';

describe('Ingestion, Extraction & Graph Sync Hardening (Issues 21 - 30)', () => {
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

  it('Issue 21: Candidate blocking stage skips ML calls for completely non-matching records', async () => {
    const mlMock = vi.fn().mockResolvedValue({ probability: 0.95 });
    EntityResolutionService.setMLClient({
      predictEntityMatch: mlMock
    });

    const rec1 = { name: 'Alice Smith', phone: '+1111111111', identifiers: { passport: 'A123' } };
    const rec2 = { name: 'Zack Taylor', phone: '+9999999999', identifiers: { passport: 'Z999' } };

    const res = await EntityResolutionService.evaluateCandidate('CASE-001', rec1, rec2);

    // Should NOT call ML service because they differ completely
    expect(mlMock).not.toHaveBeenCalled();
    expect(res.review_recommendation).toBe('NO_MATCH');
    expect(res.score).toBeLessThan(0.35);

    // Matching candidate should trigger ML
    const rec3 = { name: 'Alice Smyth', phone: '+1111111111' };
    await EntityResolutionService.evaluateCandidate('CASE-001', rec1, rec3);
    expect(mlMock).toHaveBeenCalledTimes(1);
  });

  it('Issues 23, 24, 25: Records GRAPH_SYNC_FAILED warning when D4 relationship sync fails', async () => {
    // Mock GraphClient.fetchD4 to simulate D4 failure
    vi.spyOn(GraphClient, 'fetchD4').mockRejectedValue(new Error('D4_UNAVAILABLE'));

    const textContent = 'Name: Rajesh Sharma\nPhone: +919876543210\nCalled: +919876543211';
    const result = await IngestionService.processIngestion({
      case_id: 'CASE-ING-01',
      source_type: 'TEXT',
      source_ref: 'transcript_01.txt',
      content: textContent,
      classification: 'RESTRICTED'
    });

    expect(result.job.state).toBe('COMPLETED');
    expect(result.job.warnings).toContain('GRAPH_SYNC_FAILED');
    expect(result.job.graph_sync).toBe('FAILED');
  });

  it('Issues 26, 27, 28: Validates relationships, maps candidate IDs, and attaches evidence IDs', async () => {
    let capturedPayload: any = null;
    vi.spyOn(GraphClient, 'fetchD4').mockImplementation(async (_ep, _ctx, payload) => {
      capturedPayload = payload;
      return { status: 'SUCCESS' };
    });

    const textContent = 'Name: Suresh Raina\nPhone: +919876543210\nCalled: +919876543299';
    const result = await IngestionService.processIngestion({
      case_id: 'CASE-ING-02',
      source_type: 'TEXT',
      source_ref: 'call_log.txt',
      content: textContent,
      classification: 'RESTRICTED',
      userContext: { user_id: 'USR-TEST', role: 'INVESTIGATOR', case_id: 'CASE-ING-02', access_level: 'MEMBER' }
    });

    expect(result.job.state).toBe('COMPLETED');
    expect(result.job.graph_sync).toBe('SYNCED');
    expect(capturedPayload).toBeDefined();
    expect(capturedPayload.relationships.length).toBeGreaterThan(0);

    const rel = capturedPayload.relationships[0];
    expect(rel.id).toMatch(/^REL-/);
    expect(rel.source_id).toMatch(/^CAND-/);
    expect(rel.evidence_ids).toContain(result.evidence?.id);
    expect(rel.properties.provenance.evidence_id).toBe(result.evidence?.id);
  });

  it('Issues 29 & 30: PDF and CSV extractors attach accurate source spans and row/col provenance', async () => {
    const worker = new DefaultExtractionWorker();

    // 1. Text/PDF extraction provenance
    const textData = 'Suspect: John Doe\nDialed: +919876543210';
    const textRes = await worker.extract('TEXT', textData);
    expect(textRes.records.length).toBeGreaterThan(0);
    expect(textRes.records[0].source_span).toBeDefined();
    expect(textRes.records[0].source_span?.start).toBeDefined();
    expect(textRes.records[0].source_span?.end).toBeDefined();
    expect(textRes.records[0].page).toBe(1);

    // 2. CSV extraction provenance
    const csvData = 'Name,Phone,Called\nVikram Singh,+919876543210,+919876543299';
    const csvRes = await worker.extract('CSV', csvData);
    expect(csvRes.records.length).toBeGreaterThan(0);
    expect(csvRes.records[0].source_span?.row).toBe(2);
    expect(csvRes.records[0].source_span?.column).toBe('Name');
  });
});
