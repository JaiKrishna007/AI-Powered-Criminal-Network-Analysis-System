/**
 * Developer 3 AI / RAG Integration Adapters & Types
 * Contract Version: PS26189-CONTRACT-v1
 * 
 * Note: AuthScopeAdapter, SearchV1Adapter, CopilotV1Adapter, InsightV1Adapter, and LeadV1Adapter
 * represent internal D3 adapter interfaces used when authoritative shared schemas are not provided
 * directly by the workspace. All IDs are strings, all timestamps are ISO-8601 UTC strings.
 */

// ============================================================================
// INPUT CONTRACT ADAPTERS (Developer 3 Reads)
// ============================================================================

export interface EntityV1 {
  id: string;
  case_id: string;
  name: string;
  type: string; // e.g. "PERSON", "ORGANIZATION", "ACCOUNT", "VEHICLE"
  attributes?: Record<string, any>;
  classification: string; // e.g. "UNCLASSIFIED", "CONFIDENTIAL", "RESTRICTED", "SECRET"
  created_at: string; // ISO-8601 UTC
}

export interface RelV1 {
  id: string;
  case_id: string;
  source_entity_id: string;
  target_entity_id: string;
  relationship_type: string; // e.g. "TRANSFERRED_FUNDS", "COMMUNICATED_WITH", "ASSOCIATED_WITH"
  attributes?: Record<string, any>;
  classification: string;
  created_at?: string;
}

export interface EvidenceV1 {
  id: string;
  case_id: string;
  source_ref: string;
  chunk_ref: string;
  content: string;
  classification: string;
  created_at: string;
  entity_ids?: string[];
  date?: string; // ISO-8601 date string for temporal matching
}

export interface CaseV1 {
  id: string;
  name: string;
  status: string;
  classification: string;
  created_at: string;
}

/**
 * Internal D3 authorized retrieval scope adapter.
 * Carried through all retrieval and Copilot operations to enforce scope isolation.
 */
export interface AuthScopeAdapter {
  user_id: string;
  authorized_case_ids: string[];
  security_clearance: string; // "UNCLASSIFIED" | "CONFIDENTIAL" | "RESTRICTED" | "SECRET"
}

// ============================================================================
// OUTPUT CONTRACT ADAPTERS (Developer 3 Writes)
// ============================================================================

/**
 * Contract-required vector payload fields (AI-01 / Section 4).
 * Vector index metadata must contain strictly these fields for external contract compliance.
 */
export interface VectorRecordMetadata {
  vector_id: string;
  case_id: string;
  source_ref: string;
  chunk_ref: string;
  model_version: string;
  text_hash: string;
  classification: string;
  entity_ids?: string[];
}

/**
 * Internal Vector Record stored inside D3 VectorStore.
 * Combines mandatory contract metadata with internal vector implementation fields.
 */
export interface InternalVectorRecord extends VectorRecordMetadata {
  embedding: number[];
  content: string;
}

export interface SearchResultItem {
  vector_id: string;
  case_id: string;
  source_ref: string;
  chunk_ref: string;
  relevance_score: number;
  snippet: string;
  classification: string;
  entity_ids?: string[];
}

export interface SearchV1Adapter {
  query: string;
  case_id: string;
  results: SearchResultItem[];
  total: number;
}

export interface GraphRequestPayload {
  focus_entity_id?: string;
  depth?: number;
  relationship_types?: string[];
}

export interface CopilotV1Adapter {
  answer: string;
  evidence_ids: string[];
  limitations: string[];
  graph_request?: GraphRequestPayload;
}

export interface BridgeSignal {
  value: number;
  reason_code: string;
}

export interface CommunicationSignal {
  count: number;
  time_window: string;
}

export interface FinancialSignal {
  amount: number;
  count: number;
  start_date: string;
  end_date: string;
}

export interface TemporalSignal {
  change: string;
  window: string;
}

export interface EvidenceDensitySignal {
  count: number;
  evidence_ids: string[];
}

export interface InsightSignals {
  bridge_signals?: BridgeSignal[];
  communication_signals?: CommunicationSignal[];
  financial_signals?: FinancialSignal[];
  temporal_signals?: TemporalSignal[];
  evidence_density?: EvidenceDensitySignal;
}

export interface InsightV1Adapter {
  insight_id: string;
  case_id: string;
  highlight_reason: string;
  signals: InsightSignals;
  supporting_evidence_ids: string[];
  created_at: string;
}

export interface ScoreBreakdown {
  current_relevance: number;
  temporal_relevance: number;
  structural_signal: number;
  evidence_completeness: number;
  uncertainty_penalty: number;
}

/**
 * Advisory Lead Recommendation (AI-06 / Section 13).
 * Advisory ranking for investigator review tasks based on relevance and evidence completeness.
 * Strictly NOT a crime score, guilt score, or threat score.
 */
export interface LeadV1Adapter {
  lead_id: string;
  case_id: string;
  target_entity_id: string;
  lead_score: number;
  score_breakdown: ScoreBreakdown;
  advisory_notes: string;
  created_at: string;
}
