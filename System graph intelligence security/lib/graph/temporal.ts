/**
 * GT-03 Temporal Engine
 * Temporal filtering, graph snapshot generation, temporal graph diffing (ADDED, REMOVED, CHANGED),
 * and incident window extraction.
 * CRITICAL: Missing timestamps remain UNKNOWN. No fabrication or interpolation.
 */

import { REL_v1, ENTITY_v1, GRAPH_v1 } from "../contracts/types.js";
import { GraphStore } from "./store.js";

export interface TemporalDiffResult {
  added: REL_v1[];
  removed: REL_v1[];
  changed: Array<{ before: REL_v1; after: REL_v1 }>;
  unknown_timestamps_count: number;
}

export interface IncidentWindowOptions {
  case_id: string;
  anchor_time: string; // ISO-8601 UTC
  before_ms: number;
  after_ms: number;
}

export class TemporalEngine {
  constructor(private store: GraphStore) {}

  private getEdgeStart(e: any): string | undefined {
    return e.event_time || e.effective_start || e.valid_from || (e.properties && (e.properties.effective_start || e.properties.valid_from));
  }

  private getEdgeEnd(e: any): string | undefined {
    return e.effective_end || e.valid_to || (e.properties && (e.properties.effective_end || e.properties.valid_to));
  }

  /**
   * Returns graph state at time T (active relationships where start <= T,
   * and end is undefined or >= T).
   * Relationships without timestamps are classified as UNKNOWN and excluded from strict time snapshot.
   */
  public async getSnapshotAt(caseId: string, timestamp: string): Promise<GRAPH_v1> {
    const caseNodes = await this.store.getAllEntitiesForCase(caseId);
    const caseEdges = await this.store.getAllRelationshipsForCase(caseId);

    const activeEdges = caseEdges.filter((e) => {
      const start = this.getEdgeStart(e);
      const end = this.getEdgeEnd(e);
      if (!start && !end) {
        return false; // Unknown timestamp
      }

      if (e.event_time) {
        return e.event_time <= timestamp;
      }

      if (start) {
        const startValid = start <= timestamp;
        const endValid = !end || end >= timestamp;
        return startValid && endValid;
      }

      return false;
    });

    const activeNodeIds = new Set<string>();
    activeEdges.forEach((e) => {
      activeNodeIds.add(e.source);
      activeNodeIds.add(e.target);
    });

    const activeNodes = caseNodes.filter((n) => activeNodeIds.has(n.id));

    return {
      case_id: caseId,
      nodes: activeNodes,
      edges: activeEdges,
      meta: {
        truncated: false,
        node_count: activeNodes.length,
        edge_count: activeEdges.length,
      },
    };
  }

  /**
   * Compares graph states at T1 and T2 to calculate ADDED, REMOVED, and CHANGED relationships.
   */
  public async compareSnapshots(
    caseId: string,
    time1: string,
    time2: string
  ): Promise<TemporalDiffResult> {
    const snap1 = await this.getSnapshotAt(caseId, time1);
    const snap2 = await this.getSnapshotAt(caseId, time2);

    const map1 = new Map(snap1.edges.map((e) => [e.id, e]));
    const map2 = new Map(snap2.edges.map((e) => [e.id, e]));

    const added: REL_v1[] = [];
    const removed: REL_v1[] = [];
    const changed: Array<{ before: REL_v1; after: REL_v1 }> = [];

    // Find added & changed
    for (const [id, edge2] of map2.entries()) {
      if (!map1.has(id)) {
        added.push(edge2);
      } else {
        const edge1 = map1.get(id)!;
        if (JSON.stringify(edge1) !== JSON.stringify(edge2)) {
          changed.push({ before: edge1, after: edge2 });
        }
      }
    }

    // Find removed
    for (const [id, edge1] of map1.entries()) {
      if (!map2.has(id)) {
        removed.push(edge1);
      }
    }

    const allEdges = await this.store.getAllRelationshipsForCase(caseId);
    const unknownCount = allEdges.filter(
      (e) => !this.getEdgeStart(e) && !this.getEdgeEnd(e)
    ).length;

    return {
      added,
      removed,
      changed,
      unknown_timestamps_count: unknownCount,
    };
  }

  /**
   * Filter relationships within [T - before, T + after] incident window.
   */
  public async getIncidentWindowGraph(options: IncidentWindowOptions): Promise<GRAPH_v1> {
    const { case_id, anchor_time, before_ms, after_ms } = options;

    const anchorMs = new Date(anchor_time).getTime();
    const windowStartMs = anchorMs - before_ms;
    const windowEndMs = anchorMs + after_ms;

    const caseNodes = await this.store.getAllEntitiesForCase(case_id);
    const caseEdges = await this.store.getAllRelationshipsForCase(case_id);

    const windowEdges = caseEdges.filter((e) => {
      const startStr = this.getEdgeStart(e);
      if (!startStr) return false;
      const startMs = new Date(startStr).getTime();
      return startMs >= windowStartMs && startMs <= windowEndMs;
    });

    const windowNodeIds = new Set<string>();
    windowEdges.forEach((e) => {
      windowNodeIds.add(e.source);
      windowNodeIds.add(e.target);
    });

    const windowNodes = caseNodes.filter((n) => windowNodeIds.has(n.id));

    return {
      case_id,
      nodes: windowNodes,
      edges: windowEdges,
      meta: {
        truncated: false,
        node_count: windowNodes.length,
        edge_count: windowEdges.length,
      },
    };
  }
}
