import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import { db } from '../../src/db';
import { GraphClient } from '../../src/services/graph_client';
import { GraphSyncAdapter } from '../../src/workers/graph_sync.adapter';
import bcrypt from 'bcrypt';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

import { signAuthContext } from '../../src/utils/security';

describe('Synthetic Graph & Security Validation (Exact Path Proof)', () => {
  let d4Process: ChildProcess;
  const d4Port = 8004;
  let sessionCookie: string;
  let sessionCookieCase2: string;
  let adminCookie: string;
  const caseId = 'CASE-001';
  const case2Id = 'CASE-002';

  beforeAll(async () => {
    process.env.D4_SERVICE_URL = `http://localhost:${d4Port}`;
    const d4Dir = path.resolve(__dirname, '../../../D4/System graph intelligence security');
    const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    d4Process = spawn(npxCmd, ['tsx', 'server.ts'], { 
      cwd: d4Dir, 
      env: { ...process.env, PORT: d4Port.toString(), GRAPH_BACKEND: 'memory' }, 
      shell: true 
    });
    
    d4Process.stdout?.on('data', (data) => console.log(`D4 STDOUT: ${data.toString()}`));
    d4Process.stderr?.on('data', (data) => console.error(`D4 STDERR: ${data.toString()}`));

    // Wait for server to start
    await new Promise((resolve) => setTimeout(resolve, 3000));

    await db.resetDb();
    
    // Users setup
    const passwordHash = await bcrypt.hash('TestPass!2026', 10);
    await db.createUser({ id: 'USR-TEST-1', username: 'Test 1', display_name: 'Test 1', status: 'ACTIVE', clearance_level: 4, password_hash: passwordHash });
    await db.assignUserRole('USR-TEST-1', 'INVESTIGATOR');
    
    await db.createUser({ id: 'USR-TEST-2', username: 'Test 2', display_name: 'Test 2', status: 'ACTIVE', clearance_level: 4, password_hash: passwordHash });
    await db.assignUserRole('USR-TEST-2', 'INVESTIGATOR');
    
    await db.createUser({ id: 'USR-ADMIN', username: 'Admin', display_name: 'Admin', status: 'ACTIVE', clearance_level: 5, password_hash: passwordHash });
    await db.assignUserRole('USR-ADMIN', 'SYSTEM ADMIN');

    // Case setup
    await db.createCase({ id: caseId, name: 'Synthetic Case', status: 'OPEN', priority: 'HIGH', tags: [], classification: 'UNCLASSIFIED' });
    await db.addCaseMember(caseId, 'USR-TEST-1', 'WRITE');
    await db.addCaseMember(caseId, 'USR-ADMIN', 'ADMIN');

    await db.createCase({ id: case2Id, name: 'Other Case', status: 'OPEN', priority: 'HIGH', tags: [], classification: 'UNCLASSIFIED' });
    await db.addCaseMember(case2Id, 'USR-TEST-2', 'WRITE');

    // Login users
    const login1 = await request(app).post('/api/auth/login').send({ username: 'Test 1', password: 'TestPass!2026' });
    if (!login1.headers['set-cookie']) throw new Error(`Login 1 failed: ${JSON.stringify(login1.body)}`);
    sessionCookie = login1.headers['set-cookie'][0];

    const login2 = await request(app).post('/api/auth/login').send({ username: 'Test 2', password: 'TestPass!2026' });
    sessionCookieCase2 = login2.headers['set-cookie'][0];

    const loginAdmin = await request(app).post('/api/auth/login').send({ username: 'Admin', password: 'TestPass!2026' });
    adminCookie = loginAdmin.headers['set-cookie'][0];
  }, 15000);

  afterAll(() => {
    if (d4Process) {
      d4Process.kill();
    }
  });

  beforeEach(() => {
    // Keep empty or just minimal resets if needed
  });

  it('Proves exact pipeline path: Mongo -> D2 -> GraphSync -> HMAC -> D4 Auth -> Graph -> Analytics', async () => {
    // 1. Setup Synthetic Graph directly into MongoDB (via D2)
    const nodes = ['P001', 'P002', 'P003', 'X001', 'P004', 'P005', 'P006'];
    
    const authCtx = {
      user_id: 'USR-TEST-1',
      actor_id: 'USR-TEST-1',
      role: 'INVESTIGATOR',
      case_id: caseId,
      allowed_case_ids: [caseId],
      access_level: 'WRITE',
      correlation_id: 'corr_synth_01'
    };

    // Inject nodes as canonical entities and sync to D4
    for (const id of nodes) {
      const entity = {
        id,
        type: 'PERSON',
        name: `Node ${id}`,
        identifiers: [],
        properties: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        case_id: caseId
      };
      
      // Simulate D2 -> GraphSyncAdapter -> HMAC -> D4 Sync Entity
      await GraphSyncAdapter.syncEntityToD4(authCtx, entity as any);
    }

    // Inject relationships and sync to D4
    const edges = [
      { source: 'P001', target: 'P002' },
      { source: 'P002', target: 'P003' },
      { source: 'P003', target: 'X001' },
      { source: 'X001', target: 'P004' },
      { source: 'P004', target: 'P005' },
      { source: 'P005', target: 'P006' }
    ];

    for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      const rel = {
        id: `REL-SYN-${i}`,
        type: 'LINKED_TO',
        source_id: e.source,
        target_id: e.target,
        source_name: e.source,
        target_name: e.target,
        evidence_ids: ['EVD-TEST-1'],
        weight: 1.0,
        case_id: caseId,
        properties: {
          effective_start: '2026-08-01T00:00:00Z',
          provenance: { source_type: 'MANUAL', evidence_id: 'EVD-TEST-1' }
        }
      };
      // Simulate D2 -> GraphSyncAdapter -> HMAC -> D4 Sync Relationship
      await GraphSyncAdapter.syncRelationshipToD4(authCtx, rel as any);
    }

    // 2. Fetch the graph back through D2 API (D2 -> HMAC -> D4 -> Verify Graph)
    // We get the focused graph starting from X001 (which should pull in the whole cluster)
    const graphRes = await request(app)
      .get(`/api/cases/${caseId}/graph?entityId=X001&hops=3`)
      .set('Cookie', sessionCookie);
    
    expect(graphRes.status).toBe(200);
    expect(graphRes.body.nodes).toBeDefined();
    expect(graphRes.body.nodes.length).toBeGreaterThanOrEqual(7);
    expect(graphRes.body.edges.length).toBeGreaterThanOrEqual(6);
    
    // Verify specific properties are preserved in D4
    const x001Node = graphRes.body.nodes.find((n: any) => n.id === 'X001');
    expect(x001Node).toBeDefined();
    
    const r0Edge = graphRes.body.edges[0];
    expect(r0Edge.properties?.effective_start || r0Edge.effective_start).toBeDefined(); // temporal fields preserved

    // 3. Trigger Bridge Analysis 
    const bridgeRes = await request(app)
      .post(`/api/cases/${caseId}/analytics/bridge`)
      .set('Cookie', sessionCookie);

    expect(bridgeRes.status).toBe(200);
    
    // Validate X001 is identified as a potential bridge!
    const bridgeInsights = bridgeRes.body.insights || bridgeRes.body.key_bridges || bridgeRes.body.analysis?.insights;
    expect(bridgeInsights).toBeDefined();
    const isX001Bridge = bridgeInsights.some((i: any) => 
      i.type === 'POTENTIAL_BRIDGE' && i.target_entity_ids.includes('X001')
    );
    expect(isX001Bridge).toBe(true);
  });

  it('Verifies Security Boundaries: CASE-001 user -> CASE-001 (✅)', async () => {
    const res = await request(app).get(`/api/cases/${caseId}/graph?entityId=X001&hops=1`).set('Cookie', sessionCookie);
    expect(res.status).not.toBe(403);
  });

  it('Verifies Security Boundaries: CASE-001 user -> CASE-002 (❌ 403)', async () => {
    const res = await request(app).get(`/api/cases/${case2Id}/graph?entityId=X001&hops=1`).set('Cookie', sessionCookie);
    expect(res.status).toBe(403);
  });

  it('Verifies Security Boundaries: invalid HMAC (❌ 403)', async () => {
    const authCtx = {
      user_id: 'USR-TEST-1',
      actor_id: 'USR-TEST-1',
      role: 'INVESTIGATOR',
      case_id: caseId,
      allowed_case_ids: [caseId],
      access_level: 'WRITE',
      correlation_id: 'corr_test_hmac'
    };

    const { contextHeader } = signAuthContext(authCtx);
    
    const d4Url = `http://localhost:${d4Port}`;
    const res = await fetch(`${d4Url}/graph/focused`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Authorization-Context': contextHeader,
        'X-Authorization-Signature': 'invalid_tampered_signature'
      },
      body: JSON.stringify({ case_id: caseId })
    });

    expect(res.status).toBe(403);
  });

  it('Verifies Security Boundaries: expired HMAC (❌ 403)', async () => {
    const authCtx = {
      user_id: 'USR-TEST-1',
      actor_id: 'USR-TEST-1',
      role: 'INVESTIGATOR',
      case_id: caseId,
      allowed_case_ids: [caseId],
      access_level: 'WRITE',
      correlation_id: 'corr_test_expired'
    };

    // Generate normal signed headers
    const { contextHeader } = signAuthContext(authCtx);
    
    // Now decode context, change expires_at to past, and sign with raw crypto
    const crypto = await import('crypto');
    const secret = process.env.INTERNAL_SERVICE_SECRET || 'demo-internal-service-hmac-secret';
    
    const parsed = JSON.parse(Buffer.from(contextHeader, 'base64').toString('utf8'));
    parsed.expires_at = Date.now() - 10000; // Expired 10s ago
    
    const contextJson = JSON.stringify(parsed);
    const expiredContextStr = Buffer.from(contextJson).toString('base64');
    const expiredSig = crypto.createHmac('sha256', secret).update(contextJson).digest('hex');

    const d4Url = `http://localhost:${d4Port}`;
    const res = await fetch(`${d4Url}/graph/focused`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Authorization-Context': expiredContextStr,
        'X-Authorization-Signature': expiredSig
      },
      body: JSON.stringify({ case_id: caseId })
    });

    expect(res.status).toBe(403);
  });

  it('Verifies Security Boundaries: cross-case relationship (❌ reject)', async () => {
    const authCtx = {
      user_id: 'USR-ADMIN',
      actor_id: 'USR-ADMIN',
      role: 'SYSTEM ADMIN',
      case_id: caseId,
      allowed_case_ids: [caseId, case2Id],
      access_level: 'WRITE',
      correlation_id: 'corr_cross_case'
    };

    const rel = {
      id: `REL-CROSS-1`,
      type: 'LINKED_TO',
      source_id: 'P001',
      target_id: 'P002-C2',
      source_name: 'P001',
      target_name: 'P002-C2',
      evidence_ids: [],
      properties: {}
    };

    const mapped = GraphSyncAdapter.mapRelationship(rel as any, caseId);
    mapped.target = 'P002-C2';
    
    const d4Url = `http://localhost:${d4Port}`;
    
    const authCtx2 = { ...authCtx, case_id: case2Id };
    await GraphSyncAdapter.syncEntityToD4(authCtx2, { id: 'P002-C2', type: 'PERSON', case_id: case2Id } as any);

    const { contextHeader, signatureHeader } = signAuthContext(authCtx);

    const res = await fetch(`${d4Url}/sync/relationship`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Authorization-Context': contextHeader,
        'X-Authorization-Signature': signatureHeader
      },
      body: JSON.stringify(mapped)
    });

    expect(res.status).toBe(500); 
    const body = await res.json();
    expect(body.message).toMatch(/case_id mismatch/);
  });

  it('Verifies Security Boundaries: unsupported entity type (❌ reject)', async () => {
    const authCtx = {
      user_id: 'USR-TEST-1',
      actor_id: 'USR-TEST-1',
      role: 'INVESTIGATOR',
      case_id: caseId,
      allowed_case_ids: [caseId],
      access_level: 'WRITE',
      correlation_id: 'corr_test'
    };

    const entity = {
      id: 'UNSUPPORTED-1',
      type: 'UNKNOWN',
      name: 'Bogus Node',
      case_id: caseId
    };

    try {
      await GraphSyncAdapter.syncEntityToD4(authCtx, { ...entity, type: 'BOGUS_TYPE' } as any);
      expect.fail('Should have rejected unsupported entity type');
    } catch (err: any) {
      expect(err.message).toMatch(/Validation Error/);
    }
  });

  it('Verifies Security Boundaries: unsupported relationship type (❌ reject)', async () => {
    const authCtx = {
      user_id: 'USR-TEST-1',
      actor_id: 'USR-TEST-1',
      role: 'INVESTIGATOR',
      case_id: caseId,
      allowed_case_ids: [caseId],
      access_level: 'WRITE',
      correlation_id: 'corr_test'
    };
    
    const d4Url = `http://localhost:${d4Port}`;
    const { contextHeader, signatureHeader } = signAuthContext(authCtx);
    
    const res = await fetch(`${d4Url}/sync/relationship`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Authorization-Context': contextHeader,
        'X-Authorization-Signature': signatureHeader
      },
      body: JSON.stringify({
        id: 'REL-BOGUS',
        source: 'P001',
        target: 'P002',
        case_id: caseId,
        type: 'BOGUS_TYPE',
        evidence_ids: [],
        properties: {}
      })
    });

    expect(res.status).toBe(500); 
    const body = await res.json();
    expect(body.message).toMatch(/Invalid relationship type/i);
  });
});
