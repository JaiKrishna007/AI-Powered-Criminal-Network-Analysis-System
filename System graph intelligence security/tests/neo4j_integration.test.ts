import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import neo4j, { Driver } from 'neo4j-driver';
import { Neo4jGraphRepository } from '../lib/graph/neo4j.js';
import { ENTITY_v1, REL_v1, AuthContext } from '../lib/contracts/types.js';

// Skip this suite automatically if NEO4J_TEST_URI is not provided, 
// to prevent CI/local hangs when Docker Neo4j isn't running.
const NEO4J_URI = process.env.NEO4J_TEST_URI;

describe.runIf(NEO4J_URI)('Neo4j Real Runtime Verification', () => {
  let driver: Driver;
  let repo: Neo4jGraphRepository;

  const authA: AuthContext = {
    actor_id: 'tester',
    correlation_id: 'test-corr-1',
    allowed_case_ids: ['case-a'],
    role: 'investigator',
  };

  const authB: AuthContext = {
    actor_id: 'tester',
    correlation_id: 'test-corr-2',
    allowed_case_ids: ['case-b'],
    role: 'investigator',
  };

  beforeAll(async () => {
    driver = neo4j.driver(NEO4J_URI || 'bolt://localhost:7687', neo4j.auth.basic('neo4j', 'testpassword'));
    repo = Neo4jGraphRepository.fromDriver(driver);
    
    // Wait for DB to be ready
    let retries = 5;
    while (retries > 0) {
      try {
        await driver.getServerInfo();
        break;
      } catch (e) {
        retries--;
        if (retries === 0) throw new Error("Could not connect to Neo4j");
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }, 15000);

  afterAll(async () => {
    if (driver) {
      await driver.close();
    }
  });

  beforeEach(async () => {
    // Clear DB
    const session = driver.session();
    try {
      await session.run('MATCH (n) DETACH DELETE n');
    } finally {
      await session.close();
    }
  });

  it('should successfully create entities and relationships', async () => {
    const nodes: ENTITY_v1[] = [
      { id: 'p1', type: 'Person', case_id: 'case-a', properties: { name: 'Alice' } },
      { id: 'p2', type: 'Person', case_id: 'case-a', properties: { name: 'Bob' } },
    ];
    
    const edges: REL_v1[] = [
      { id: 'r1', source: 'p1', target: 'p2', type: 'CALLED', case_id: 'case-a', evidence_ids: ['ev1'] },
    ];

    for (const n of nodes) await repo.addEntity(n, authA);
    for (const e of edges) await repo.addRelationship(e, authA);

    const graph = await repo.getCaseGraph('case-a', authA, 100);
    expect(graph.nodes.length).toBe(2);
    expect(graph.edges.length).toBe(1);

    expect(graph.nodes.find(n => n.id === 'p1')).toBeDefined();
    expect(graph.nodes.find(n => n.id === 'p2')).toBeDefined();
    
    // Source/Target mapping check
    const edge = graph.edges[0];
    expect(edge.source).toBe('p1');
    expect(edge.target).toBe('p2');
    expect(edge.type).toBe('CALLED');
  });

  it('should correctly filter case graph by authorization bounds', async () => {
    const nodes: ENTITY_v1[] = [
      { id: 'p1_auth', type: 'Person', case_id: 'case-a' },
      { id: 'p2_auth', type: 'Person', case_id: 'case-b' },
    ];
    await repo.addEntity(nodes[0], authA);
    await repo.addEntity(nodes[1], authB);

    // Should throw if case-b is requested but auth only has case-a
    await expect(repo.getCaseGraph('case-b', authA, 100)).rejects.toThrow('Unauthorized access');

    const graphA = await repo.getCaseGraph('case-a', authA, 100);
    expect(graphA.nodes.length).toBe(1); // Wait, there's a p1 from previous test because DETACH DELETE runs per test. No, wait, p1 is id conflict. So p1_auth
    expect(graphA.nodes[0].id).toBe('p1_auth');

    const graphB = await repo.getCaseGraph('case-b', authB, 100);
    expect(graphB.nodes.length).toBe(1);
    expect(graphB.nodes[0].id).toBe('p2_auth');
  });

  it('should successfully extract a variable-length focused subgraph including max_hops = 0', async () => {
    const nodes: ENTITY_v1[] = [
      { id: 'n1', type: 'Person', case_id: 'case-a' },
      { id: 'n2', type: 'Phone', case_id: 'case-a' },
      { id: 'n3', type: 'Person', case_id: 'case-a' },
      { id: 'n4', type: 'BankAccount', case_id: 'case-a' }, // Out of bounds
    ];
    const edges: REL_v1[] = [
      { id: 'e1', source: 'n1', target: 'n2', type: 'USED', case_id: 'case-a', evidence_ids: [] },
      { id: 'e2', source: 'n2', target: 'n3', type: 'CALLED', case_id: 'case-a', evidence_ids: [] },
      { id: 'e3', source: 'n3', target: 'n4', type: 'OWNED', case_id: 'case-a', evidence_ids: [] },
    ];
    for (const n of nodes) await repo.addEntity(n, authA);
    for (const e of edges) await repo.addRelationship(e, authA);

    // Distance 0 from n1 -> Should include ONLY n1 and NO edges
    const sub0 = await repo.getFocusedSubgraph({ case_id: 'case-a', seed_ids: ['n1'], max_hops: 0 }, authA);
    expect(sub0.nodes.length).toBe(1);
    expect(sub0.edges.length).toBe(0);
    expect(sub0.nodes[0].id).toBe('n1');

    // Distance 1 from n1 -> Should include n1, n2 and e1
    const sub1 = await repo.getFocusedSubgraph({ case_id: 'case-a', seed_ids: ['n1'], max_hops: 1 }, authA);
    expect(sub1.nodes.length).toBe(2);
    expect(sub1.edges.length).toBe(1);
    expect(sub1.nodes.map(n => n.id).sort()).toEqual(['n1', 'n2']);

    // Distance 2 from n1 -> Should include n1, n2, n3 and e1, e2
    const sub2 = await repo.getFocusedSubgraph({ case_id: 'case-a', seed_ids: ['n1'], max_hops: 2 }, authA);
    expect(sub2.nodes.length).toBe(3);
    expect(sub2.edges.length).toBe(2);
    expect(sub2.nodes.map(n => n.id).sort()).toEqual(['n1', 'n2', 'n3']);
  });

  it('should extract authorized analytics graph independently of max_nodes truncations', async () => {
    // Insert 5 nodes
    const nodes: ENTITY_v1[] = Array.from({ length: 5 }, (_, i) => ({
      id: `ana${i}`, type: 'Person', case_id: 'case-a'
    }));
    for (const n of nodes) await repo.addEntity(n, authA);

    // Visual graph is bounded (max_nodes = 2)
    const visualGraph = await repo.getCaseGraph('case-a', authA, 2);
    expect(visualGraph.nodes.length).toBe(2);
    expect(visualGraph.meta.truncated).toBe(true);

    // Analytics graph should pull everything
    const analyticsGraph = await repo.getAuthorizedAnalyticsGraph('case-a', authA);
    expect(analyticsGraph.nodes.length).toBe(5);
    expect(analyticsGraph.meta.truncated).toBe(false);
  });
});
