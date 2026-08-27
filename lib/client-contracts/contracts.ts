export type EntityType = 
  | 'PERSON' 
  | 'PHONE' 
  | 'IMEI' 
  | 'BANK_ACCOUNT' 
  | 'VEHICLE' 
  | 'LOCATION' 
  | 'ORGANIZATION' 
  | 'FIR' 
  | 'CASE' 
  | 'EVENT';

export interface Entity {
  id: string;
  type: EntityType;
  canonical_name: string;
  aliases: string[];
  confidence: number;
  // Metadata fields for UX display
  phone_value?: string;
  account_number?: string;
  plate_number?: string;
  address_label?: string;
  imei_value?: string;
  org_name?: string;
}

export type RelationshipType = 
  | 'CALLED' 
  | 'TRANSFERRED_MONEY' 
  | 'USED' 
  | 'OWNED' 
  | 'VISITED' 
  | 'MET_AT' 
  | 'TRAVELED_WITH' 
  | 'LINKED_TO' 
  | 'ASSOCIATED_WITH' 
  | 'PART_OF_CASE';

export interface Relationship {
  id: string;
  source: string; // source entity id
  type: RelationshipType;
  target: string; // target entity id
  valid_from?: string; // ISO timestamp
  valid_to?: string;   // ISO timestamp
  timestamp?: string;  // ISO timestamp (for individual event events)
  amount?: number;     // for financial transactions
  evidence_ids: string[];
  confidence?: number;
}

export interface Evidence {
  id: string;
  case_id: string;
  source_type: 'CDR' | 'BANK_TRANSACTION' | 'FIR' | 'SURVEILLANCE' | 'INTEL_REPORT' | 'PDF' | 'CSV' | 'JSON';
  source_ref: string;
  sha256: string;
  classification: 'PUBLIC' | 'CASE_RESTRICTED' | 'CONFIDENTIAL' | 'SECRET';
  storage_uri?: string;
  content?: string; // Mock content snippet
  integrity_status?: 'VERIFIED' | 'HASH_MISMATCH';
}

export interface Insight {
  id: string;
  case_id: string;
  type: 'POTENTIAL_BRIDGE' | 'COMMUNICATION_SPIKE' | 'FINANCIAL_PATH' | 'CO_LOCATION';
  entity_id: string;
  confidence: number;
  reasons: string[];
  evidence_ids: string[];
}

export interface Lead {
  id: string;
  case_id: string;
  title: string;
  rationale: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'PENDING_REVIEW' | 'IN_PROGRESS' | 'COMPLETED' | 'DISMISSED';
  relevance_score?: number;
  evidence_ids: string[];
}

export interface Case {
  id: string;
  title: string;
  status: 'ACTIVE' | 'ARCHIVED' | 'CLOSED';
  owner_id: string;
  classification: 'PUBLIC' | 'CASE_RESTRICTED' | 'CONFIDENTIAL' | 'SECRET';
  description: string;
  created_at: string;
  evidence_count?: number;
  entity_count?: number;
  relationship_count?: number;
}

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  evidence_ids?: string[];
  limitations?: string[];
  graph_request?: {
    seed_nodes: string[];
    hops: number;
    highlight_edges?: string[];
  };
}

export interface GraphPayload {
  case_id: string;
  nodes: Entity[];
  edges: Relationship[];
  meta: {
    truncated: boolean;
    node_count: number;
    edge_count: number;
  };
}

export interface SearchResult {
  query: string;
  entities: Entity[];
  evidence: Evidence[];
  relationships: Relationship[];
}

export interface Report {
  id: string;
  case_id: string;
  version: number;
  status: 'DRAFT' | 'FINALIZED' | 'SUPERVISOR_APPROVED';
  created_by: string;
  created_at: string;
  sections: {
    summary: string;
    findings: string[];
    limitations: string[];
  };
}
