import express from 'express';
import cors from 'cors';
import { AnalyticsWorker } from './workers/analytics.js';
import { GraphStore } from './lib/graph/store.js';
import { TemporalEngine } from './lib/graph/temporal.js';
import { AuthContext, ENTITY_v1, REL_v1, EVIDENCE_v1 } from 'shared-contracts';
import { AuditLogger } from './lib/audit/audit_logger.js';
import { extractAndVerifyAuthContext } from './lib/security/auth_verifier.js';

const app = express();
app.use(cors());
app.use(express.json());

const auditLogger = new AuditLogger();
// By default connects to Neo4j in production / runtime; uses memory only if explicitly requested
const forceMemory = process.env.GRAPH_BACKEND === 'memory';
const repo = new GraphStore(auditLogger, undefined, forceMemory);
const worker = new AnalyticsWorker(repo, auditLogger);
const temporalEngine = new TemporalEngine(repo as any);

function extractContext(req: express.Request): AuthContext {
  return extractAndVerifyAuthContext(req.headers);
}

function handleEndpointError(res: express.Response, err: any) {
  const message = err?.message || 'Internal Server Error';
  if (message.startsWith('UNAUTHORIZED')) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message });
  }
  if (message.startsWith('FORBIDDEN') || message.includes('Unauthorized access')) {
    return res.status(403).json({ error: 'FORBIDDEN', message });
  }
  console.error(err);
  return res.status(500).json({ error: 'INTERNAL_ERROR', message });
}

// 1. Sync Entity Endpoint
app.post('/sync/entity', async (req, res) => {
  try {
    const auth = extractContext(req);
    const entity = req.body as ENTITY_v1;
    await repo.addEntity(entity, auth);
    res.json({ status: 'success', id: entity.id });
  } catch (err: any) {
    handleEndpointError(res, err);
  }
});

// 2. Sync Relationship Endpoint
app.post('/sync/relationship', async (req, res) => {
  try {
    const auth = extractContext(req);
    const rel = req.body as REL_v1;
    await repo.addRelationship(rel, auth);
    res.json({ status: 'success', id: rel.id });
  } catch (err: any) {
    handleEndpointError(res, err);
  }
});

import { InMemoryEvidenceRepository } from './lib/evidence/in_memory_repository.js';
const evidenceRepo = new InMemoryEvidenceRepository();

// 3. Sync Evidence Endpoint
app.post('/sync/evidence', async (req, res) => {
  try {
    const auth = extractContext(req);
    const evidence = req.body as EVIDENCE_v1;
    
    if (!evidence.case_id || !auth.allowed_case_ids.includes(evidence.case_id)) {
      throw new Error(`Unauthorized access to case_id: ${evidence.case_id}`);
    }

    await evidenceRepo.save(evidence);

    await auditLogger.log(
      auth.actor_id,
      "SYNC_EVIDENCE",
      "EVIDENCE",
      evidence.id,
      "SUCCESS",
      auth.correlation_id,
      { file_name: evidence.file_name, case_id: evidence.case_id, sha256_hash: evidence.sha256_hash }
    );
    res.json({ status: 'success', id: evidence.id });
  } catch (err: any) {
    handleEndpointError(res, err);
  }
});

// 4. Focused Graph Extraction
app.post('/graph/focused', async (req, res) => {
  try {
    const auth = extractContext(req);
    const { entityId, hops } = req.body;
    const graph = await repo.extractFocusedSubgraph({
      case_id: auth.case_id,
      seed_ids: entityId ? [entityId] : [],
      max_hops: hops !== undefined ? hops : 2,
      max_nodes: 100
    }, auth);
    res.json(graph);
  } catch (err: any) {
    handleEndpointError(res, err);
  }
});

// 5. Bridge Detection Analytics
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
    handleEndpointError(res, err);
  }
});

// 6. Temporal Analysis
app.post('/analytics/temporal', async (req, res) => {
  try {
    const auth = extractContext(req);
    const { timeRange } = req.body;
    const job = await worker.processJob({
      id: `job-${Date.now()}`,
      case_id: auth.case_id,
      type: 'TEMPORAL_DIFF',
      auth,
      payload: { time1: timeRange?.start, time2: timeRange?.end }
    });
    res.json(job);
  } catch (err: any) {
    handleEndpointError(res, err);
  }
});

// 7. Relationship Retrieval
app.post('/relationships/:id', async (req, res) => {
  try {
    const auth = extractContext(req);
    const rel = await repo.getRelationship(req.params.id, auth);
    if (!rel) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Relationship not found' });
    }
    res.json(rel);
  } catch (err: any) {
    handleEndpointError(res, err);
  }
});

const PORT = process.env.PORT || 8003;
app.listen(PORT, () => {
  console.log(`D4 Graph Trust Service listening on port ${PORT}`);
});
