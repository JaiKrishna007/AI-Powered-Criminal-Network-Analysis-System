/**
 * GT-02 Focused Subgraph Extractor
 * Deterministic graph traversal based on seed distance & node degree.
 * Enforces case/authorization context, hop limit, time limit, relationship-type limits,
 * and maximum node bounds with accurate truncation metadata.
 */

import {
  GRAPH_v1,
  ENTITY_v1,
  REL_v1,
  AuthContext,
  RelationshipType,
} from "../contracts/types.js";
import { GraphStore } from "./store.js";

export interface FocusedSubgraphOptions {
  case_id: string;
  seed_ids: string[];
  max_hops?: number;
  time_start?: string; // ISO-8601 UTC
  time_end?: string; // ISO-8601 UTC
  rel_types?: RelationshipType[];
  max_nodes?: number;
}

export class FocusedSubgraphExtractor {
  constructor(private store: GraphStore) {}

  public extractFocusedSubgraph(
    options: FocusedSubgraphOptions,
    auth?: AuthContext
  ): GRAPH_v1 {
    const {
      case_id,
      seed_ids,
      max_hops = 2,
      time_start,
      time_end,
      rel_types,
      max_nodes = 100,
    } = options;

    // Check auth context for case access
    if (auth && !auth.allowed_case_ids.includes(case_id)) {
      throw new Error(`Unauthorized access to case_id: ${case_id}`);
    }

    const caseEntities = this.store.getAllEntitiesForCase(case_id);
    const caseEntityMap = new Map(caseEntities.map((e) => [e.id, e]));

    // Filter relationships based on time limits and relationship types
    let caseEdges = this.store.getAllRelationshipsForCase(case_id);

    if (rel_types && rel_types.length > 0) {
      const typeSet = new Set(rel_types);
      caseEdges = caseEdges.filter((e) => typeSet.has(e.type));
    }

    if (time_start || time_end) {
      caseEdges = caseEdges.filter((e) => {
        if (!e.event_time) return false; // Exclude or require explicit timestamp when time filter applied
        if (time_start && e.event_time < time_start) return false;
        if (time_end && e.event_time > time_end) return false;
        return true;
      });
    }

    // Build adjacency list
    const adj = new Map<string, Array<{ neighborId: string; edge: REL_v1 }>>();
    for (const edge of caseEdges) {
      if (!adj.has(edge.source)) adj.set(edge.source, []);
      if (!adj.has(edge.target)) adj.set(edge.target, []);
      adj.get(edge.source)!.push({ neighborId: edge.target, edge });
      adj.get(edge.target)!.push({ neighborId: edge.source, edge });
    }

    // Multi-seed BFS traversal keeping track of seed distance
    const nodeDistanceMap = new Map<string, number>();
    const traversedNodeIds = new Set<string>();
    const traversedEdgesMap = new Map<string, REL_v1>();

    const queue: Array<{ id: string; dist: number }> = [];

    for (const seedId of seed_ids) {
      if (caseEntityMap.has(seedId)) {
        nodeDistanceMap.set(seedId, 0);
        traversedNodeIds.add(seedId);
        queue.push({ id: seedId, dist: 0 });
      }
    }

    while (queue.length > 0) {
      const { id, dist } = queue.shift()!;
      if (dist >= max_hops) continue;

      const neighbors = adj.get(id) || [];
      for (const { neighborId, edge } of neighbors) {
        if (!caseEntityMap.has(neighborId)) continue;

        traversedEdgesMap.set(edge.id, edge);

        if (!nodeDistanceMap.has(neighborId)) {
          nodeDistanceMap.set(neighborId, dist + 1);
          traversedNodeIds.add(neighborId);
          queue.push({ id: neighborId, dist: dist + 1 });
        }
      }
    }

    const allTraversedNodes = Array.from(traversedNodeIds)
      .map((id) => caseEntityMap.get(id)!)
      .filter(Boolean);

    // Calculate node degrees for deterministic ranking
    const nodeDegreeMap = new Map<string, number>();
    for (const edge of traversedEdgesMap.values()) {
      nodeDegreeMap.set(edge.source, (nodeDegreeMap.get(edge.source) || 0) + 1);
      nodeDegreeMap.set(edge.target, (nodeDegreeMap.get(edge.target) || 0) + 1);
    }

    // Rank nodes deterministically: primary sort by seed distance (asc), secondary by degree (desc), tertiary by ID (asc)
    allTraversedNodes.sort((a, b) => {
      const distA = nodeDistanceMap.get(a.id) ?? Infinity;
      const distB = nodeDistanceMap.get(b.id) ?? Infinity;
      if (distA !== distB) return distA - distB;

      const degA = nodeDegreeMap.get(a.id) ?? 0;
      const degB = nodeDegreeMap.get(b.id) ?? 0;
      if (degA !== degB) return degB - degA;

      return a.id.localeCompare(b.id);
    });

    const totalNodeCount = allTraversedNodes.length;
    const truncated = totalNodeCount > max_nodes;
    const selectedNodes = allTraversedNodes.slice(0, max_nodes);
    const selectedNodeIds = new Set(selectedNodes.map((n) => n.id));

    // Filter edges connecting selected nodes
    const selectedEdges = Array.from(traversedEdgesMap.values()).filter(
      (e) => selectedNodeIds.has(e.source) && selectedNodeIds.has(e.target)
    );

    return {
      case_id,
      nodes: selectedNodes,
      edges: selectedEdges,
      meta: {
        truncated,
        node_count: selectedNodes.length,
        edge_count: selectedEdges.length,
      },
    };
  }
}
