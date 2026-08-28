import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GraphSyncAdapter } from '../src/workers/graph_sync.adapter';
import { GraphClient } from '../src/services/graph_client';
import { AuthContext, EntityV1, RelationshipV1, EvidenceV1 } from 'shared-contracts';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

describe('D2-D4 End-to-End Integration & Security Tests', () => {
  let d4Process: ChildProcess;
  const d4Port = 8003;

  const authContext: AuthContext = {
    user_id: 'test_user',
    actor_id: 'test_user',
    role: 'investigator',
    case_id: 'CASE-001',
    allowed_case_ids: ['CASE-001'],
    access_level: 'WRITE',
    correlation_id: 'corr_test_e2e'
  };

  const authContextCase2: AuthContext = {
    ...authContext,
    case_id: 'CASE-002',
    allowed_case_ids: ['CASE-002']
  };

  beforeAll(async () => {
    // Start D4 server in test environment (forcing memory for headless deterministic execution)
    const d4Dir = path.resolve(__dirname, '../../D4/System graph intelligence security');
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
  }, 10000);

  afterAll(() => {
    if (d4Process) {
      d4Process.kill();
    }
  });

  it('1. should sync evidence metadata with inferred MIME types from D2 to D4', async () => {
    const evidence: EvidenceV1 = {
      id: 'EVD-9001',
      case_id: 'CASE-001',
      source_type: 'PDF',
      source_ref: 'wiretap_transcript.pdf',
      storage_uri: 'local://CASE-001/EVD-9001.pdf',
      sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      classification: 'RESTRICTED'
    };

    const res = await GraphSyncAdapter.syncEvidenceToD4(authContext, evidence);
    expect(res.status).toBe('success');
    expect(res.id).toBe('EVD-9001');

    // Test MIME inference helper
    const mapped = GraphSyncAdapter.mapEvidence(evidence);
    expect(mapped.mime_type).toBe('application/pdf');
    expect(mapped.sha256_hash).toBe(evidence.sha256);
  });

  it('2. should reject unsupported entity types with validation errors', () => {
    const invalidEntity: any = {
      id: 'INVALID_01',
      name: 'Bad Entity',
      type: 'UNKNOWN_CUSTOM_TYPE'
    };

    expect(() => GraphSyncAdapter.mapEntity(invalidEntity, 'CASE-001')).toThrow(
      /Unsupported or invalid entity type/
    );
  });

  it('3. should reject unsupported relationship types with validation errors', () => {
    const invalidRel: any = {
      id: 'INVALID_REL_01',
      source_id: 'P1',
      target_id: 'P2',
      type: 'ARBITRARY_ACTION'
    };

    expect(() => GraphSyncAdapter.mapRelationship(invalidRel, 'CASE-001')).toThrow(
      /Unsupported or invalid relationship type/
    );
  });

  it('4. should reject unauthenticated requests or forged HMAC signatures', async () => {
    // Attempt request without HMAC header directly to D4
    const resNoAuth = await fetch(`http://localhost:${d4Port}/sync/entity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'P100', type: 'Person', case_id: 'CASE-001' })
    });
    expect(resNoAuth.status).toBe(401);

    // Attempt request with forged signature
    const forgedContext = Buffer.from(JSON.stringify({ user_id: 'attacker', case_id: 'CASE-001' })).toString('base64');
    const resForged = await fetch(`http://localhost:${d4Port}/sync/entity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Authorization-Context': forgedContext,
        'X-Authorization-Signature': '0000000000000000000000000000000000000000000000000000000000000000'
      },
      body: JSON.stringify({ id: 'P100', type: 'Person', case_id: 'CASE-001' })
    });
    expect(resForged.status).toBe(403);
  });

  it('5. should sync entities, relationships and detect bridges across clusters', async () => {
    // Synthetic Fixture (CASE-001)
    // Cluster A: P001-P002-P003-P004
    // Cluster B: P005-P006-P007-P008
    // Bridge: X001 (P004 - X001 - P005)

    const entities: EntityV1[] = [];
    for (let i = 1; i <= 8; i++) {
      entities.push({ id: `P00${i}`, name: `Person ${i}`, type: 'Person', created_at: new Date().toISOString() });
    }
    entities.push({ id: 'X001', name: 'Bridge Node', type: 'Person', created_at: new Date().toISOString() });

    for (const e of entities) {
      const res = await GraphSyncAdapter.syncEntityToD4(authContext, e);
      expect(res.status).toBe('success');
    }

    const relationships: RelationshipV1[] = [
      { id: 'r1', source_id: 'P001', target_id: 'P002', type: 'ASSOCIATED_WITH', created_at: new Date().toISOString() },
      { id: 'r2', source_id: 'P002', target_id: 'P003', type: 'ASSOCIATED_WITH', created_at: new Date().toISOString() },
      { id: 'r3', source_id: 'P003', target_id: 'P004', type: 'ASSOCIATED_WITH', created_at: new Date().toISOString() },
      
      { id: 'r4', source_id: 'P005', target_id: 'P006', type: 'ASSOCIATED_WITH', created_at: new Date().toISOString() },
      { id: 'r5', source_id: 'P006', target_id: 'P007', type: 'ASSOCIATED_WITH', created_at: new Date().toISOString() },
      { id: 'r6', source_id: 'P007', target_id: 'P008', type: 'ASSOCIATED_WITH', created_at: new Date().toISOString() },

      // Bridge
      { id: 'rx1', source_id: 'P004', target_id: 'X001', type: 'LINKED_TO', created_at: new Date().toISOString() },
      { id: 'rx2', source_id: 'X001', target_id: 'P005', type: 'LINKED_TO', created_at: new Date().toISOString() }
    ];

    for (const r of relationships) {
      const res = await GraphSyncAdapter.syncRelationshipToD4(authContext, r);
      expect(res.status).toBe('success');
    }

    // Verify authorized graph retrieval (GraphClient.getFocusedGraph)
    const graph = await GraphClient.getFocusedGraph(authContext, 'X001', 3);
    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph.edges.length).toBeGreaterThan(0);

    // Verify bridge detection
    const bridgeResult = await GraphClient.getBridgeAnalysis(authContext);
    expect(bridgeResult.insights).toBeDefined();
    
    const bridgeInsight = bridgeResult.insights?.find((i: any) => i.supporting_entities?.includes('X001') || i.target_entity_ids?.includes('X001'));
    expect(bridgeInsight).toBeDefined();
    expect(bridgeInsight?.type).toBe('POTENTIAL_BRIDGE');
  });

  it('6. should enforce case isolation', async () => {
    // Create an entity in CASE-002
    const entityCase2: EntityV1 = { id: 'P009', name: 'Person 9', type: 'Person', created_at: new Date().toISOString() };
    await GraphSyncAdapter.syncEntityToD4(authContextCase2, entityCase2);

    // Requesting CASE-002 with seed from CASE-001 yields empty graph
    const emptyGraph = await GraphClient.getFocusedGraph(authContextCase2, 'X001', 1);
    expect(emptyGraph.nodes.length).toBe(0);
  });
});
