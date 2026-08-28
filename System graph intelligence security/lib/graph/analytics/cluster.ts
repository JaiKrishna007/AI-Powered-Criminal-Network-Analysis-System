/**
 * GT-05 Structural Connected-Component Cluster Detection
 * Detects strictly structural connected components.
 * Note: Does not use Louvain/Leiden terminology to avoid false claims of advanced modularity.
 * Resolves undirected connected components using BFS/DFS.
 */

import { ENTITY_v1, REL_v1 } from "../../contracts/types.js";

export interface ClusterResult {
  clusters: Map<number, string[]>; // Cluster ID -> Array of Node IDs
  nodeClusterMap: Map<string, number>; // Node ID -> Cluster ID
}

export class ClusterDetector {
  /**
   * Detects clusters using Connected Components algorithm.
   */
  public detectClusters(nodes: ENTITY_v1[], edges: REL_v1[]): ClusterResult {
    const adj = new Map<string, string[]>();
    nodes.forEach((n) => adj.set(n.id, []));

    for (const e of edges) {
      if (adj.has(e.source) && adj.has(e.target)) {
        adj.get(e.source)!.push(e.target);
        adj.get(e.target)!.push(e.source);
      }
    }

    const visited = new Set<string>();
    const clusters = new Map<number, string[]>();
    const nodeClusterMap = new Map<string, number>();
    let clusterId = 0;

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        const clusterNodes: string[] = [];
        const queue: string[] = [node.id];
        visited.add(node.id);

        while (queue.length > 0) {
          const curr = queue.shift()!;
          clusterNodes.push(curr);
          nodeClusterMap.set(curr, clusterId);

          const neighbors = adj.get(curr) || [];
          for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
              visited.add(neighbor);
              queue.push(neighbor);
            }
          }
        }

        clusters.set(clusterId, clusterNodes);
        clusterId++;
      }
    }

    return { clusters, nodeClusterMap };
  }
}
