/**
 * PS26189-CONTRACT-v1 Contract Definitions
 * Canonical types and structures for Developer 4 — GRAPH / TRUST
 */

export const CONTRACT_VERSION = "PS26189-CONTRACT-v1";

/**
 * Node Entity Types
 */
export type NodeType =
  | "Person"
  | "Phone"
  | "IMEI"
  | "BankAccount"
  | "Vehicle"
  | "Location"
  | "Organization"
  | "FIR"
  | "Case"
  | "Event";

/**
 * Relationship Types
 */
export type RelationshipType =
  | "CALLED"
  | "TRANSFERRED_MONEY"
  | "USED"
  | "OWNED"
  | "VISITED"
  | "MET_AT"
  | "TRAVELED_WITH"
  | "LINKED_TO"
  | "ASSOCIATED_WITH"
  | "PART_OF_CASE";

/**
 * ENTITY.v1 Schema
 */
export interface ENTITY_v1 {
  id: string;
  type: NodeType;
  case_id?: string;
  event_time?: string; // ISO-8601 UTC string if Event
  properties?: Record<string, any>;
}

/**
 * REL.v1 Schema
 */
export interface REL_v1 {
  id: string;
  source: string; // Source Node ID
  target: string; // Target Node ID
  type: RelationshipType;
  case_id: string;
  evidence_ids: string[];
  event_time?: string; // ISO-8601 UTC string (or undefined if UNKNOWN)
  effective_start?: string; // ISO-8601 UTC string
  effective_end?: string; // ISO-8601 UTC string
  properties?: Record<string, any>;
}

/**
 * CASE.v1 Schema
 */
export interface CASE_v1 {
  id: string;
  name: string;
  description: string;
  created_at: string; // ISO-8601 UTC
}

/**
 * EVIDENCE.v1 Schema
 */
export interface EVIDENCE_v1 {
  id: string;
  case_id: string;
  file_name: string;
  mime_type: string;
  sha256_hash: string;
  stored_hash?: string;
  status?: "VERIFIED" | "MISMATCH";
  created_at: string; // ISO-8601 UTC
  content?: string | Uint8Array;
}

/**
 * GRAPH.v1 Schema
 */
export interface GRAPH_v1 {
  case_id: string;
  nodes: ENTITY_v1[];
  edges: REL_v1[];
  meta: {
    truncated: boolean;
    node_count: number;
    edge_count: number;
  };
}

/**
 * INSIGHT.v1 Schema
 */
export interface INSIGHT_v1 {
  id: string;
  case_id: string;
  type: "POTENTIAL_BRIDGE" | "COMMUNITY" | "CENTRALITY" | "TEMPORAL_CHANGE";
  title: string;
  description: string;
  target_entity_ids: string[];
  evidence_ids: string[];
  timestamp: string; // ISO-8601 UTC
}

/**
 * LEAD.v1 Schema
 */
export interface LEAD_v1 {
  id: string;
  case_id: string;
  title: string;
  description: string;
  evidence_ids: string[];
  created_at: string; // ISO-8601 UTC
}

/**
 * Allowed Resource Types for AUDIT.v1
 */
export type AuditResourceType = "CASE" | "EVIDENCE" | "GRAPH" | "REPORT" | "ADMIN";

/**
 * Allowed Outcomes for AUDIT.v1
 */
export type AuditOutcome = "SUCCESS" | "DENIED" | "ERROR";

/**
 * AUDIT.v1 Schema
 */
export interface AUDIT_v1 {
  event_id: string; // Opaque unique ID
  actor_id: string; // User/service ID
  action: string; // Controlled action code
  resource_type: AuditResourceType;
  resource_id: string;
  timestamp: string; // ISO-8601 UTC
  outcome: AuditOutcome;
  correlation_id: string; // Request/job ID
  details: Record<string, any>; // Minimal non-sensitive metadata
}

/**
 * REPORT.v1 Schema (Contains all 11 required sections)
 */
export interface REPORT_v1 {
  id: string;
  case_id: string;
  title: string;
  generated_at: string; // ISO-8601 UTC
  contract_version: typeof CONTRACT_VERSION;

  section_1_case_summary: CASE_v1;
  section_2_data_sources: EVIDENCE_v1[];
  section_3_key_entities: ENTITY_v1[];
  section_4_relationships: REL_v1[];
  section_5_temporal_findings: {
    period_start?: string;
    period_end?: string;
    snapshot_at?: string;
    diff_added?: REL_v1[];
    diff_removed?: REL_v1[];
    diff_changed?: REL_v1[];
    timeline_events?: REL_v1[];
    unknown_timestamps_count?: number;
  };
  section_6_bridge_findings: INSIGHT_v1[];
  section_7_explainable_findings: INSIGHT_v1[];
  section_8_evidence_references: Array<{
    evidence_id: string;
    linked_nodes_count: number;
    linked_edges_count: number;
  }>;
  section_9_leads: LEAD_v1[];
  section_10_limitations: {
    unknown_timestamps_count: number;
    truncated_graph: boolean;
    disclaimer: string;
  };
  section_11_version_audit: {
    report_version: string;
    audit_events: AUDIT_v1[];
  };
}

/**
 * Authorization Context passed into Graph engine operations
 */
export interface AuthContext {
  actor_id: string;
  correlation_id: string;
  allowed_case_ids: string[];
  role: string;
}
