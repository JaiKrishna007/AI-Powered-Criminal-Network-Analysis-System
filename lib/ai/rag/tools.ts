import { 
  AuthScopeAdapter, 
  EntityV1, 
  RelV1, 
  EvidenceV1 
} from '../../../contracts/adapters.js';
import { SemanticSearchEngine } from '../../vector/semantic_search.js';

export interface UpstreamDataStore {
  entities: EntityV1[];
  relationships: RelV1[];
  evidence: EvidenceV1[];
}

const CLEARANCE_LEVELS: Record<string, number> = {
  UNCLASSIFIED: 1,
  CONFIDENTIAL: 2,
  RESTRICTED: 3,
  SECRET: 4,
};

export class AllowlistedToolExecutor {
  private semanticSearchEngine: SemanticSearchEngine;
  private dataStore: UpstreamDataStore;

  constructor(semanticSearchEngine: SemanticSearchEngine, dataStore: UpstreamDataStore) {
    this.semanticSearchEngine = semanticSearchEngine;
    this.dataStore = dataStore;
  }

  /**
   * Enforces case scope access and classification security clearance authorization.
   */
  private checkScopeAccess(caseId: string, classification: string, scope: AuthScopeAdapter): boolean {
    if (!scope.authorized_case_ids.includes(caseId)) return false;
    const recordLevel = CLEARANCE_LEVELS[(classification || 'UNCLASSIFIED').toUpperCase()] || 1;
    const userLevel = CLEARANCE_LEVELS[(scope.security_clearance || 'UNCLASSIFIED').toUpperCase()] || 1;
    return userLevel >= recordLevel;
  }

  /**
   * Tool: search_evidence
   */
  public async search_evidence(query: string, scope: AuthScopeAdapter, caseId?: string, topK: number = 5) {
    return await this.semanticSearchEngine.search(query, scope, caseId, undefined, topK);
  }

  /**
   * Tool: get_entity
   */
  public get_entity(entityIdOrName: string, scope: AuthScopeAdapter): EntityV1[] {
    const qLower = entityIdOrName.toLowerCase();
    return this.dataStore.entities.filter((e) => {
      if (!this.checkScopeAccess(e.case_id, e.classification, scope)) return false;
      return e.id.toLowerCase() === qLower || e.name.toLowerCase().includes(qLower);
    });
  }

  /**
   * Tool: get_path
   * Searches available relationship graph and returns the actual ordered relationship path (nodes and edges)
   * connecting sourceEntityId and targetEntityId within authorized scope and case bounds.
   * Returns empty array / explicit no-path result when no authorized path exists.
   */
  public get_path(
    sourceEntityId: string, 
    targetEntityId: string, 
    scope: AuthScopeAdapter,
    caseId?: string
  ): { nodes: EntityV1[]; edges: RelV1[]; pathFound: boolean } {
    if (!sourceEntityId || !targetEntityId || sourceEntityId === targetEntityId) {
      return { nodes: [], edges: [], pathFound: false };
    }

    const authorizedEntities = new Map<string, EntityV1>();
    for (const e of this.dataStore.entities) {
      if (this.checkScopeAccess(e.case_id, e.classification, scope) && (!caseId || e.case_id === caseId)) {
        authorizedEntities.set(e.id, e);
      }
    }

    if (!authorizedEntities.has(sourceEntityId) || !authorizedEntities.has(targetEntityId)) {
      return { nodes: [], edges: [], pathFound: false };
    }

    const authorizedRels = this.dataStore.relationships.filter((r) => {
      if (!this.checkScopeAccess(r.case_id, r.classification, scope)) return false;
      if (caseId && r.case_id !== caseId) return false;
      return authorizedEntities.has(r.source_entity_id) && authorizedEntities.has(r.target_entity_id);
    });

    // Adjacency list: entityId -> Array<{ neighborId: string, edge: RelV1 }>
    const adj = new Map<string, Array<{ neighborId: string; edge: RelV1 }>>();
    for (const r of authorizedRels) {
      if (!adj.has(r.source_entity_id)) adj.set(r.source_entity_id, []);
      if (!adj.has(r.target_entity_id)) adj.set(r.target_entity_id, []);

      adj.get(r.source_entity_id)!.push({ neighborId: r.target_entity_id, edge: r });
      adj.get(r.target_entity_id)!.push({ neighborId: r.source_entity_id, edge: r });
    }

    // BFS for shortest ordered path from sourceEntityId to targetEntityId
    const queue: string[] = [sourceEntityId];
    const visited = new Set<string>([sourceEntityId]);
    const parentMap = new Map<string, { parentId: string; edge: RelV1 }>();

    let found = false;
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === targetEntityId) {
        found = true;
        break;
      }

      const neighbors = adj.get(current) || [];
      for (const { neighborId, edge } of neighbors) {
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          parentMap.set(neighborId, { parentId: current, edge });
          queue.push(neighborId);
        }
      }
    }

    if (!found) {
      return { nodes: [], edges: [], pathFound: false };
    }

    // Reconstruct path
    const pathEdges: RelV1[] = [];
    const pathNodeIds: string[] = [targetEntityId];
    let curr = targetEntityId;

    while (curr !== sourceEntityId) {
      const p = parentMap.get(curr);
      if (!p) break;
      pathEdges.unshift(p.edge);
      curr = p.parentId;
      pathNodeIds.unshift(curr);
    }

    const pathNodes: EntityV1[] = pathNodeIds.map((id) => authorizedEntities.get(id)!);

    return {
      nodes: pathNodes,
      edges: pathEdges,
      pathFound: true,
    };
  }

  /**
   * Tool: get_timeline
   */
  public get_timeline(scope: AuthScopeAdapter, caseId?: string, startDate?: string, endDate?: string): EvidenceV1[] {
    return this.dataStore.evidence.filter((ev) => {
      if (!this.checkScopeAccess(ev.case_id, ev.classification, scope)) return false;
      if (caseId && ev.case_id !== caseId) return false;
      if (!ev.date) return true;
      if (startDate && ev.date < startDate) return false;
      if (endDate && ev.date > endDate) return false;
      return true;
    });
  }

  /**
   * Tool: get_transactions
   */
  public get_transactions(
    scope: AuthScopeAdapter,
    caseId?: string,
    minAmount?: number,
    startDate?: string,
    endDate?: string
  ): RelV1[] {
    return this.dataStore.relationships.filter((r) => {
      if (!this.checkScopeAccess(r.case_id, r.classification, scope)) return false;
      if (caseId && r.case_id !== caseId) return false;
      if (r.relationship_type !== 'TRANSFERRED_FUNDS' && r.relationship_type !== 'FINANCIAL_TRANSACTION') {
        return false;
      }
      const amount = r.attributes?.amount;
      if (minAmount !== undefined && (amount === undefined || amount < minAmount)) {
        return false;
      }
      const date = r.created_at || r.attributes?.date;
      if (startDate && date && date < startDate) return false;
      if (endDate && date && date > endDate) return false;
      return true;
    });
  }

  /**
   * Tool: get_graph
   * Retrieves focused graph centered at focusEntityId up to traversal depth.
   * If focusEntityId is provided, returns only nodes and edges reachable within depth.
   * Enforces scope and clearance authorization. Excludes unrelated graph data.
   */
  public get_graph(
    scope: AuthScopeAdapter, 
    caseId?: string, 
    focusEntityId?: string, 
    depth: number = 1
  ): { nodes: EntityV1[]; edges: RelV1[] } {
    const authorizedEntities = this.dataStore.entities.filter((e) => {
      if (!this.checkScopeAccess(e.case_id, e.classification, scope)) return false;
      if (caseId && e.case_id !== caseId) return false;
      return true;
    });

    const authorizedEntityMap = new Map<string, EntityV1>();
    for (const e of authorizedEntities) {
      authorizedEntityMap.set(e.id, e);
    }

    const authorizedRels = this.dataStore.relationships.filter((r) => {
      if (!this.checkScopeAccess(r.case_id, r.classification, scope)) return false;
      if (caseId && r.case_id !== caseId) return false;
      return authorizedEntityMap.has(r.source_entity_id) && authorizedEntityMap.has(r.target_entity_id);
    });

    if (!focusEntityId) {
      return {
        nodes: authorizedEntities,
        edges: authorizedRels,
      };
    }

    // Focused graph retrieval starting from focusEntityId up to depth
    if (!authorizedEntityMap.has(focusEntityId)) {
      return { nodes: [], edges: [] };
    }

    const visitedNodeIds = new Set<string>([focusEntityId]);
    const collectedEdges = new Set<RelV1>();
    let currentFrontier = new Set<string>([focusEntityId]);

    for (let d = 0; d < depth; d++) {
      const nextFrontier = new Set<string>();
      for (const rel of authorizedRels) {
        if (currentFrontier.has(rel.source_entity_id)) {
          collectedEdges.add(rel);
          if (!visitedNodeIds.has(rel.target_entity_id)) {
            visitedNodeIds.add(rel.target_entity_id);
            nextFrontier.add(rel.target_entity_id);
          }
        }
        if (currentFrontier.has(rel.target_entity_id)) {
          collectedEdges.add(rel);
          if (!visitedNodeIds.has(rel.source_entity_id)) {
            visitedNodeIds.add(rel.source_entity_id);
            nextFrontier.add(rel.source_entity_id);
          }
        }
      }
      currentFrontier = nextFrontier;
    }

    const focusedNodes = Array.from(visitedNodeIds)
      .map((id) => authorizedEntityMap.get(id)!)
      .filter(Boolean);

    const focusedEdges = Array.from(collectedEdges);

    return {
      nodes: focusedNodes,
      edges: focusedEdges,
    };
  }
}
