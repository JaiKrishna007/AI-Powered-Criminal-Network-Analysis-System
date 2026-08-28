import express from 'express';
import cors from 'cors';
import { Neo4jGraphRepository } from './lib/graph/neo4j.js';
import { AnalyticsWorker } from './workers/analytics.js';
import { BridgeDetector } from './lib/graph/analytics/bridge.js';
import { TemporalEngine } from './lib/graph/temporal.js';
import { ReportGenerator } from './lib/reports/report_generator.js';
import { AuthContext, ENTITY_v1, REL_v1 } from 'shared-contracts';
import { AuditLogger } from './lib/audit/audit_logger.js';

const app = express();
app.use(cors());
app.use(express.json());

import { GraphStore } from './lib/graph/store.js';

const auditLogger = new AuditLogger();
const repo = new GraphStore(auditLogger, undefined, true); // Force InMemory for dev/test
const worker = new AnalyticsWorker(repo, auditLogger);
const temporalEngine = new TemporalEngine(repo as any);

function extractContext(req: express.Request): AuthContext {
  const contextStr = req.headers['x-authorization-context'] as string;
  if (!contextStr) {
    throw new Error("Missing X-Authorization-Context");
  }
  const decoded = Buffer.from(contextStr, 'base64').toString('utf8');
  return JSON.parse(decoded);
}

app.post('/sync/entity', async (req, res) => {
  try {
    const auth = extractContext(req);
    const entity = req.body as ENTITY_v1;
    await repo.addEntity(entity, auth);
    res.json({ status: 'success' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/sync/relationship', async (req, res) => {
  try {
    const auth = extractContext(req);
    const rel = req.body as REL_v1;
    await repo.addRelationship(rel, auth);
    res.json({ status: 'success' });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/graph/focused', async (req, res) => {
  try {
    const auth = extractContext(req);
    const { entityId, hops } = req.body;
    const graph = await repo.extractFocusedSubgraph({
      case_id: auth.case_id,
      seed_ids: [entityId],
      max_hops: hops,
      max_nodes: 100
    }, auth);
    res.json(graph);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/analytics/bridge', async (req, res) => {
  try {
    const auth = extractContext(req);
    const job = await worker.processJob({
      id: `job-${Date.now()}`,
      case_id: auth.case_id,
      type: 'BRIDGE_DETECTION',
      auth
    });
    res.json({ insights: job.map((b: any) => b.insight) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/analytics/temporal', async (req, res) => {
  try {
    const auth = extractContext(req);
    const { timeRange } = req.body;
    const job = await worker.processJob({
      id: `job-${Date.now()}`,
      case_id: auth.case_id,
      type: 'TEMPORAL_DIFF',
      auth,
      payload: { time1: timeRange.start, time2: timeRange.end }
    });
    res.json(job);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 8003;
app.listen(PORT, () => {
  console.log(`D4 Graph Trust Service listening on port ${PORT}`);
});
