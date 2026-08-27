/**
 * Abstraction layer for Graph Access and Operations.
 * Supports both deterministic in-memory storage (for offline/acceptance tests)
 * and Neo4j-backed operations when configured.
 */

import {
  ENTITY_v1,
  REL_v1,
  GRAPH_v1,
  AuthContext,
  RelationshipType,
} from "../contracts/types.js";
import { Neo4jGraphService } from "./neo4j.js";
import { AuditLogger } from "../audit/audit_logger.js";

export interface GraphTraversalOptions {
  case_id: string;
  seed_ids: string[];
  max_hops?: number;
  time_start?: string; // ISO-8601 UTC
  time_end?: string; // ISO-8601 UTC
  rel_types?: RelationshipType[];
  max_nodes?: number;
}

export class GraphStore {
  private nodes: Map<string, ENTITY_v1> = new Map();
  private edges: Map<string, REL_v1> = new Map();
  private neo4jService: Neo4jGraphService | null = null;
  private auditLogger: AuditLogger;

  constructor(auditLogger?: AuditLogger, neo4jService?: Neo4jGraphService) {
    this.auditLogger = auditLogger || new AuditLogger();
    this.neo4jService = neo4jService || new Neo4jGraphService();
  }

  public isNeo4jActive(): boolean {
    return this.neo4jService?.isConnected() ?? false;
  }

  public addEntity(entity: ENTITY_v1, auth?: AuthContext): void {
    if (auth && entity.case_id && !auth.allowed_case_ids.includes(entity.case_id)) {
      this.auditLogger.log(
        auth.actor_id,
        "ADD_ENTITY",
        "GRAPH",
        entity.id,
        "DENIED",
        auth.correlation_id,
        { reason: "Unauthorized case_id", case_id: entity.case_id }
      );
      throw new Error(`Unauthorized access to case_id: ${entity.case_id}`);
    }

    this.nodes.set(entity.id, entity);

    if (auth) {
      this.auditLogger.log(
        auth.actor_id,
        "ADD_ENTITY",
        "GRAPH",
        entity.id,
        "SUCCESS",
        auth.correlation_id
      );
    }
  }

  public addRelationship(rel: REL_v1, auth?: AuthContext): void {
    if (auth && !auth.allowed_case_ids.includes(rel.case_id)) {
      this.auditLogger.log(
        auth.actor_id,
        "ADD_RELATIONSHIP",
        "GRAPH",
        rel.id,
        "DENIED",
        auth.correlation_id,
        { reason: "Unauthorized case_id", case_id: rel.case_id }
      );
      throw new Error(`Unauthorized access to case_id: ${rel.case_id}`);
    }

    this.edges.set(rel.id, rel);

    if (auth) {
      this.auditLogger.log(
        auth.actor_id,
        "ADD_RELATIONSHIP",
        "GRAPH",
        rel.id,
        "SUCCESS",
        auth.correlation_id
      );
    }
  }

  public getEntity(id: string): ENTITY_v1 | undefined {
    return this.nodes.get(id);
  }

  public getRelationship(id: string): REL_v1 | undefined {
    return this.edges.get(id);
  }

  public getAllEntitiesForCase(caseId: string, auth?: AuthContext): ENTITY_v1[] {
    if (auth && !auth.allowed_case_ids.includes(caseId)) {
      this.auditLogger.log(
        auth.actor_id,
        "GET_ENTITIES",
        "GRAPH",
        caseId,
        "DENIED",
        auth.correlation_id,
        { reason: "Unauthorized case_id" }
      );
      throw new Error(`Unauthorized access to case_id: ${caseId}`);
    }

    return Array.from(this.nodes.values()).filter(
      (n) => n.case_id === caseId || !n.case_id
    );
  }

  public getAllRelationshipsForCase(caseId: string, auth?: AuthContext): REL_v1[] {
    if (auth && !auth.allowed_case_ids.includes(caseId)) {
      this.auditLogger.log(
        auth.actor_id,
        "GET_RELATIONSHIPS",
        "GRAPH",
        caseId,
        "DENIED",
        auth.correlation_id,
        { reason: "Unauthorized case_id" }
      );
      throw new Error(`Unauthorized access to case_id: ${caseId}`);
    }

    return Array.from(this.edges.values()).filter((e) => e.case_id === caseId);
  }

  public getGraphForCase(
    caseId: string,
    auth?: AuthContext,
    maxNodes: number = 1000
  ): GRAPH_v1 {
    if (auth && !auth.allowed_case_ids.includes(caseId)) {
      this.auditLogger.log(
        auth.actor_id,
        "GET_GRAPH",
        "GRAPH",
        caseId,
        "DENIED",
        auth.correlation_id,
        { reason: "Unauthorized case_id" }
      );
      throw new Error(`Unauthorized access to case_id: ${caseId}`);
    }

    const caseNodes = this.getAllEntitiesForCase(caseId);
    const totalNodeCount = caseNodes.length;
    const truncated = totalNodeCount > maxNodes;
    const slicedNodes = caseNodes.slice(0, maxNodes);
    const slicedNodeIds = new Set(slicedNodes.map((n) => n.id));

    const caseEdges = Array.from(this.edges.values()).filter(
      (e) => e.case_id === caseId && slicedNodeIds.has(e.source) && slicedNodeIds.has(e.target)
    );

    if (auth) {
      this.auditLogger.log(
        auth.actor_id,
        "GET_GRAPH",
        "GRAPH",
        caseId,
        "SUCCESS",
        auth.correlation_id,
        { node_count: slicedNodes.length, edge_count: caseEdges.length, truncated }
      );
    }

    return {
      case_id: caseId,
      nodes: slicedNodes,
      edges: caseEdges,
      meta: {
        truncated,
        node_count: slicedNodes.length,
        edge_count: caseEdges.length,
      },
    };
  }

  public clear(): void {
    this.nodes.clear();
    this.edges.clear();
  }
}
