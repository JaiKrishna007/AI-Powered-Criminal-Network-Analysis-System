import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AIClient, AuthContext } from '../src/services/ai_client';
import { GraphClient } from '../src/services/graph_client';
import { MLClient } from '../src/services/ml_client';
import { verifyAuthContext } from '../src/utils/security';
import http from 'http';
import express, { Request, Response } from 'express';

describe('D2 Microservice Contract Verification Tests (D2 -> D3, D2 -> D4, D2 -> ML)', () => {
  let mockServer: http.Server;
  const mockPort = 8999;
  const mockBaseUrl = `http://localhost:${mockPort}`;

  let originalD3: string | undefined;
  let originalD4: string | undefined;
  let originalML: string | undefined;

  beforeAll(async () => {
    originalD3 = process.env.D3_SERVICE_URL;
    originalD4 = process.env.D4_SERVICE_URL;
    originalML = process.env.ML_SERVICE_URL;

    process.env.D3_SERVICE_URL = mockBaseUrl;
    process.env.D4_SERVICE_URL = mockBaseUrl;
    process.env.ML_SERVICE_URL = mockBaseUrl;

    const app = express();
    app.use(express.json());

    // Health
    app.get('/health', (_req: Request, res: Response) => {
      res.status(200).json({ status: 'OK' });
    });

    // --- D3 Endpoints ---
    app.post('/d3/search', (req: Request, res: Response) => {
      const authHeader = req.headers['x-authorization-context'] as string;
      const sigHeader = req.headers['x-authorization-signature'] as string;
      
      if (!authHeader || !sigHeader || !verifyAuthContext(authHeader, sigHeader)) {
        return res.status(403).json({ error: 'UNAUTHORIZED_CONTEXT' });
      }

      const { query, filters } = req.body;
      if (!query) return res.status(400).json({ error: 'QUERY_REQUIRED' });

      return res.status(200).json({
        status: 'SUCCESS',
        results: [
          { id: 'RES-001', score: 0.95, text: `Matched ${query}`, filters: filters || {} }
        ]
      });
    });

    app.post('/d3/copilot', (req: Request, res: Response) => {
      const { query } = req.body;
      return res.status(200).json({
        status: 'SUCCESS',
        response: `Copilot analysis for: ${query}`,
        grounding: ['EVD-101', 'EVD-102']
      });
    });

    app.post('/d3/leads', (_req: Request, res: Response) => {
      return res.status(200).json({
        status: 'SUCCESS',
        leads: [
          { id: 'LEAD-1', priority: 'HIGH', description: 'Investigate target burner phone' }
        ]
      });
    });

    // --- D4 Endpoints ---
    app.post('/d4/graph/focused', (req: Request, res: Response) => {
      const { entityId, hops } = req.body;
      return res.status(200).json({
        nodes: [{ id: entityId || 'ENT-001', label: 'Target Alpha', type: 'PERSON' }],
        edges: []
      });
    });

    app.post('/d4/graph/path', (req: Request, res: Response) => {
      const { sourceId, targetId } = req.body;
      return res.status(200).json({
        nodes: [
          { id: sourceId, label: 'Source', type: 'PERSON' },
          { id: targetId, label: 'Target', type: 'PERSON' }
        ],
        edges: [
          { id: 'EDGE-1', source: sourceId, target: targetId, type: 'ASSOCIATE' }
        ]
      });
    });

    app.post('/d4/analytics/bridge', (_req: Request, res: Response) => {
      return res.status(200).json({
        insights: [{ type: 'BRIDGE', description: 'Broker detected' }],
        key_bridges: [{ entity_id: 'ENT-BRIDGE-1', betweenness_score: 0.89 }]
      });
    });

    app.post('/d4/analytics/temporal', (_req: Request, res: Response) => {
      return res.status(200).json({
        insights: [{ type: 'TEMPORAL', description: 'Night surge activity' }],
        summary: 'Activity concentrated between 01:00 and 04:00 UTC'
      });
    });

    app.post('/d4/internal/entities/resolve', (req: Request, res: Response) => {
      const { candidate_id, case_id, decision, canonical_entity, reviewer_id } = req.body;
      if (!candidate_id || !case_id || !decision || !reviewer_id) {
        return res.status(400).json({ error: 'INVALID_CONTRACT_PAYLOAD' });
      }
      return res.status(200).json({
        status: 'SUCCESS',
        canonical_id: candidate_id,
        synced_at: new Date().toISOString()
      });
    });

    // --- ML Endpoints ---
    app.post('/ml/predict/entity-match', (req: Request, res: Response) => {
      const { existingRecord, newRecord } = req.body;
      if (!existingRecord || !newRecord) return res.status(400).json({ error: 'INVALID_PAIR' });

      return res.status(200).json({
        probability: 0.94,
        signals: {
          name_similarity: 0.98,
          phonetic_similarity: 1.0,
          identifier_similarity: 1.0,
          context_similarity: 0.8,
          embedding_similarity: 0.92
        }
      });
    });

    app.post('/ml/predict/anomaly', (_req: Request, res: Response) => {
      return res.status(200).json({
        anomaly_score: 0.22,
        flags: ['BURST_FREQUENCY'],
        explanation: 'Sudden spike in connection volume'
      });
    });

    // Error simulation routes
    app.post('/d3/error/500', (_req: Request, res: Response) => res.status(500).json({ error: 'D3_INTERNAL_ERROR' }));
    app.post('/d4/error/403', (_req: Request, res: Response) => res.status(403).json({ error: 'D4_FORBIDDEN' }));
    app.post('/ml/malformed', (_req: Request, res: Response) => res.status(200).json({ invalid_field: 123 }));

    await new Promise<void>((resolve) => {
      mockServer = app.listen(mockPort, () => resolve());
    });
  });

  afterAll(async () => {
    if (mockServer) {
      await new Promise<void>((resolve) => mockServer.close(() => resolve()));
    }
    process.env.D3_SERVICE_URL = originalD3;
    process.env.D4_SERVICE_URL = originalD4;
    process.env.ML_SERVICE_URL = originalML;
  });

  const testAuthContext: AuthContext = {
    user_id: 'USR-CONTRACT-TEST',
    role: 'INVESTIGATOR',
    case_id: 'CASE-CONTRACT-100',
    access_level: 'ADMIN',
    correlation_id: 'CORR-TEST-999'
  };

  // 1. D2 -> D3 Contract Verification
  describe('1. D2 -> D3 AI Client Contract', () => {
    it('Verifies D3 /search contract: valid payload, signed context, and structured response', async () => {
      // Temporarily point D3 URL to mock server
      const originalD3 = process.env.D3_SERVICE_URL;
      (AIClient as any).fetchD3Wrapper = AIClient.fetchD3;
      
      const result = await AIClient.fetchD3('/d3/search', testAuthContext, {
        query: 'narcotics syndicate',
        filters: { classification: 'RESTRICTED' }
      }, 5000);

      expect(result).toBeDefined();
      expect(result.status).toBe('SUCCESS');
      expect(result.results[0].score).toBe(0.95);
    });

    it('Verifies D3 /copilot contract', async () => {
      const result = await AIClient.fetchD3('/d3/copilot', testAuthContext, {
        query: 'Identify lead suspect connections'
      }, 5000);

      expect(result.status).toBe('SUCCESS');
      expect(result.response).toContain('Copilot analysis');
      expect(result.grounding).toContain('EVD-101');
    });

    it('Verifies D3 /leads contract', async () => {
      const result = await AIClient.fetchD3('/d3/leads', testAuthContext, {
        request: 'Generate immediate actionable tasks'
      }, 5000);

      expect(result.status).toBe('SUCCESS');
      expect(result.leads.length).toBeGreaterThan(0);
      expect(result.leads[0].priority).toBe('HIGH');
    });

    it('Verifies D3 error mapping for HTTP 500 downstream failures', async () => {
      await expect(
        AIClient.fetchD3('/d3/error/500', testAuthContext, {}, 5000)
      ).rejects.toMatchObject({ code: 'DOWNSTREAM_FAILURE' });
    });
  });

  // 2. D2 -> D4 Graph Client Contract
  describe('2. D2 -> D4 Graph Client Contract', () => {
    it('Verifies D4 /graph/focused contract', async () => {
      const result = await GraphClient.fetchD4('/d4/graph/focused', testAuthContext, {
        entityId: 'ENT-TARGET-01',
        hops: 2
      }, 5000);

      expect(result.nodes).toBeDefined();
      expect(result.nodes[0].id).toBe('ENT-TARGET-01');
    });

    it('Verifies D4 /analytics/bridge contract', async () => {
      const result = await GraphClient.fetchD4('/d4/analytics/bridge', testAuthContext, {}, 5000);

      expect(result.insights[0].type).toBe('BRIDGE');
      expect(result.key_bridges[0].betweenness_score).toBe(0.89);
    });

    it('Verifies D4 /internal/entities/resolve (ENTITY_RESOLUTION.v1 contract)', async () => {
      const payload = {
        candidate_id: 'CAND-001',
        case_id: 'CASE-CONTRACT-100',
        decision: 'ACCEPTED',
        canonical_entity: { id: 'CAND-001', name: 'John Doe' },
        reviewer_id: 'USR-CONTRACT-TEST',
        decided_at: new Date().toISOString()
      };

      const result = await GraphClient.fetchD4('/d4/internal/entities/resolve', testAuthContext, payload, 5000);
      expect(result.status).toBe('SUCCESS');
      expect(result.canonical_id).toBe('CAND-001');
    });

    it('Verifies D4 error mapping for HTTP 403 unauthorized downstream', async () => {
      await expect(
        GraphClient.fetchD4('/d4/error/403', testAuthContext, {}, 5000)
      ).rejects.toMatchObject({ code: 'DOWNSTREAM_UNAUTHORIZED' });
    });
  });

  // 3. D2 -> ML Client Contract
  describe('3. D2 -> ML Client Contract', () => {
    it('Verifies ML /predict/entity-match schema validation', async () => {
      const payload = {
        existingRecord: { name: 'Vikram Sharma', phone: '+919876543210' },
        newRecord: { name: 'Vikram Sharma', phone: '+919876543210' }
      };

      const result = await MLClient.fetchML('/ml/predict/entity-match', payload, 5000);
      expect(result.probability).toBe(0.94);
      expect(result.signals.name_similarity).toBe(0.98);
    });

    it('Verifies ML /predict/anomaly schema validation', async () => {
      const result = await MLClient.fetchML('/ml/predict/anomaly', { activity: [] }, 5000);
      expect(result.anomaly_score).toBe(0.22);
      expect(result.flags).toContain('BURST_FREQUENCY');
    });

    it('Rejects malformed ML payload with error', async () => {
      await expect(
        MLClient.predictAnomaly({ target: '/ml/malformed' })
      ).rejects.toMatchObject({ code: 'ML_SERVICE_UNAVAILABLE' });
    });
  });
});
