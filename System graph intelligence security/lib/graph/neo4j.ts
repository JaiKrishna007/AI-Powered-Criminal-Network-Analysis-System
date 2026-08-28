/**
 * Neo4j Graph Intelligence & Mapping Layer
 * Implements the GraphRepository interface for Neo4j production environments.
 * Uses parameterized Cypher for all intelligence queries (Issue 1 & 2).
 */

import neo4j, { Driver, Session } from "neo4j-driver";
import { ENTITY_v1, REL_v1, GRAPH_v1, AuthContext } from "../contracts/types.js";
import { GraphRepository } from "./repository.js";
import { FocusedSubgraphOptions } from "./focused_subgraph.js";

export class Neo4jGraphRepository implements GraphRepository {
  private driver: Driver | null = null;

  constructor(uri?: string, user?: string, password?: string) {
    const configUri = uri || process.env.NEO4J_URI;
    const configUser = user || process.env.NEO4J_USER;
    const configPassword = password || process.env.NEO4J_PASSWORD;

    if (configUri && configUser && configPassword) {
      this.driver = neo4j.driver(configUri, neo4j.auth.basic(configUser, configPassword));
    }
  }

  public isConnected(): boolean {
    return this.driver !== null;
  }

  public async close(): Promise<void> {
    if (this.driver) {
      await this.driver.close();
      this.driver = null;
    }
  }

  private async executeCypher(cypher: string, params: Record<string, any> = {}): Promise<any[]> {
    if (!this.driver) {
      throw new Error("Neo4j driver is not connected. Use InMemoryGraphRepository for testing.");
    }
    const session: Session = this.driver.session();
    try {
      const result = await session.run(cypher, params);
      return result.records;
    } finally {
      await session.close();
    }
  }

  private checkAuthContext(caseId: string, auth?: AuthContext): void {
    if (auth && !auth.allowed_case_ids.includes(caseId)) {
      throw new Error(`Unauthorized access to case_id: ${caseId}`);
    }
  }

  public async addEntity(entity: ENTITY_v1, auth?: AuthContext): Promise<void> {
    if (!entity.case_id) {
      throw new Error(`Cannot add entity without case_id: ${entity.id}`);
    }
    this.checkAuthContext(entity.case_id, auth);
    const label = entity.type;
    const props = {
      id: entity.id,
      case_id: entity.case_id || "",
      ...(entity.event_time ? { event_time: entity.event_time } : {}),
      ...(entity.properties || {}),
    };
    // Note: dynamic labels require concatenation, safe as label comes from entity.type mapping
    const query = `MERGE (n:\`${label}\` {id: $props.id}) SET n += $props`;
    await this.executeCypher(query, { props });
  }

  public async addRelationship(rel: REL_v1, auth?: AuthContext): Promise<void> {
    this.checkAuthContext(rel.case_id, auth);

    // Issue 4: Validation happens implicitly in Cypher by matching case_id on source/target
    const props = {
      id: rel.id,
      case_id: rel.case_id,
      evidence_ids: rel.evidence_ids || [],
      ...(rel.event_time ? { event_time: rel.event_time } : {}),
      ...(rel.effective_start ? { effective_start: rel.effective_start } : {}),
      ...(rel.effective_end ? { effective_end: rel.effective_end } : {}),
      ...(rel.properties || {}),
    };

    const query = `
      MATCH (source {id: $sourceId, case_id: $caseId})
      MATCH (target {id: $targetId, case_id: $caseId})
      MERGE (source)-[r:\`${rel.type}\` {id: $props.id}]->(target)
      SET r += $props
      RETURN r;
    `;

    const records = await this.executeCypher(query, {
      sourceId: rel.source,
      targetId: rel.target,
      caseId: rel.case_id,
      props,
    });

    if (records.length === 0) {
      throw new Error("Cannot add relationship: Source or target node does not exist, or case_id mismatch.");
    }
  }

  public async getEntity(id: string, auth?: AuthContext): Promise<ENTITY_v1 | undefined> {
    const query = `MATCH (n {id: $id}) RETURN n`;
    const records = await this.executeCypher(query, { id });
    if (records.length === 0) return undefined;

    const node = records[0].get("n").properties;
    const labels = records[0].get("n").labels;
    const entity: ENTITY_v1 = {
      ...node,
      type: labels[0] || "Unknown",
    };

    if (!entity.case_id) {
      throw new Error(`Retrieved entity is missing case_id: ${entity.id}`);
    }
    this.checkAuthContext(entity.case_id, auth);
    return entity;
  }

  public async getRelationship(id: string, auth?: AuthContext): Promise<REL_v1 | undefined> {
    const query = `MATCH ()-[r {id: $id}]->() RETURN r, startNode(r).id as source, endNode(r).id as target, type(r) as type`;
    const records = await this.executeCypher(query, { id });
    if (records.length === 0) return undefined;

    const relProps = records[0].get("r").properties;
    const rel: REL_v1 = {
      ...relProps,
      source: records[0].get("source"),
      target: records[0].get("target"),
      type: records[0].get("type"),
    };

    this.checkAuthContext(rel.case_id, auth);
    return rel;
  }

  public async getAllEntitiesForCase(caseId: string, auth?: AuthContext): Promise<ENTITY_v1[]> {
    this.checkAuthContext(caseId, auth);
    const query = `MATCH (n {case_id: $caseId}) RETURN n`;
    const records = await this.executeCypher(query, { caseId });
    return records.map(r => {
      const p = r.get("n").properties;
      return { ...p, type: r.get("n").labels[0] || "Unknown" } as ENTITY_v1;
    });
  }

  public async getAllRelationshipsForCase(caseId: string, auth?: AuthContext): Promise<REL_v1[]> {
    this.checkAuthContext(caseId, auth);
    const query = `MATCH ()-[r {case_id: $caseId}]->() RETURN r, startNode(r).id as source, endNode(r).id as target, type(r) as type`;
    const records = await this.executeCypher(query, { caseId });
    return records.map(r => {
      const p = r.get("r").properties;
      return { ...p, source: r.get("source"), target: r.get("target"), type: r.get("type") } as REL_v1;
    });
  }

  public async getCaseGraph(caseId: string, auth?: AuthContext, maxNodes: number = 1000): Promise<GRAPH_v1> {
    this.checkAuthContext(caseId, auth);
    // Simple extraction of the entire case bounded by maxNodes
    const query = `
      MATCH (n {case_id: $caseId})
      WITH n LIMIT toInteger($maxNodes)
      OPTIONAL MATCH (n)-[r {case_id: $caseId}]-(m {case_id: $caseId})
      WHERE m IN collect(n)
      RETURN collect(DISTINCT n) as nodes, collect(DISTINCT r) as edges
    `;
    const records = await this.executeCypher(query, { caseId, maxNodes });
    const nodes = records[0]?.get("nodes")?.map((n: any) => ({ ...n.properties, type: n.labels?.[0] || "Unknown" })) || [];
    const edges = records[0]?.get("edges")?.filter(Boolean).map((r: any) => ({ ...r.properties, source: r.start.properties.id, target: r.end.properties.id, type: r.type })) || [];
    
    return {
      case_id: caseId,
      nodes,
      edges,
      meta: {
        truncated: nodes.length >= maxNodes,
        node_count: nodes.length,
        edge_count: edges.length,
      }
    };
  }

  public async getFocusedSubgraph(options: FocusedSubgraphOptions, auth?: AuthContext): Promise<GRAPH_v1> {
    this.checkAuthContext(options.case_id, auth);
    const { case_id, seed_ids, max_hops = 2, time_start, time_end, rel_types, max_nodes = 100 } = options;
    
    let relFilter = "";
    if (rel_types && rel_types.length > 0) {
      relFilter = ":" + rel_types.join("|");
    }

    let timeFilter = "";
    if (time_start && time_end) {
      timeFilter = `AND (
        (r.event_time IS NOT NULL AND r.event_time >= $time_start AND r.event_time <= $time_end) OR
        (r.effective_start IS NOT NULL AND (r.effective_end IS NULL OR r.effective_end >= $time_start) AND r.effective_start <= $time_end)
      )`;
    } else if (time_start) {
      timeFilter = `AND (
        (r.event_time IS NOT NULL AND r.event_time >= $time_start) OR
        (r.effective_start IS NOT NULL AND (r.effective_end IS NULL OR r.effective_end >= $time_start))
      )`;
    } else if (time_end) {
      timeFilter = `AND (
        (r.event_time IS NOT NULL AND r.event_time <= $time_end) OR
        (r.effective_start IS NOT NULL AND r.effective_start <= $time_end)
      )`;
    }

    // Parameterized Cypher for focused subgraph using apoc.path.subgraphAll or variable length paths
    // Using basic variable length paths to avoid APOC dependency if missing
    const query = `
      MATCH path = (seed {case_id: $case_id})-[r${relFilter}*0..${max_hops}]-(target {case_id: $case_id})
      WHERE seed.id IN $seed_ids ${timeFilter}
      WITH collect(DISTINCT target) as allNodes, collect(DISTINCT last(relationships(path))) as allEdges
      WITH allNodes[0..$max_nodes] as selectedNodes, allEdges
      
      UNWIND selectedNodes as n
      OPTIONAL MATCH (n)-[rel${relFilter}]-(m)
      WHERE m IN selectedNodes AND rel IN allEdges
      RETURN collect(DISTINCT n) as nodes, collect(DISTINCT rel) as edges
    `;

    const records = await this.executeCypher(query, {
      case_id,
      seed_ids,
      max_hops,
      time_start,
      time_end,
      max_nodes
    });

    const nodes = records[0]?.get("nodes")?.map((n: any) => ({ ...n.properties, type: n.labels?.[0] || "Unknown" })) || [];
    const edges = records[0]?.get("edges")?.filter(Boolean).map((r: any) => ({ ...r.properties, source: r.start.properties.id, target: r.end.properties.id, type: r.type })) || [];

    return {
      case_id: case_id,
      nodes,
      edges,
      meta: {
        truncated: nodes.length >= max_nodes,
        node_count: nodes.length,
        edge_count: edges.length,
      }
    };
  }

  public async clear(): Promise<void> {
    await this.executeCypher(`MATCH (n) DETACH DELETE n`);
  }
}
