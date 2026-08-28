/**
 * Neo4j Graph Intelligence & Mapping Layer
 * Environment-based configuration for Neo4j driver with Cypher builders
 * for canonical contract objects (ENTITY.v1, REL.v1).
 */

import neo4j, { Driver, Session } from "neo4j-driver";
import { ENTITY_v1, REL_v1 } from "../contracts/types.js";

export class Neo4jGraphService {
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

  /**
   * Generates Cypher MERGE query for an ENTITY.v1 node.
   */
  public buildEntityCypher(entity: ENTITY_v1): { query: string; params: Record<string, any> } {
    const label = entity.type;
    const props: Record<string, any> = {
      id: entity.id,
      case_id: entity.case_id || "",
      ...(entity.event_time ? { event_time: entity.event_time } : {}),
      ...(entity.properties || {}),
    };

    const query = `MERGE (n:${label} {id: $props.id}) SET n += $props RETURN n;`;
    return { query, params: { props } };
  }

  /**
   * Generates Cypher MERGE query for a REL.v1 relationship.
   */
  public buildRelCypher(rel: REL_v1): { query: string; params: Record<string, any> } {
    const relType = rel.type;
    const props: Record<string, any> = {
      id: rel.id,
      case_id: rel.case_id,
      evidence_ids: rel.evidence_ids || [],
      ...(rel.event_time ? { event_time: rel.event_time } : {}),
      ...(rel.effective_start ? { effective_start: rel.effective_start } : {}),
      ...(rel.effective_end ? { effective_end: rel.effective_end } : {}),
      ...(rel.properties || {}),
    };

    const query = `
      MATCH (source {id: $sourceId})
      MATCH (target {id: $targetId})
      MERGE (source)-[r:${relType} {id: $props.id}]->(target)
      SET r += $props
      RETURN r;
    `;

    return {
      query,
      params: {
        sourceId: rel.source,
        targetId: rel.target,
        props,
      },
    };
  }

  /**
   * Executes Cypher query if Neo4j driver is active.
   */
  public async executeCypher(cypher: string, params: Record<string, any> = {}): Promise<any[]> {
    if (!this.driver) {
      throw new Error("Neo4j driver is not connected. Use in-memory store mode for testing.");
    }
    const session: Session = this.driver.session();
    try {
      const result = await session.run(cypher, params);
      return result.records;
    } finally {
      await session.close();
    }
  }
}
