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
import { GraphRepository } from "./repository.js";

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
  constructor(private store: GraphRepository) {}

  public async extractFocusedSubgraph(
    options: FocusedSubgraphOptions,
    auth: AuthContext
  ): Promise<GRAPH_v1> {
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
    if (!auth.allowed_case_ids.includes(case_id)) {
      throw new Error(`Unauthorized access to case_id: ${case_id}`);
    }

    // Fix Issue 5: propagate authorization context downwards
    const caseEntities = await this.store.getAllEntitiesForCase(case_id, auth);
    const caseEntityMap = new Map(caseEntities.map((e) => [e.id, e]));

    // Filter relationships based on time limits and relationship types
    let caseEdges = await this.store.getAllRelationshipsForCase(case_id, auth);

    if (rel_types && rel_types.length > 0) {
      const typeSet = new Set(rel_types);
      caseEdges = caseEdges.filter((e) => typeSet.has(e.type));
    }

    if (time_start || time_end) {
      caseEdges = caseEdges.filter((e) => {
        const edgeStart = e.event_time || e.effective_start || (e.properties && e.properties.effective_start);
        const edgeEnd = e.effective_end || (e.properties && e.properties.effective_end);
        
        if (!edgeStart && !edgeEnd) return false; // Exclude unknown timestamps

        if (e.event_time) {
          if (time_start && e.event_time < time_start) return false;
          if (time_end && e.event_time > time_end) return false;
          return true;
        }

        if (edgeStart) {
          const startValid = !time_start || (edgeEnd ? edgeEnd >= time_start : edgeStart >= time_start);
          const endValid = !time_end || edgeStart <= time_end;
          return startValid && endValid;
        }

        return false;
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

    // Calculate node degrees and other relevance factors for scoring
    const nodeDegreeMap = new Map<string, number>();
    const nodeEvidenceMap = new Map<string, number>();
    const recentActivityMap = new Map<string, number>();

    const nowTime = new Date().getTime();

    for (const edge of traversedEdgesMap.values()) {
      nodeDegreeMap.set(edge.source, (nodeDegreeMap.get(edge.source) || 0) + 1);
      nodeDegreeMap.set(edge.target, (nodeDegreeMap.get(edge.target) || 0) + 1);

      const evCount = (edge.evidence_ids?.length || 0);
      nodeEvidenceMap.set(edge.source, (nodeEvidenceMap.get(edge.source) || 0) + evCount);
      nodeEvidenceMap.set(edge.target, (nodeEvidenceMap.get(edge.target) || 0) + evCount);

      if (edge.event_time) {
        const edgeTime = new Date(edge.event_time).getTime();
        const daysOld = Math.max(0, (nowTime - edgeTime) / (1000 * 3600 * 24));
        const temporalScore = Math.max(0, 10 - daysOld); // Simple temporal relevance decay
        recentActivityMap.set(edge.source, (recentActivityMap.get(edge.source) || 0) + temporalScore);
        recentActivityMap.set(edge.target, (recentActivityMap.get(edge.target) || 0) + temporalScore);
      }
    }

    // Fix Issue 6: Comprehensive relevance scoring for deterministic ranking
    // score = seed_proximity (inverse distance) + centrality + evidence_density + temporal_relevance
    allTraversedNodes.sort((a, b) => {
      const distA = nodeDistanceMap.get(a.id) ?? Infinity;
      const distB = nodeDistanceMap.get(b.id) ?? Infinity;

      // Calculate relevance score
      const proximityScoreA = distA === 0 ? 100 : (10 / distA);
      const proximityScoreB = distB === 0 ? 100 : (10 / distB);
      
      const scoreA = proximityScoreA 
        + (nodeDegreeMap.get(a.id) ?? 0) 
        + (nodeEvidenceMap.get(a.id) ?? 0) 
        + (recentActivityMap.get(a.id) ?? 0);
        
      const scoreB = proximityScoreB 
        + (nodeDegreeMap.get(b.id) ?? 0) 
        + (nodeEvidenceMap.get(b.id) ?? 0) 
        + (recentActivityMap.get(b.id) ?? 0);

      if (scoreA !== scoreB) {
        return scoreB - scoreA; // Descending order of relevance
      }

      // Tiebreaker: deterministic by ID
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
