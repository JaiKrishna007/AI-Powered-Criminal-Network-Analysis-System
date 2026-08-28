// PS26189-CONTRACT-v1 Data Types

import { z } from 'zod';
import { 
  UserSchema, 
  CaseSchema, 
  EvidenceSchema, 
  IngestJobSchema, 
  AuditEventRefSchema,
  UserV1,
  CaseV1,
  EvidenceV1,
  IngestJobV1,
  AuditEventRefV1,
  EntityV1,
  RelationshipV1,
  InsightV1,
  ReportSchema
} from '../contracts';

export type User = z.infer<typeof UserSchema>;
export type Case = z.infer<typeof CaseSchema>;
export type Evidence = z.infer<typeof EvidenceSchema>;
export type IngestionJob = z.infer<typeof IngestJobSchema>;
export type AuditEventRef = z.infer<typeof AuditEventRefSchema>;
export type Report = z.infer<typeof ReportSchema>;

export type IngestionJobState = IngestionJob['state'];
export type ReviewState = 'CANDIDATE' | 'ACCEPTED' | 'REJECTED' | 'DEFERRED';

export interface Role {
  id: string;
  name: 'INVESTIGATOR' | 'SUPERVISOR' | 'SYSTEM ADMIN' | string;
}

export interface UserRole {
  user_id: string;
  role_id: string;
}

export interface CaseMember {
  case_id: string;
  user_id: string;
  access_level: string;
}

export type SyncState = 'SYNC_PENDING' | 'SYNCED' | 'SYNC_FAILED';

export interface EntityReview {
  candidate_id: string;
  decision: 'ACCEPTED' | 'REJECTED' | 'DEFERRED';
  reviewer_id: string;
  decided_at: string; // ISO-8601 UTC
  sync_state?: SyncState;
  sync_error?: string | null;
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
  ml_status?: 'AVAILABLE' | 'UNAVAILABLE';
  sync_state?: SyncState;
  candidate_data: any;
  created_at: string;
}

import { ClassificationType } from '../contracts';

export interface IngestRequestPayload {
  case_id: string;
  source_type: 'PDF' | 'CSV' | 'JSON' | 'Text' | string;
  source_ref: string;
  storage_uri: string;
  content: string | Buffer;
  classification?: ClassificationType;
}
