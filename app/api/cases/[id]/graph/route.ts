import { NextResponse } from 'next/server';
import { mockDB } from '@/lib/client-contracts/mockData';
import { Entity, Relationship } from '@/lib/client-contracts/contracts';
import { handleProxyOrFallback } from '@/lib/client-contracts/proxyHelper';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const caseId = params.id;
  return handleProxyOrFallback(request, `/api/cases/${caseId}/graph`, async () => {
    const { searchParams } = new URL(request.url);
    
    const seed = searchParams.get('seed');
    const hops = parseInt(searchParams.get('hops') || '2', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const validFrom = searchParams.get('validFrom');
    const validTo = searchParams.get('validTo');
    const goalMode = searchParams.get('goal'); // 'financial' | 'telecom' | 'all'

    // 1. Get initial relationships for this case
    let relations = [...mockDB.relationships];
    
    // 2. Apply Temporal Filtering if dates are provided
    if (validFrom || validTo) {
      const fromTime = validFrom ? new Date(validFrom).getTime() : 0;
      const toTime = validTo ? new Date(validTo).getTime() : Infinity;
      
      relations = relations.filter((rel) => {
        // If relationship has timestamp, check it
        if (rel.timestamp) {
          const time = new Date(rel.timestamp).getTime();
          return time >= fromTime && time <= toTime;
        }
        // If relationship has valid_from, check it
        if (rel.valid_from) {
          const time = new Date(rel.valid_from).getTime();
          return time >= fromTime && time <= toTime;
        }
        // Default keep if no time is attached (static ownership)
        return true;
      });
    }

    // 3. Apply Goal Mode filter (FE-05)
    if (goalMode === 'financial') {
      relations = relations.filter((r) => r.type === 'TRANSFERRED_MONEY' || r.type === 'OWNED' || r.type === 'ASSOCIATED_WITH');
    } else if (goalMode === 'telecom') {
      relations = relations.filter((r) => r.type === 'CALLED' || r.type === 'USED' || r.type === 'ASSOCIATED_WITH');
    }

    let finalEntities: Entity[] = [];
    let finalRelations: Relationship[] = [];
    let truncated = false;

    if (seed) {
      // Traverse from seed nodes
      const seedIds = seed.split(',').map((s) => s.trim());
      const visitedNodes = new Set<string>(seedIds);
      let currentLevelNodes = new Set<string>(seedIds);
      const traversedRelations = new Set<string>();

      for (let h = 0; h < hops; h++) {
        const nextLevelNodes = new Set<string>();
        
        relations.forEach((rel) => {
          const isSourceInLevel = currentLevelNodes.has(rel.source);
          const isTargetInLevel = currentLevelNodes.has(rel.target);
          
          if (isSourceInLevel || isTargetInLevel) {
            traversedRelations.add(rel.id);
            
            if (isSourceInLevel && !visitedNodes.has(rel.target)) {
              visitedNodes.add(rel.target);
              nextLevelNodes.add(rel.target);
            }
            if (isTargetInLevel && !visitedNodes.has(rel.source)) {
              visitedNodes.add(rel.source);
              nextLevelNodes.add(rel.source);
            }
          }
        });
        
        currentLevelNodes = nextLevelNodes;
        if (currentLevelNodes.size === 0) break;
      }

      // Map selected IDs to Entity models
      finalEntities = mockDB.entities.filter((ent) => visitedNodes.has(ent.id));
      finalRelations = relations.filter((rel) => traversedRelations.has(rel.id));
    } else {
      // Default load: return everything matching filters up to the limit
      finalRelations = relations;
      const nodeIds = new Set<string>();
      finalRelations.forEach((r) => {
        nodeIds.add(r.source);
        nodeIds.add(r.target);
      });
      
      finalEntities = mockDB.entities.filter((e) => nodeIds.has(e.id));
    }

    // Apply node limits to enforce bounded queries
    if (finalEntities.length > limit) {
      finalEntities = finalEntities.slice(0, limit);
      const activeNodeIds = new Set(finalEntities.map((e) => e.id));
      finalRelations = finalRelations.filter((r) => activeNodeIds.has(r.source) && activeNodeIds.has(r.target));
      truncated = true;
    }

    return {
      case_id: caseId,
      nodes: finalEntities,
      edges: finalRelations,
      meta: {
        truncated,
        node_count: finalEntities.length,
        edge_count: finalRelations.length
      }
    };
  });
}
