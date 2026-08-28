import { GraphContextClient } from './client';
import { AuthContext } from '../../../../../shared-contracts';

/**
 * Retrieve a dynamic subgraph around a specific entity
 */
export async function getEntitySubgraph(entityId: string, depth: number = 2, authContext: AuthContext, signature: string) {
  // Use D4 GraphClient instead of direct Cypher
  const graph = await GraphContextClient.getFocusedGraph(authContext, signature, entityId, depth);
  return graph;
}

/**
 * Find shortest path between two entities
 * (No longer supported directly in D3, must call D4 if needed. Currently returning empty.)
 */
export async function getShortestPath(sourceId: string, targetId: string) {
  throw new Error('Shortest path must be implemented via D4 GraphClient if required.');
}
