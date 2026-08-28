/**
 * Neo4j Graph Intelligence & Mapping Layer
 * Implements the GraphRepository interface for Neo4j production environments.
 * Uses parameterized Cypher for all intelligence queries (Issue 1 & 2).
 */

import neo4j, { Driver, Session } from "neo4j-driver";
import { ENTITY_v1, REL_v1, GRAPH_v1, AuthContext } from "../contracts/types.js";
import { GraphRepository } from "./repository.js";
import { FocusedSubgraphOptions } from "./focused_subgraph.js";

const ALLOWED_RELATIONSHIP_TYPES = new Set([
  "CALLED",
  "TRANSFERRED_MONEY",
  "USED",
  "OWNED",
  "VISITED",
  "MET_AT",
  "TRAVELED_WITH",
  "LINKED_TO",
  "ASSOCIATED_WITH",
  "PART_OF_CASE"
]);

function validateRelTypes(types?: string[]) {
  if (!types) return;
  for (const t of types) {
    if (!ALLOWED_RELATIONSHIP_TYPES.has(t)) {
      throw new Error(`Invalid relationship type: ${t}`);
    }
  }
}

function validateBounds(value: any, name: string): number {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0 || !Number.isFinite(num)) {
    throw new Error(`Invalid value for ${name}: must be a positive finite integer.`);
  }
  return num;
}

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

  public static fromDriver(driver: Driver): Neo4jGraphRepository {
    const repo = new Neo4jGraphRepository();
    repo.driver = driver;
    return repo;
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

  private checkAuthContext(caseId: string, auth: AuthContext): void {
    if (!auth.allowed_case_ids.includes(caseId)) {
      throw new Error(`Unauthorized access to case_id: ${caseId}`);
    }
  }

  public async addEntity(entity: ENTITY_v1, auth: AuthContext): Promise<void> {
    if (!entity.case_id) {
      throw new Error(`Cannot add entity without case_id: ${entity.id}`);
    }
    this.checkAuthContext(entity.case_id, auth);

    const checkQuery = `MATCH (n {id: $id}) RETURN n.case_id AS caseId`;
    const checkRes = await this.executeCypher(checkQuery, { id: entity.id });
    
    if (checkRes.length > 0) {
      const existingCaseId = checkRes[0].get("caseId");
      if (existingCaseId !== entity.case_id) {
        throw new Error(`Entity ${entity.id} already exists in a different case. Cross-case contamination is not allowed.`);
      }
      
      const label = entity.type;
      const updateProps = { ...entity.properties };
      if (entity.event_time) updateProps.event_time = entity.event_time;
      
      const updateQuery = `MATCH (n:\`${label}\` {id: $id, case_id: $caseId}) SET n += $updateProps`;
      await this.executeCypher(updateQuery, { id: entity.id, caseId: entity.case_id, updateProps });
    } else {
      const label = entity.type;
      const props = {
        id: entity.id,
        case_id: entity.case_id,
        ...(entity.event_time ? { event_time: entity.event_time } : {}),
        ...(entity.properties || {}),
      };
      const query = `CREATE (n:\`${label}\` {id: $props.id}) SET n += $props`;
      await this.executeCypher(query, { props });
    }
  }

  public async addRelationship(rel: REL_v1, auth: AuthContext): Promise<void> {
    this.checkAuthContext(rel.case_id, auth);
    validateRelTypes([rel.type]);

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

  public async getEntity(id: string, auth: AuthContext): Promise<ENTITY_v1 | undefined> {
    const caseFilter = `AND n.case_id IN $allowedCases`;

    const query = `MATCH (n) WHERE n.id = $id ${caseFilter} RETURN n`;
    const records = await this.executeCypher(query, { 
      id, 
      allowedCases: auth.allowed_case_ids
    });
    if (records.length === 0) return undefined;

    const node = records[0].get("n").properties;
    const labels = records[0].get("n").labels;
    const entity: ENTITY_v1 = {
      ...node,
      type: labels[0] || "Unknown",
    };

    return entity;
  }

  public async getRelationship(id: string, auth: AuthContext): Promise<REL_v1 | undefined> {
    const caseFilter = `AND r.case_id IN $allowedCases`;

    const query = `MATCH ()-[r]->() WHERE r.id = $id ${caseFilter} RETURN r, startNode(r).id as source, endNode(r).id as target, type(r) as type`;
    const records = await this.executeCypher(query, { 
      id,
      allowedCases: auth.allowed_case_ids
    });
    if (records.length === 0) return undefined;

    const relProps = records[0].get("r").properties;
    const rel: REL_v1 = {
      ...relProps,
      source: records[0].get("source"),
      target: records[0].get("target"),
      type: records[0].get("type"),
    };

    return rel;
  }

  public async getAllEntitiesForCase(caseId: string, auth: AuthContext): Promise<ENTITY_v1[]> {
    this.checkAuthContext(caseId, auth);
    const query = `MATCH (n {case_id: $caseId}) RETURN n`;
    const records = await this.executeCypher(query, { caseId });
    return records.map(r => {
      const p = r.get("n").properties;
      return { ...p, type: r.get("n").labels[0] || "Unknown" } as ENTITY_v1;
    });
  }

  public async getAllRelationshipsForCase(caseId: string, auth: AuthContext): Promise<REL_v1[]> {
    this.checkAuthContext(caseId, auth);
    const query = `MATCH ()-[r {case_id: $caseId}]->() RETURN r, startNode(r).id as source, endNode(r).id as target, type(r) as type`;
    const records = await this.executeCypher(query, { caseId });
    return records.map(r => {
      const p = r.get("r").properties;
      return { ...p, source: r.get("source"), target: r.get("target"), type: r.get("type") } as REL_v1;
    });
  }

  public async getCaseGraph(caseId: string, auth: AuthContext, maxNodes: number = 1000): Promise<GRAPH_v1> {
    this.checkAuthContext(caseId, auth);
    validateBounds(maxNodes, "maxNodes");
    
    const query = `
      MATCH (n)
      WHERE n.case_id = $caseId
      WITH collect(n) AS allNodes
      WITH allNodes[0..toInteger($maxNodes)] AS selectedNodes, size(allNodes) > toInteger($maxNodes) AS truncated
      UNWIND selectedNodes AS n
      OPTIONAL MATCH (n)-[r]-(m)
      WHERE m IN selectedNodes AND r.case_id = $caseId
      RETURN 
        collect(DISTINCT n) AS nodes, 
        collect(DISTINCT r) AS edges,
        collect(DISTINCT [r, startNode(r).id, endNode(r).id, type(r)]) AS edgeDetails,
        truncated
    `;
    const records = await this.executeCypher(query, { caseId, maxNodes });
    const nodes = records[0]?.get("nodes")?.map((n: any) => ({ ...n.properties, type: n.labels?.[0] || "Unknown" })) || [];
    
    const edgeDetails = records[0]?.get("edgeDetails") || [];
    const edges = edgeDetails.filter((ed: any) => ed[0] !== null).map((ed: any) => ({
      ...ed[0].properties,
      source: ed[1],
      target: ed[2],
      type: ed[3]
    }));
    
    const truncated = records[0]?.get("truncated") || false;

    return {
      case_id: caseId,
      nodes,
      edges,
      meta: {
        truncated,
        node_count: nodes.length,
        edge_count: edges.length,
      }
    };
  }

  public async getAuthorizedAnalyticsGraph(caseId: string, auth: AuthContext): Promise<GRAPH_v1> {
    this.checkAuthContext(caseId, auth);
    
    const query = `
      MATCH (n)
      WHERE n.case_id = $caseId
      WITH collect(n) AS allNodes
      UNWIND allNodes AS n
      OPTIONAL MATCH (n)-[r]-(m)
      WHERE m IN allNodes AND r.case_id = $caseId
      RETURN 
        collect(DISTINCT n) AS nodes, 
        collect(DISTINCT r) AS edges,
        collect(DISTINCT [r, startNode(r).id, endNode(r).id, type(r)]) AS edgeDetails
    `;
    const records = await this.executeCypher(query, { caseId });
    const nodes = records[0]?.get("nodes")?.map((n: any) => ({ ...n.properties, type: n.labels?.[0] || "Unknown" })) || [];
    
    const edgeDetails = records[0]?.get("edgeDetails") || [];
    const edges = edgeDetails.filter((ed: any) => ed[0] !== null).map((ed: any) => ({
      ...ed[0].properties,
      source: ed[1],
      target: ed[2],
      type: ed[3]
    }));
    
    return {
      case_id: caseId,
      nodes,
      edges,
      meta: {
        truncated: false,
        node_count: nodes.length,
        edge_count: edges.length,
      }
    };
  }

  public async getFocusedSubgraph(options: FocusedSubgraphOptions, auth: AuthContext): Promise<GRAPH_v1> {
    this.checkAuthContext(options.case_id, auth);
    const { case_id, seed_ids, max_hops = 2, time_start, time_end, rel_types, max_nodes = 100 } = options;
    
    validateBounds(max_hops, "max_hops");
    validateBounds(max_nodes, "max_nodes");
    validateRelTypes(rel_types);

    let timeCondition = "TRUE";
    if (time_start && time_end) {
      timeCondition = `(
        (r.event_time IS NOT NULL AND r.event_time >= $time_start AND r.event_time <= $time_end) OR
        (r.effective_start IS NOT NULL AND (r.effective_end IS NULL OR r.effective_end >= $time_start) AND r.effective_start <= $time_end)
      )`;
    } else if (time_start) {
      timeCondition = `(
        (r.event_time IS NOT NULL AND r.event_time >= $time_start) OR
        (r.effective_start IS NOT NULL AND (r.effective_end IS NULL OR r.effective_end >= $time_start))
      )`;
    } else if (time_end) {
      timeCondition = `(
        (r.event_time IS NOT NULL AND r.event_time <= $time_end) OR
        (r.effective_start IS NOT NULL AND r.effective_start <= $time_end)
      )`;
    }

    const query = `
      MATCH p = (seed)-[*0..${max_hops}]-(target)
      WHERE seed.id IN $seed_ids AND seed.case_id = $case_id AND target.case_id = $case_id
      
      WITH collect(DISTINCT target) as allNodes
      WITH allNodes[0..toInteger($max_nodes)] as selectedNodes, size(allNodes) > toInteger($max_nodes) AS truncated
      
      UNWIND selectedNodes AS n
      OPTIONAL MATCH (n)-[r]-(m)
      WHERE m IN selectedNodes AND r.case_id = $case_id 
        AND ${timeCondition}
        ${rel_types && rel_types.length > 0 ? "AND type(r) IN $rel_types" : ""}
      
      RETURN 
        collect(DISTINCT n) as nodes, 
        collect(DISTINCT r) as edges,
        collect(DISTINCT [r, startNode(r).id, endNode(r).id, type(r)]) AS edgeDetails,
        truncated
    `;

    const records = await this.executeCypher(query, {
      case_id,
      seed_ids,
      time_start,
      time_end,
      rel_types: rel_types || []
    });

    const nodes = records[0]?.get("nodes")?.map((n: any) => ({ ...n.properties, type: n.labels?.[0] || "Unknown" })) || [];
    const edgeDetails = records[0]?.get("edgeDetails") || [];
    const edges = edgeDetails.filter((ed: any) => ed[0] !== null).map((ed: any) => ({
      ...ed[0].properties,
      source: ed[1],
      target: ed[2],
      type: ed[3]
    }));

    const truncated = records[0]?.get("truncated") || false;

    return {
      case_id: case_id,
      nodes,
      edges,
      meta: {
        truncated,
        node_count: nodes.length,
        edge_count: edges.length,
      }
    };
  }

  public async clear(): Promise<void> {
    await this.executeCypher(`MATCH (n) DETACH DELETE n`);
  }
}
