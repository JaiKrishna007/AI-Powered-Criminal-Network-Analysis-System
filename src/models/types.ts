// PS26189-CONTRACT-v1 Data Types

export type IngestionJobState = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
export type ReviewState = 'CANDIDATE' | 'ACCEPTED' | 'REJECTED' | 'DEFERRED';

export interface User {
  id: string;
  display_name: string;
  status: string;
}

export interface Role {
  id: string;
  name: 'INVESTIGATOR' | 'SUPERVISOR' | 'SYSTEM ADMIN' | string;
}

export interface UserRole {
  user_id: string;
  role_id: string;
}

export interface Case {
  id: string;
  title: string;
  status: string;
  owner_id: string;
  classification: string;
}

export interface CaseMember {
  case_id: string;
  user_id: string;
  access_level: string;
}

export interface Evidence {
  id: string;
  case_id: string;
  source_type: string;
  source_ref: string;
  storage_uri: string;
  sha256: string;
  classification: string;
}

export interface IngestionJob {
  id: string;
  case_id: string;
  source_ref: string;
  state: IngestionJobState;
  error?: string | null;
}

export interface EntityReview {
  candidate_id: string;
  decision: 'ACCEPTED' | 'REJECTED' | 'DEFERRED';
  reviewer_id: string;
  decided_at: string; // ISO-8601 UTC
}

export interface AuditEventRef {
  event_id: string;
  case_id?: string | null;
  actor_id: string;
  action: string;
}

// Internal candidate representation for entity resolution
export interface EntitySignals {
  name_similarity: number;
  phonetic_similarity: number;
  identifier_similarity: number;
  context_similarity: number;
  embedding_similarity: number;
}

export interface EntityCandidate {
  id: string;
  case_id: string;
  name: string;
  normalized_name: string;
  original_phone?: string | null;
  normalized_phone?: string | null;
  identifiers: Record<string, string>;
  context: Record<string, any>;
  score: number;
  signals: EntitySignals;
  has_conflict: boolean;
  status: ReviewState;
  candidate_data: any;
  created_at: string;
}

export interface IngestRequestPayload {
  case_id: string;
  source_type: 'PDF' | 'CSV' | 'JSON' | 'Text' | string;
  source_ref: string;
  storage_uri: string;
  content: string | Buffer;
  classification?: string;
}
