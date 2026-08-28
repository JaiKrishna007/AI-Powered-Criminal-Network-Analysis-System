import { EntityV1, RelationshipV1, EvidenceV1, ENTITY_v1, REL_v1, EVIDENCE_v1, AuthContext, NodeType, RelationshipType } from 'shared-contracts';
import { GraphClient } from '../services/graph_client';

export class GraphSyncAdapter {
  
  static mapEntity(d2Entity: EntityV1, caseId: string): ENTITY_v1 {
    return {
      id: d2Entity.id,
      type: (d2Entity.type as NodeType) || 'Person',
      case_id: caseId,
      properties: {
        name: d2Entity.name,
        identifiers: d2Entity.identifiers,
        ...d2Entity.properties
      }
    };
  }

  static mapRelationship(d2Rel: RelationshipV1, caseId: string): REL_v1 {
    return {
      id: d2Rel.id,
      source: d2Rel.source_id,
      target: d2Rel.target_id,
      type: (d2Rel.type as RelationshipType) || 'LINKED_TO',
      case_id: caseId,
      evidence_ids: d2Rel.evidence_ids || [],
      properties: {
        weight: d2Rel.weight,
        ...d2Rel.properties
      }
    };
  }

  static mapEvidence(d2Ev: EvidenceV1): EVIDENCE_v1 {
    return {
      id: d2Ev.id,
      case_id: d2Ev.case_id,
      file_name: d2Ev.source_ref,
      mime_type: 'application/octet-stream', // Default if unknown
      sha256_hash: d2Ev.sha256,
      created_at: new Date().toISOString()
    };
  }

  static async syncEntityToD4(context: AuthContext, entity: EntityV1) {
    const d4Entity = this.mapEntity(entity, context.case_id!);
    return await GraphClient.syncEntity(context, d4Entity);
  }

  static async syncRelationshipToD4(context: AuthContext, rel: RelationshipV1) {
    const d4Rel = this.mapRelationship(rel, context.case_id!);
    return await GraphClient.syncRelationship(context, d4Rel);
  }

  static async syncEvidenceToD4(context: AuthContext, ev: EvidenceV1) {
    const d4Ev = this.mapEvidence(ev);
    return await GraphClient.syncEvidence(context, d4Ev);
  }
}
