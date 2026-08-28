import { 
  EntityV1, 
  RelationshipV1, 
  EvidenceV1, 
  ENTITY_v1, 
  REL_v1, 
  EVIDENCE_v1, 
  AuthContext, 
  NodeType, 
  RelationshipType 
} from 'shared-contracts';
import { GraphClient } from '../services/graph_client';

/**
 * Strict mapping dictionary for Entity Types from D2 (Backend/Data) to D4 (Graph/Trust).
 */
const ENTITY_TYPE_MAP: Record<string, NodeType> = {
  'PERSON': 'Person',
  'Person': 'Person',
  'PHONE': 'Phone',
  'Phone': 'Phone',
  'IMEI': 'IMEI',
  'ACCOUNT': 'BankAccount',
  'BANK_ACCOUNT': 'BankAccount',
  'BankAccount': 'BankAccount',
  'VEHICLE': 'Vehicle',
  'Vehicle': 'Vehicle',
  'LOCATION': 'Location',
  'Location': 'Location',
  'ORGANIZATION': 'Organization',
  'Organization': 'Organization',
  'FIR': 'FIR',
  'CASE': 'Case',
  'Case': 'Case',
  'EVENT': 'Event',
  'Event': 'Event'
};

/**
 * Strict mapping dictionary for Relationship Types from D2 (Backend/Data) to D4 (Graph/Trust).
 */
const RELATIONSHIP_TYPE_MAP: Record<string, RelationshipType> = {
  'CALLED': 'CALLED',
  'TRANSFERRED_MONEY': 'TRANSFERRED_MONEY',
  'USED': 'USED',
  'USED_DEVICE': 'USED',
  'OWNED': 'OWNED',
  'OWNS_ACCOUNT': 'OWNED',
  'VISITED': 'VISITED',
  'MET_AT': 'MET_AT',
  'TRAVELED_WITH': 'TRAVELED_WITH',
  'LINKED_TO': 'LINKED_TO',
  'ASSOCIATED_WITH': 'ASSOCIATED_WITH',
  'MEMBER_OF': 'ASSOCIATED_WITH',
  'OPERATES': 'ASSOCIATED_WITH',
  'INVOLVED_IN': 'PART_OF_CASE',
  'PART_OF_CASE': 'PART_OF_CASE'
};

/**
 * Infers appropriate MIME type from file extension and D2 source type metadata.
 */
function inferMimeType(fileName: string, sourceType?: string): string {
  const lowerName = (fileName || '').toLowerCase();
  const lowerType = (sourceType || '').toLowerCase();
  
  if (lowerName.endsWith('.pdf') || lowerType.includes('pdf')) return 'application/pdf';
  if (lowerName.endsWith('.csv') || lowerType.includes('csv')) return 'text/csv';
  if (lowerName.endsWith('.json') || lowerType.includes('json')) return 'application/json';
  if (lowerName.endsWith('.txt') || lowerType.includes('text')) return 'text/plain';
  if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg') || lowerType.includes('jpeg')) return 'image/jpeg';
  if (lowerName.endsWith('.png') || lowerType.includes('png')) return 'image/png';
  if (lowerName.endsWith('.wav') || lowerName.endsWith('.mp3') || lowerType.includes('audio')) return 'audio/mpeg';
  if (lowerName.endsWith('.mp4') || lowerType.includes('video')) return 'video/mp4';
  if (lowerType.includes('cdr') || lowerType.includes('cell_tower')) return 'text/csv';
  return 'application/octet-stream';
}

export class GraphSyncAdapter {
  
  /**
   * Validates and maps D2 EntityV1 to D4 ENTITY_v1 schema.
   * Throws a descriptive validation error if the entity type is unsupported.
   */
  static mapEntity(d2Entity: EntityV1, caseId: string): ENTITY_v1 {
    if (!d2Entity.id) {
      throw new Error('Validation Error: Entity must have a valid non-empty id');
    }
    if (!caseId) {
      throw new Error(`Validation Error: Missing case_id for entity ${d2Entity.id}`);
    }

    const mappedType = ENTITY_TYPE_MAP[d2Entity.type];
    if (!mappedType) {
      throw new Error(`Validation Error: Unsupported or invalid entity type '${d2Entity.type}' for entity ID '${d2Entity.id}'`);
    }

    return {
      id: d2Entity.id,
      type: mappedType,
      case_id: caseId,
      event_time: d2Entity.created_at || new Date().toISOString(),
      properties: {
        name: d2Entity.name,
        identifiers: d2Entity.identifiers || [],
        created_at: d2Entity.created_at,
        updated_at: d2Entity.updated_at,
        ...d2Entity.properties
      }
    };
  }

  /**
   * Validates and maps D2 RelationshipV1 to D4 REL_v1 schema.
   * Throws a descriptive validation error if the relationship type is unsupported.
   */
  static mapRelationship(d2Rel: RelationshipV1, caseId: string): REL_v1 {
    if (!d2Rel.id) {
      throw new Error('Validation Error: Relationship must have a valid non-empty id');
    }
    if (!d2Rel.source_id || !d2Rel.target_id) {
      throw new Error(`Validation Error: Relationship ${d2Rel.id} must have both source_id and target_id`);
    }
    if (!caseId) {
      throw new Error(`Validation Error: Missing case_id for relationship ${d2Rel.id}`);
    }

    const mappedType = RELATIONSHIP_TYPE_MAP[d2Rel.type];
    if (!mappedType) {
      throw new Error(`Validation Error: Unsupported or invalid relationship type '${d2Rel.type}' for relationship ID '${d2Rel.id}'`);
    }

    const eventTime = d2Rel.properties?.event_time || d2Rel.created_at || new Date().toISOString();
    const effectiveStart = d2Rel.properties?.effective_start;
    const effectiveEnd = d2Rel.properties?.effective_end;

    return {
      id: d2Rel.id,
      source: d2Rel.source_id,
      target: d2Rel.target_id,
      type: mappedType,
      case_id: caseId,
      evidence_ids: d2Rel.evidence_ids || [],
      event_time: eventTime,
      effective_start: effectiveStart,
      effective_end: effectiveEnd,
      properties: {
        weight: d2Rel.weight !== undefined ? d2Rel.weight : 1.0,
        ...d2Rel.properties
      }
    };
  }

  /**
   * Maps D2 EvidenceV1 to D4 EVIDENCE_v1 schema preserving all metadata.
   */
  static mapEvidence(d2Ev: EvidenceV1): EVIDENCE_v1 {
    if (!d2Ev.id) {
      throw new Error('Validation Error: Evidence must have a valid non-empty id');
    }
    if (!d2Ev.case_id) {
      throw new Error(`Validation Error: Missing case_id for evidence ${d2Ev.id}`);
    }
    if (!d2Ev.sha256) {
      throw new Error(`Validation Error: Missing sha256 hash for evidence ${d2Ev.id}`);
    }

    const mimeType = inferMimeType(d2Ev.source_ref, d2Ev.source_type);

    return {
      id: d2Ev.id,
      case_id: d2Ev.case_id,
      file_name: d2Ev.source_ref,
      mime_type: mimeType,
      sha256_hash: d2Ev.sha256,
      stored_hash: d2Ev.sha256,
      status: 'VERIFIED',
      created_at: new Date().toISOString(),
      content: d2Ev.storage_uri
    };
  }

  /**
   * Pushes a validated Entity from D2 to D4 over HTTP.
   */
  static async syncEntityToD4(context: AuthContext, entity: EntityV1) {
    const d4Entity = this.mapEntity(entity, context.case_id);
    return await GraphClient.syncEntity(context, d4Entity);
  }

  /**
   * Pushes a validated Relationship from D2 to D4 over HTTP.
   */
  static async syncRelationshipToD4(context: AuthContext, rel: RelationshipV1) {
    const d4Rel = this.mapRelationship(rel, context.case_id);
    return await GraphClient.syncRelationship(context, d4Rel);
  }

  /**
   * Pushes a validated Evidence record from D2 to D4 over HTTP.
   */
  static async syncEvidenceToD4(context: AuthContext, ev: EvidenceV1) {
    const d4Ev = this.mapEvidence(ev);
    return await GraphClient.syncEvidence(context, d4Ev);
  }
}
