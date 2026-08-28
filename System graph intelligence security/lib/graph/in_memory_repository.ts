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

  public async addEntity(entity: ENTITY_v1, auth?: AuthContext): Promise<void> {
    if (!entity.case_id) {
      throw new Error(`Cannot add entity without case_id: ${entity.id}`);
    }
    if (auth && !auth.allowed_case_ids.includes(entity.case_id)) {
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

    this.nodes.set(entity.id, entity);

    if (auth) {
      await this.auditLogger.log(
        auth.actor_id,
        "ADD_ENTITY",
        "GRAPH",
        entity.id,
        "SUCCESS",
        auth.correlation_id
      );
    }
  }

  public async addRelationship(rel: REL_v1, auth?: AuthContext): Promise<void> {
    if (!rel.case_id) {
      throw new Error(`Cannot add relationship without case_id: ${rel.id}`);
    }
    if (auth && !auth.allowed_case_ids.includes(rel.case_id)) {
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

    const sourceNode = this.nodes.get(rel.source);
    const targetNode = this.nodes.get(rel.target);

    if (!sourceNode || !targetNode) {
      if (auth) {
        await this.auditLogger.log(
          auth.actor_id,
          "ADD_RELATIONSHIP",
          "GRAPH",
          rel.id,
          "DENIED",
          auth.correlation_id,
          { reason: "Nodes do not exist", source: rel.source, target: rel.target }
        );
      }
      throw new Error(`Cannot add relationship: Source or target node does not exist.`);
    }

    if (sourceNode.case_id !== rel.case_id || targetNode.case_id !== rel.case_id) {
      if (auth) {
        await this.auditLogger.log(
          auth.actor_id,
          "ADD_RELATIONSHIP",
          "GRAPH",
          rel.id,
          "DENIED",
          auth.correlation_id,
          { reason: "Cross-case relationship violation" }
        );
      }
      throw new Error(`Cannot add relationship: Source or target case_id mismatch.`);
    }

    this.edges.set(rel.id, rel);

    if (auth) {
      await this.auditLogger.log(
        auth.actor_id,
        "ADD_RELATIONSHIP",
        "GRAPH",
        rel.id,
        "SUCCESS",
        auth.correlation_id
      );
    }
  }

  public async getEntity(id: string, auth?: AuthContext): Promise<ENTITY_v1 | undefined> {
    const node = this.nodes.get(id);
    if (node && auth && node.case_id && !auth.allowed_case_ids.includes(node.case_id)) {
      throw new Error(`Unauthorized access to case_id: ${node.case_id}`);
    }
    return node;
  }

  public async getRelationship(id: string, auth?: AuthContext): Promise<REL_v1 | undefined> {
    const edge = this.edges.get(id);
    if (edge && auth && !auth.allowed_case_ids.includes(edge.case_id)) {
      throw new Error(`Unauthorized access to case_id: ${edge.case_id}`);
    }
    return edge;
  }

  public async getAllEntitiesForCase(caseId: string, auth?: AuthContext): Promise<ENTITY_v1[]> {
    if (auth && !auth.allowed_case_ids.includes(caseId)) {
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

  public async getAllRelationshipsForCase(caseId: string, auth?: AuthContext): Promise<REL_v1[]> {
    if (auth && !auth.allowed_case_ids.includes(caseId)) {
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
    auth?: AuthContext,
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

    if (auth) {
      await this.auditLogger.log(
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

  public async getFocusedSubgraph(options: FocusedSubgraphOptions, auth?: AuthContext): Promise<GRAPH_v1> {
    const extractor = new FocusedSubgraphExtractor(this);
    return await extractor.extractFocusedSubgraph(options, auth);
  }

  public async clear(): Promise<void> {
    this.nodes.clear();
    this.edges.clear();
  }
}
