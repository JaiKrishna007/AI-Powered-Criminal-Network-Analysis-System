import {
  ENTITY_v1,
  REL_v1,
  GRAPH_v1,
  AuthContext,
} from "../contracts/types.js";
import { GraphRepository } from "./repository.js";
import { AuditLogger } from "../audit/audit_logger.js";
import { FocusedSubgraphOptions, FocusedSubgraphExtractor } from "./focused_subgraph.js";

export class InMemoryGraphRepository implements GraphRepository {
  private nodes: Map<string, ENTITY_v1> = new Map();
  private edges: Map<string, REL_v1> = new Map();
  private auditLogger: AuditLogger;

  constructor(auditLogger?: AuditLogger) {
    this.auditLogger = auditLogger || new AuditLogger();
  }

  public async addEntity(entity: ENTITY_v1, auth: AuthContext): Promise<void> {
    if (!entity.case_id) {
      throw new Error(`Cannot add entity without case_id: ${entity.id}`);
    }
    if (!auth.allowed_case_ids.includes(entity.case_id)) {
      await this.auditLogger.log(
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

    const existingNode = this.nodes.get(entity.id);
    if (existingNode && existingNode.case_id !== entity.case_id) {
      throw new Error(`Entity ${entity.id} already exists in a different case. Cross-case contamination is not allowed.`);
    }

    if (existingNode) {
      this.nodes.set(entity.id, {
        ...existingNode,
        ...entity,
        case_id: existingNode.case_id
      });
    } else {
      this.nodes.set(entity.id, entity);
    }

    await this.auditLogger.log(
      auth.actor_id,
      "ADD_ENTITY",
      "GRAPH",
      entity.id,
      "SUCCESS",
      auth.correlation_id
    );
  }

  public async addRelationship(rel: REL_v1, auth: AuthContext): Promise<void> {
    if (!rel.case_id) {
      throw new Error(`Cannot add relationship without case_id: ${rel.id}`);
    }

    const ALLOWED_RELATIONSHIP_TYPES = new Set([
      "CALLED", "TRANSFERRED_MONEY", "USED", "OWNED", "VISITED", 
      "MET_AT", "TRAVELED_WITH", "LINKED_TO", "ASSOCIATED_WITH", "PART_OF_CASE"
    ]);

    if (!ALLOWED_RELATIONSHIP_TYPES.has(rel.type)) {
      throw new Error(`Invalid relationship type: ${rel.type}`);
    }

    if (!auth.allowed_case_ids.includes(rel.case_id)) {
      await this.auditLogger.log(
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

    let sourceNode = this.nodes.get(rel.source);
    if (!sourceNode) {
      sourceNode = {
        id: rel.source,
        type: 'UNKNOWN',
        case_id: rel.case_id,
        name: 'Placeholder',
        properties: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      this.nodes.set(rel.source, sourceNode);
    }

    let targetNode = this.nodes.get(rel.target);
    if (!targetNode) {
      targetNode = {
        id: rel.target,
        type: 'UNKNOWN',
        case_id: rel.case_id,
        name: 'Placeholder',
        properties: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      this.nodes.set(rel.target, targetNode);
    }

    if (sourceNode.case_id !== rel.case_id || targetNode.case_id !== rel.case_id) {
      await this.auditLogger.log(
        auth.actor_id,
        "ADD_RELATIONSHIP",
        "GRAPH",
        rel.id,
        "DENIED",
        auth.correlation_id,
        { reason: "Cross-case relationship violation" }
      );
      throw new Error(`Cannot add relationship: Source or target case_id mismatch.`);
    }

    this.edges.set(rel.id, rel);

    await this.auditLogger.log(
      auth.actor_id,
      "ADD_RELATIONSHIP",
      "GRAPH",
      rel.id,
      "SUCCESS",
      auth.correlation_id
    );
  }

  public async getEntity(id: string, auth: AuthContext): Promise<ENTITY_v1 | undefined> {
    const node = this.nodes.get(id);
    if (node && node.case_id && !auth.allowed_case_ids.includes(node.case_id)) {
      throw new Error(`Unauthorized access to case_id: ${node.case_id}`);
    }
    return node;
  }

  public async getRelationship(id: string, auth: AuthContext): Promise<REL_v1 | undefined> {
    const edge = this.edges.get(id);
    if (edge && !auth.allowed_case_ids.includes(edge.case_id)) {
      throw new Error(`Unauthorized access to case_id: ${edge.case_id}`);
    }
    return edge;
  }

  public async getAllEntitiesForCase(caseId: string, auth: AuthContext): Promise<ENTITY_v1[]> {
    if (!auth.allowed_case_ids.includes(caseId)) {
      await this.auditLogger.log(
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
      (n) => n.case_id === caseId
    );
  }

  public async getAllRelationshipsForCase(caseId: string, auth: AuthContext): Promise<REL_v1[]> {
    if (!auth.allowed_case_ids.includes(caseId)) {
      await this.auditLogger.log(
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

  public async getCaseGraph(
    caseId: string,
    auth: AuthContext,
    maxNodes: number = 1000
  ): Promise<GRAPH_v1> {
    const caseNodes = await this.getAllEntitiesForCase(caseId, auth);
    const totalNodeCount = caseNodes.length;
    const truncated = totalNodeCount > maxNodes;
    const slicedNodes = caseNodes.slice(0, maxNodes);
    const slicedNodeIds = new Set(slicedNodes.map((n) => n.id));

    const allEdges = await this.getAllRelationshipsForCase(caseId, auth);
    const caseEdges = allEdges.filter(
      (e) => slicedNodeIds.has(e.source) && slicedNodeIds.has(e.target)
    );

    await this.auditLogger.log(
      auth.actor_id,
      "GET_GRAPH",
      "GRAPH",
      caseId,
      "SUCCESS",
      auth.correlation_id,
      { node_count: slicedNodes.length, edge_count: caseEdges.length, truncated }
    );

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

  public async getAuthorizedAnalyticsGraph(caseId: string, auth: AuthContext): Promise<GRAPH_v1> {
    const caseNodes = await this.getAllEntitiesForCase(caseId, auth);
    const caseEdges = await this.getAllRelationshipsForCase(caseId, auth);

    await this.auditLogger.log(
      auth.actor_id,
      "GET_ANALYTICS_GRAPH",
      "GRAPH",
      caseId,
      "SUCCESS",
      auth.correlation_id,
      { node_count: caseNodes.length, edge_count: caseEdges.length }
    );

    return {
      case_id: caseId,
      nodes: caseNodes,
      edges: caseEdges,
      meta: {
        truncated: false,
        node_count: caseNodes.length,
        edge_count: caseEdges.length,
      },
    };
  }

  public async getFocusedSubgraph(options: FocusedSubgraphOptions, auth: AuthContext): Promise<GRAPH_v1> {
    const extractor = new FocusedSubgraphExtractor(this);
    return await extractor.extractFocusedSubgraph(options, auth);
  }

  public async clear(): Promise<void> {
    this.nodes.clear();
    this.edges.clear();
  }
}
