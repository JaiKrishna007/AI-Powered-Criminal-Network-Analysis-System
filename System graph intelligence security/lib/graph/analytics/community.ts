/**
 * GT-05 Community Detection
 * Implements Connected-component based structural clustering.
 * This is an MVP approximation of Louvain/Leiden modularity algorithms.
 * Resolves undirected connected components using BFS/DFS.
 */

import { ENTITY_v1, REL_v1 } from "../../contracts/types.js";

export interface CommunityResult {
  communities: Map<number, string[]>; // Community ID -> Array of Node IDs
  nodeCommunityMap: Map<string, number>; // Node ID -> Community ID
}

export class CommunityDetector {
  /**
   * Detects communities using Connected Components algorithm.
   */
  public detectCommunities(nodes: ENTITY_v1[], edges: REL_v1[]): CommunityResult {
    const adj = new Map<string, string[]>();
    nodes.forEach((n) => adj.set(n.id, []));

    for (const e of edges) {
      if (adj.has(e.source) && adj.has(e.target)) {
        adj.get(e.source)!.push(e.target);
        adj.get(e.target)!.push(e.source);
      }
    }

    const visited = new Set<string>();
    const communities = new Map<number, string[]>();
    const nodeCommunityMap = new Map<string, number>();
    let communityId = 0;

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        const communityNodes: string[] = [];
        const queue: string[] = [node.id];
        visited.add(node.id);

        while (queue.length > 0) {
          const curr = queue.shift()!;
          communityNodes.push(curr);
          nodeCommunityMap.set(curr, communityId);

          const neighbors = adj.get(curr) || [];
          for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
              visited.add(neighbor);
              queue.push(neighbor);
            }
          }
        }

        communities.set(communityId, communityNodes);
        communityId++;
      }
    }

    return { communities, nodeCommunityMap };
  }
}
