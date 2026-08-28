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
    
    // Default to Neo4j if provided and connected, otherwise InMemory
    if (!forceInMemory && neo4jService && neo4jService.isConnected()) {
      this.repository = neo4jService;
      this.neo4jActive = true;
    } else {
      this.repository = new InMemoryGraphRepository(logger);
      this.neo4jActive = false;
    }
  }

  public isNeo4jActive(): boolean {
    return this.neo4jActive;
  }

  public async addEntity(entity: ENTITY_v1, auth?: AuthContext): Promise<void> {
    return this.repository.addEntity(entity, auth);
  }

  public async addRelationship(rel: REL_v1, auth?: AuthContext): Promise<void> {
    return this.repository.addRelationship(rel, auth);
  }

  public async getEntity(id: string, auth?: AuthContext): Promise<ENTITY_v1 | undefined> {
    return this.repository.getEntity(id, auth);
  }

  public async getRelationship(id: string, auth?: AuthContext): Promise<REL_v1 | undefined> {
    return this.repository.getRelationship(id, auth);
  }

  public async getAllEntitiesForCase(caseId: string, auth?: AuthContext): Promise<ENTITY_v1[]> {
    return this.repository.getAllEntitiesForCase(caseId, auth);
  }

  public async getAllRelationshipsForCase(caseId: string, auth?: AuthContext): Promise<REL_v1[]> {
    return this.repository.getAllRelationshipsForCase(caseId, auth);
  }

  public async getGraphForCase(
    caseId: string,
    auth?: AuthContext,
    maxNodes: number = 1000
  ): Promise<GRAPH_v1> {
    return this.repository.getCaseGraph(caseId, auth, maxNodes);
  }

  public async extractFocusedSubgraph(options: FocusedSubgraphOptions, auth?: AuthContext): Promise<GRAPH_v1> {
    return this.repository.getFocusedSubgraph(options, auth);
  }

  public async clear(): Promise<void> {
    return this.repository.clear();
  }
}
