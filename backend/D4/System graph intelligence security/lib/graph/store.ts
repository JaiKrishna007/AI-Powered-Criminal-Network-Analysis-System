/**
 * Abstraction layer for Graph Access and Operations.
 * Wraps the GraphRepository interface, routing calls to Neo4jGraphRepository (production)
 * or InMemoryGraphRepository (testing/fallback).
 */

import {
  ENTITY_v1,
  REL_v1,
  GRAPH_v1,
  AuthContext,
} from "../contracts/types.js";
import { GraphRepository } from "./repository.js";
import { InMemoryGraphRepository } from "./in_memory_repository.js";
import { Neo4jGraphRepository } from "./neo4j.js";
import { AuditLogger } from "../audit/audit_logger.js";
import { FocusedSubgraphOptions } from "./focused_subgraph.js";

export class GraphStore {
  private repository: GraphRepository;
  private neo4jActive: boolean;

  constructor(auditLogger?: AuditLogger, neo4jService?: Neo4jGraphRepository, forceInMemory: boolean = false) {
    const logger = auditLogger || new AuditLogger();
    
    const backend = process.env.GRAPH_BACKEND || (forceInMemory ? "memory" : "neo4j");

    if (backend === "neo4j") {
      const neo = neo4jService || new Neo4jGraphRepository(
        process.env.NEO4J_URI || "bolt://localhost:7687",
        process.env.NEO4J_USER || "neo4j",
        process.env.NEO4J_PASSWORD || "password"
      );
      if (neo && neo.isConnected()) {
        this.repository = neo;
        this.neo4jActive = true;
      } else {
        throw new Error("DATABASE_UNAVAILABLE: Neo4j is configured as the backend but is not connected.");
      }
    } else {
      this.repository = new InMemoryGraphRepository(logger);
      this.neo4jActive = false;
    }
  }

  public isNeo4jActive(): boolean {
    return this.neo4jActive;
  }

  public async addEntity(entity: ENTITY_v1, auth: AuthContext): Promise<void> {
    return this.repository.addEntity(entity, auth);
  }

  public async addRelationship(rel: REL_v1, auth: AuthContext): Promise<void> {
    return this.repository.addRelationship(rel, auth);
  }

  public async getEntity(id: string, auth: AuthContext): Promise<ENTITY_v1 | undefined> {
    return this.repository.getEntity(id, auth);
  }

  public async getRelationship(id: string, auth: AuthContext): Promise<REL_v1 | undefined> {
    return this.repository.getRelationship(id, auth);
  }

  public async getAllEntitiesForCase(caseId: string, auth: AuthContext): Promise<ENTITY_v1[]> {
    return this.repository.getAllEntitiesForCase(caseId, auth);
  }

  public async getAllRelationshipsForCase(caseId: string, auth: AuthContext): Promise<REL_v1[]> {
    return this.repository.getAllRelationshipsForCase(caseId, auth);
  }

  public async getGraphForCase(
    caseId: string,
    auth: AuthContext,
    maxNodes: number = 1000
  ): Promise<GRAPH_v1> {
    return this.repository.getCaseGraph(caseId, auth, maxNodes);
  }

  public async getAuthorizedAnalyticsGraph(caseId: string, auth: AuthContext): Promise<GRAPH_v1> {
    return this.repository.getAuthorizedAnalyticsGraph(caseId, auth);
  }

  public async extractFocusedSubgraph(options: FocusedSubgraphOptions, auth: AuthContext): Promise<GRAPH_v1> {
    return this.repository.getFocusedSubgraph(options, auth);
  }

  public async clear(): Promise<void> {
    return this.repository.clear();
  }
}
