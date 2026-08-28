import { getNeo4jDriver, runCypherQuery } from './neo4j';
import { EntityV1, RelV1 } from '../contracts';

export async function setupNeo4jSchema() {
  const queries = [
    // Constraints for uniqueness
    `CREATE CONSTRAINT IF NOT EXISTS FOR (e:Entity) REQUIRE e.id IS UNIQUE`,
    `CREATE CONSTRAINT IF NOT EXISTS FOR (c:Case) REQUIRE c.id IS UNIQUE`,
    // Indexes for fast lookup
    `CREATE INDEX IF NOT EXISTS FOR (e:Entity) ON (e.type)`,
    `CREATE INDEX IF NOT EXISTS FOR (e:Entity) ON (e.canonical_name)`
  ];

  for (const q of queries) {
    try {
      await runCypherQuery(q);
      console.log(`Executed: ${q}`);
    } catch (err: any) {
      console.error(`Failed to execute: ${q}`, err);
    }
  }
}

/**
 * Ingest resolved entities and relationships into Neo4j
 */
export async function ingestGraphData(entities: EntityV1[], relationships: RelV1[], caseId: string) {
  const driver = getNeo4jDriver();
  const session = driver.session();

  try {
    const tx = session.beginTransaction();
    
    // Ensure case node exists
    await tx.run(
      `MERGE (c:Case {id: $caseId})`,
      { caseId }
    );

    // Merge Entities
    for (const ent of entities) {
      await tx.run(
        `
        MERGE (e:Entity {id: $id})
        SET e.type = $type, 
            e.canonical_name = $canonical_name,
            e.aliases = $aliases,
            e.confidence = $confidence
        MERGE (c:Case {id: $caseId})
        MERGE (e)-[:PART_OF_CASE]->(c)
        `,
        { ...ent, caseId }
      );
    }

    // Merge Relationships
    for (const rel of relationships) {
      // Create directed relationship with dynamic type
      // Cypher requires APOC or string building for dynamic relationship types
      // For the prototype, we build the string safely since types are locked enum
      const query = `
        MATCH (src:Entity {id: $source}), (tgt:Entity {id: $target})
        MERGE (src)-[r:${rel.type} {id: $id}]->(tgt)
        SET r.confidence = $confidence, r.evidence_ids = $evidence_ids
      `;
      await tx.run(query, { ...rel });
    }

    await tx.commit();
    console.log(`Ingested ${entities.length} entities and ${relationships.length} relationships to Neo4j`);
  } catch (error) {
    console.error("Error ingesting to Neo4j:", error);
  } finally {
    await session.close();
  }
}
