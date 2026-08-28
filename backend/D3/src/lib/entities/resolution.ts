import { EntityV1 } from '@/lib/contracts';
import { v4 as uuidv4 } from 'uuid';

export interface ResolutionCandidate {
  id: string;
  case_id: string;
  entities: EntityV1[];
  confidence: number;
  reasons: string[];
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'DEFERRED';
}

/**
 * Entity Resolution Logic (Simulated for Prototype)
 */
export function generateMatchCandidates(newEntities: EntityV1[], existingEntities: EntityV1[], caseId: string): ResolutionCandidate[] {
  const candidates: ResolutionCandidate[] = [];

  for (const newEnt of newEntities) {
    for (const exEnt of existingEntities) {
      if (newEnt.type !== exEnt.type) continue;
      
      let confidence = 0;
      const reasons = [];

      // 1. Name similarity (Exact match)
      if (newEnt.canonical_name.toLowerCase() === exEnt.canonical_name.toLowerCase()) {
        confidence += 0.8;
        reasons.push('Exact name match');
      }

      // 2. Shared Aliases
      const sharedAliases = newEnt.aliases.filter(a => exEnt.aliases.includes(a));
      if (sharedAliases.length > 0) {
        confidence += 0.2;
        reasons.push('Shared aliases found');
      }

      if (confidence > 0.6) {
        candidates.push({
          id: `RES-${uuidv4()}`,
          case_id: caseId,
          entities: [newEnt, exEnt],
          confidence: Math.min(confidence, 1.0),
          reasons,
          status: 'PENDING'
        });
      }
    }
  }

  return candidates;
}
