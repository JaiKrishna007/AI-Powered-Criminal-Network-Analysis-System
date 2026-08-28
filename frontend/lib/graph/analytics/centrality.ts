/**
 * GT-06 Centrality & Articulation Points
 * Computes betweenness centrality and articulation points on an authorized case graph.
 */

import { ENTITY_v1, REL_v1 } from "../../contracts/types.js";

export class CentralityAnalyzer {
  /**
   * Computes Brandes algorithm for Betweenness Centrality.
   */
  public calculateBetweennessCentrality(
    nodes: ENTITY_v1[],
    edges: REL_v1[]
  ): Map<string, number> {
    const cb = new Map<string, number>();
    nodes.forEach((n) => cb.set(n.id, 0));

    const adj = new Map<string, string[]>();
    nodes.forEach((n) => adj.set(n.id, []));
    for (const e of edges) {
      if (adj.has(e.source) && adj.has(e.target)) {
        adj.get(e.source)!.push(e.target);
        adj.get(e.target)!.push(e.source);
      }
    }

    const nodeIds = nodes.map((n) => n.id);

    for (const s of nodeIds) {
      const S: string[] = [];
      const P = new Map<string, string[]>();
      nodeIds.forEach((v) => P.set(v, []));

      const sigma = new Map<string, number>();
      nodeIds.forEach((v) => sigma.set(v, 0));
      sigma.set(s, 1);

      const d = new Map<string, number>();
      nodeIds.forEach((v) => d.set(v, -1));
      d.set(s, 0);

      const Q: string[] = [s];

      while (Q.length > 0) {
        const v = Q.shift()!;
        S.push(v);

        const neighbors = adj.get(v) || [];
        for (const w of neighbors) {
          if (d.get(w)! < 0) {
            Q.push(w);
            d.set(w, d.get(v)! + 1);
          }
          if (d.get(w) === d.get(v)! + 1) {
            sigma.set(w, sigma.get(w)! + sigma.get(v)!);
            P.get(w)!.push(v);
          }
        }
      }

      const delta = new Map<string, number>();
      nodeIds.forEach((v) => delta.set(v, 0));

      while (S.length > 0) {
        const w = S.pop()!;
        for (const v of P.get(w)!) {
          delta.set(
            v,
            delta.get(v)! + (sigma.get(v)! / sigma.get(w)!) * (1 + delta.get(w)!)
          );
        }
        if (w !== s) {
          cb.set(w, cb.get(w)! + delta.get(w)!);
        }
      }
    }

    // Normalize betweenness centrality for undirected graphs
    const n = nodes.length;
    if (n > 2) {
      const norm = ((n - 1) * (n - 2)) / 2;
      for (const [v, val] of cb.entries()) {
        cb.set(v, val / (2 * norm));
      }
    }

    return cb;
  }

  /**
   * Identifies Articulation Points (Cut Vertices) using Tarjan's DFS algorithm.
   */
  public findArticulationPoints(nodes: ENTITY_v1[], edges: REL_v1[]): Set<string> {
    const articulationPoints = new Set<string>();
    const adj = new Map<string, string[]>();
    nodes.forEach((n) => adj.set(n.id, []));

    for (const e of edges) {
      if (adj.has(e.source) && adj.has(e.target)) {
        adj.get(e.source)!.push(e.target);
        adj.get(e.target)!.push(e.source);
      }
    }

    const visited = new Set<string>();
    const discoveryTime = new Map<string, number>();
    const lowLink = new Map<string, number>();
    const parent = new Map<string, string | null>();
    let time = 0;

    const dfs = (u: string) => {
      let children = 0;
      visited.add(u);
      time++;
      discoveryTime.set(u, time);
      lowLink.set(u, time);

      const neighbors = adj.get(u) || [];
      for (const v of neighbors) {
        if (!visited.has(v)) {
          children++;
          parent.set(v, u);
          dfs(v);

          lowLink.set(u, Math.min(lowLink.get(u)!, lowLink.get(v)!));

          // Condition 1 for root node: root has two or more children in DFS tree
          if (parent.get(u) === null && children > 1) {
            articulationPoints.add(u);
          }

          // Condition 2 for non-root node: low value of child >= discovery time of parent
          if (parent.get(u) !== null && lowLink.get(v)! >= discoveryTime.get(u)!) {
            articulationPoints.add(u);
          }
        } else if (v !== parent.get(u)) {
          lowLink.set(u, Math.min(lowLink.get(u)!, discoveryTime.get(v)!));
        }
      }
    };

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        parent.set(node.id, null);
        dfs(node.id);
      }
    }

    return articulationPoints;
  }
}
