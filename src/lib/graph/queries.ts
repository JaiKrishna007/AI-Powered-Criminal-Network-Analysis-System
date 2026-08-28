import { runCypherQuery } from './neo4j';

/**
 * Retrieve a dynamic subgraph around a specific entity
 */
export async function getEntitySubgraph(entityId: string, depth: number = 2) {
  const query = `
    MATCH path = (e:Entity {id: $entityId})-[*1..${depth}]-(connected:Entity)
    RETURN path
  `;
  const result = await runCypherQuery(query, { entityId });
  
  // Parse Neo4j path objects into a flat nodes/edges structure for UI
  const nodes = new Map();
  const edges = new Map();

  for (const record of result.records) {
    const path = record.get('path');
    for (const segment of path.segments) {
      // Add start node
      const start = segment.start;
      nodes.set(start.properties.id, start.properties);
      
      // Add end node
      const end = segment.end;
      nodes.set(end.properties.id, end.properties);
      
      // Add relationship
      const rel = segment.relationship;
      edges.set(rel.properties.id, {
        id: rel.properties.id,
        type: rel.type,
        source: start.properties.id,
        target: end.properties.id,
        confidence: rel.properties.confidence,
      });
    }
  }

  return {
    nodes: Array.from(nodes.values()),
    edges: Array.from(edges.values())
  };
}

/**
 * Find shortest path between two entities
 */
export async function getShortestPath(sourceId: string, targetId: string) {
  const query = `
    MATCH path = shortestPath((src:Entity {id: $sourceId})-[*]-(tgt:Entity {id: $targetId}))
    RETURN path
  `;
  const result = await runCypherQuery(query, { sourceId, targetId });
  
  if (result.records.length === 0) {
    return { nodes: [], edges: [] };
  }

  const nodes = new Map();
  const edges = new Map();
  const path = result.records[0].get('path');

  for (const segment of path.segments) {
    const start = segment.start;
    nodes.set(start.properties.id, start.properties);
    
    const end = segment.end;
    nodes.set(end.properties.id, end.properties);
    
    const rel = segment.relationship;
    edges.set(rel.properties.id, {
      id: rel.properties.id,
      type: rel.type,
      source: start.properties.id,
      target: end.properties.id,
    });
  }

  return {
    nodes: Array.from(nodes.values()),
    edges: Array.from(edges.values())
  };
}
