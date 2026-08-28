import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GraphSyncAdapter } from '../src/workers/graph_sync.adapter';
import { GraphClient } from '../src/services/graph_client';
import { AuthContext, EntityV1, RelationshipV1 } from 'shared-contracts';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
// no wait import

describe('D2-D4 End-to-End Integration Tests', () => {
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
    // Start D4 server
    const d4Dir = path.resolve(__dirname, '../../D4/System graph intelligence security');
    const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    d4Process = spawn(npxCmd, ['tsx', 'server.ts'], { cwd: d4Dir, env: { ...process.env, PORT: d4Port.toString() }, shell: true });
    
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

  it('should sync entities and relationships from D2 to D4 correctly', async () => {
    // 1. Create Synthetic Fixture (CASE-001)
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
    
    // In D4 InMemoryGraphRepository, bridge analytics tests if X001 is found. Wait, D4 AnalyticsWorker calls bridgeDetector.
    const bridgeInsight = bridgeResult.insights?.find((i: any) => i.supporting_entities?.includes('X001') || i.target_entity_ids?.includes('X001'));
    expect(bridgeInsight).toBeDefined();
    expect(bridgeInsight?.type).toBe('POTENTIAL_BRIDGE');
  });

  it('should enforce case isolation', async () => {
    // Create an entity in CASE-002
    const entityCase2: EntityV1 = { id: 'P009', name: 'Person 9', type: 'Person', created_at: new Date().toISOString() };
    await GraphSyncAdapter.syncEntityToD4(authContextCase2, entityCase2);

    // Try to access CASE-001 with AuthContext for CASE-002
    const emptyGraph = await GraphClient.getFocusedGraph(authContextCase2, 'X001', 1);
    expect(emptyGraph.nodes.length).toBe(0);
  });
});
