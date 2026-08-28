import express, { Request, Response } from 'express';

const serviceType = process.argv[2] || process.env.SERVICE_TYPE || 'all';

function createMLApp() {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'OK', service: 'ml_service' });
  });

  app.post('/predict/entity-match', (req: Request, res: Response) => {
    const { name1, name2, phone1, phone2 } = req.body || {};
    const exactName = name1 && name2 && name1.toLowerCase() === name2.toLowerCase();
    const exactPhone = phone1 && phone2 && phone1 === phone2;
    
    const prob = (exactName || exactPhone) ? 0.92 : 0.45;
    res.status(200).json({
      probability: prob,
      signals: {
        name_similarity: exactName ? 1.0 : 0.6,
        phonetic_similarity: exactName ? 1.0 : 0.55,
        identifier_similarity: exactPhone ? 1.0 : 0.3,
        context_similarity: 0.7,
        embedding_similarity: 0.75
      }
    });
  });

  app.post('/predict/anomaly', (_req: Request, res: Response) => {
    res.status(200).json({
      anomaly_score: 0.15,
      flags: ['IRREGULAR_BURST_ACTIVITY'],
      explanation: 'Unusual spike in off-hours event frequency.'
    });
  });

  return app;
}

function createD3App() {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'OK', service: 'd3_service' });
  });

  app.post('/search', (req: Request, res: Response) => {
    const { query } = req.body || {};
    res.status(200).json({
      status: 'SUCCESS',
      results: [
        {
          id: 'RES-001',
          title: `Match for: ${query || 'query'}`,
          snippet: 'Extracted entity with matching attributes in evidence records.',
          score: 0.95
        }
      ],
      insights: []
    });
  });

  app.post('/copilot', (req: Request, res: Response) => {
    const { query } = req.body || {};
    res.status(200).json({
      status: 'SUCCESS',
      response: `Investigative Analysis: Based on the synthesized case intelligence for '${query || 'query'}', key actors show frequent co-location and transactional overlaps.`,
      grounding: ['EVD-101', 'EVD-102']
    });
  });

  app.post('/leads', (req: Request, res: Response) => {
    res.status(200).json({
      status: 'SUCCESS',
      leads: [
        {
          id: 'LEAD-001',
          description: 'Cross-reference common cell tower identifiers around the primary incident area.',
          priority: 'HIGH',
          suggested_action: 'Request tower dump logs for verification.'
        }
      ]
    });
  });

  return app;
}

function createD4App() {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'OK', service: 'd4_service' });
  });

  app.post('/graph/focused', (req: Request, res: Response) => {
    const { entityId } = req.body || {};
    const baseId = entityId || 'NODE-1';
    res.status(200).json({
      nodes: [
        { id: baseId, label: `Entity ${baseId}`, type: 'PERSON' },
        { id: `${baseId}-ASSOC`, label: 'Associate Entity', type: 'PERSON' },
        { id: 'PHONE-001', label: '+919876543210', type: 'PHONE' }
      ],
      edges: [
        { id: 'EDGE-1', source: baseId, target: `${baseId}-ASSOC`, type: 'CO_SUSPECT' },
        { id: 'EDGE-2', source: baseId, target: 'PHONE-001', type: 'USED' }
      ]
    });
  });

  app.post('/graph/path', (req: Request, res: Response) => {
    const { sourceId, targetId } = req.body || {};
    res.status(200).json({
      nodes: [
        { id: sourceId || 'SRC-1', label: 'Source Node', type: 'PERSON' },
        { id: 'INTERMEDIARY-1', label: 'Intermediary', type: 'PERSON' },
        { id: targetId || 'TGT-1', label: 'Target Node', type: 'PERSON' }
      ],
      edges: [
        { id: 'PATH-1', source: sourceId || 'SRC-1', target: 'INTERMEDIARY-1', type: 'CONNECTED_TO' },
        { id: 'PATH-2', source: 'INTERMEDIARY-1', target: targetId || 'TGT-1', type: 'CONNECTED_TO' }
      ]
    });
  });

  app.post('/analytics/bridge', (_req: Request, res: Response) => {
    res.status(200).json({
      insights: [
        { type: 'BRIDGE', description: 'Structural bridge node detected between distinct network clusters.' }
      ],
      key_bridges: [
        { entity_id: 'ENT-BRIDGE-01', betweenness_score: 0.88 }
      ]
    });
  });

  app.post('/analytics/temporal', (_req: Request, res: Response) => {
    res.status(200).json({
      insights: [
        { type: 'TEMPORAL', description: 'Communication cadence accelerated significantly in the 48 hours prior to the event.' }
      ],
      summary: 'Clustered temporal activities indicate coordinated planning across multiple nodes.'
    });
  });

  const handleRelationship = (req: Request, res: Response) => {
    const id = req.params.id || req.body?.relationshipId || 'REL-001';
    res.status(200).json({
      id: id.startsWith('REL-') ? id : `REL-${id}`,
      source_id: 'ENT-001',
      target_id: 'ENT-002',
      type: 'LINKED_TO',
      weight: 0.95
    });
  };

  app.get('/relationships/:id', handleRelationship);
  app.post('/relationships/:id', handleRelationship);
  app.post('/relationships', handleRelationship);

  app.post('/internal/entities/resolve', (req: Request, res: Response) => {
    const { candidate_id, decision, canonical_entity } = req.body || {};
    res.status(200).json({
      status: 'SUCCESS',
      synced: true,
      candidate_id,
      decision,
      canonical_entity
    });
  });

  return app;
}

// Service launcher
const mlPort = parseInt(process.env.ML_PORT || process.env.PORT || '8001', 10);
const d3Port = parseInt(process.env.D3_PORT || process.env.PORT || '8002', 10);
const d4Port = parseInt(process.env.D4_PORT || process.env.PORT || '8003', 10);

if (serviceType === 'ml') {
  const app = createMLApp();
  app.listen(mlPort, '0.0.0.0', () => {
    console.log(`[ML Service Mock] Listening on port ${mlPort}`);
  });
} else if (serviceType === 'd3') {
  const app = createD3App();
  app.listen(d3Port, '0.0.0.0', () => {
    console.log(`[D3 Service Mock] Listening on port ${d3Port}`);
  });
} else if (serviceType === 'd4') {
  const app = createD4App();
  app.listen(d4Port, '0.0.0.0', () => {
    console.log(`[D4 Service Mock] Listening on port ${d4Port}`);
  });
} else {
  // Run all mock services simultaneously
  const ml = createMLApp();
  const d3 = createD3App();
  const d4 = createD4App();

  ml.listen(8001, '0.0.0.0', () => console.log('[ML Service Mock] Listening on port 8001'));
  d3.listen(8002, '0.0.0.0', () => console.log('[D3 Service Mock] Listening on port 8002'));
  d4.listen(8003, '0.0.0.0', () => console.log('[D4 Service Mock] Listening on port 8003'));
}
