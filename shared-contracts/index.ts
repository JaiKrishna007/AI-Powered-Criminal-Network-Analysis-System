import { z } from 'zod';

// ID formats strictly string matching
export const UserIdSchema = z.string().regex(/^USR-.*$/);
export const CaseIdSchema = z.string().regex(/^CASE-.*$/);
export const EvidenceIdSchema = z.string().regex(/^EVD-.*$/);
export const RelationshipIdSchema = z.string().regex(/^REL-.*$/);
export const InsightIdSchema = z.string().regex(/^INS-.*$/);
export const JobIdSchema = z.string().regex(/^JOB-.*$/);
export const CandidateIdSchema = z.string().regex(/^CAND-.*$/);
export const EntityIdSchema = z.string().regex(/^ENT-.*$/);

// Timestamp strict UTC ISO-8601
export const TimestampSchema = z.string().datetime();

// --- 1. ENTITY.v1 (D2 Zod Definition) ---
export const EntitySchema = z.object({
  id: EntityIdSchema,
  name: z.string(),
  type: z.string(),
  identifiers: z.record(z.string(), z.string()).optional(),
  properties: z.record(z.string(), z.any()).optional(),
  created_at: TimestampSchema,
  updated_at: TimestampSchema.optional()
});

export type EntityV1 = z.infer<typeof EntitySchema>;

// --- 2. REL.v1 (D2 Zod Definition) ---
export const RelationshipSchema = z.object({
  id: RelationshipIdSchema,
  source_id: z.string(),
  target_id: z.string(),
  type: z.string(),
  weight: z.number().min(0).max(1).optional(),
  evidence_ids: z.array(z.string()).optional(),
  properties: z.record(z.string(), z.any()).optional(),
  created_at: TimestampSchema
});

export type RelationshipV1 = z.infer<typeof RelationshipSchema>;

// Classification Clearance Scope Enum
export const ClassificationLevels = [
  'PUBLIC',
  'UNCLASSIFIED',
  'CONFIDENTIAL',
  'CASE_RESTRICTED',
  'RESTRICTED',
  'SENSITIVE',
  'SECRET',
  'TOP_SECRET'
] as const;

export const ClassificationSchema = z.enum(ClassificationLevels);
export type ClassificationType = z.infer<typeof ClassificationSchema>;

// --- 3. EVIDENCE.v1 (D2 Zod Definition) ---
export const EvidenceSchema = z.object({
  id: EvidenceIdSchema,
  case_id: CaseIdSchema,
  source_type: z.string(),
  source_ref: z.string(),
  storage_uri: z.string(),
  sha256: z.string().length(64),
  classification: ClassificationSchema
});

export type EvidenceV1 = z.infer<typeof EvidenceSchema>;

// --- 4. INSIGHT.v1 (D2 Zod Definition) ---
export const InsightSchema = z.object({
  id: InsightIdSchema.optional(),
  case_id: CaseIdSchema.optional(),
  type: z.string(),
  title: z.string().optional(),
  content: z.string().optional(),
  description: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  supporting_entities: z.array(z.string()).optional(),
  target_entity_ids: z.array(z.string()).optional(),
  supporting_evidence: z.array(EvidenceIdSchema).optional(),
  evidence_ids: z.array(z.string()).optional(),
  created_at: TimestampSchema.optional(),
  timestamp: TimestampSchema.optional()
});

export type InsightV1 = z.infer<typeof InsightSchema>;

// --- 5. INGEST.v1 (D2 Zod Definition) ---
export const IngestJobSchema = z.object({
  id: JobIdSchema,
  case_id: CaseIdSchema,
  source_ref: z.string(),
  state: z.enum(['QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED']),
  warnings: z.array(z.string()).optional(),
  graph_sync: z.enum(['SYNCED', 'FAILED', 'PENDING', 'SKIPPED']).optional(),
  error: z.string().nullable().optional()
});

export type IngestJobV1 = z.infer<typeof IngestJobSchema>;

// --- 6. REPORT.v1 (D2 Zod Definition) ---
export const ReportIdSchema = z.string().regex(/^REP-.*$/);
export const ReportSchema = z.object({
  id: ReportIdSchema,
  case_id: CaseIdSchema,
  created_by: UserIdSchema,
  status: z.enum(['GENERATING', 'COMPLETED', 'FAILED']),
  storage_uri: z.string().optional(),
  version: z.number().int().default(1),
  base_report_id: ReportIdSchema.optional(),
  parameters: z.record(z.string(), z.any()).optional(),
  error: z.string().optional(),
  created_at: TimestampSchema
});

export type ReportV1 = z.infer<typeof ReportSchema>;

// Internal Application Schemas
export const UserSchema = z.object({
  id: UserIdSchema,
  username: z.string().optional(),
  display_name: z.string(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'DISABLED']),
  clearance_level: z.number().int().min(0).max(4).optional(),
  password_hash: z.string().optional()
});

export type UserV1 = z.infer<typeof UserSchema>;

export const CaseSchema = z.object({
  id: CaseIdSchema,
  title: z.string(),
  description: z.string().optional(),
  status: z.enum(['ACTIVE', 'CLOSED', 'ARCHIVED']),
  owner_id: UserIdSchema,
  classification: ClassificationSchema
});
export type CaseV1 = z.infer<typeof CaseSchema>;

export const AuditEventRefSchema = z.object({
  event_id: z.string(),
  case_id: CaseIdSchema.nullable().optional(),
  actor_id: UserIdSchema,
  action: z.string(),
  hash: z.string(),
  previous_hash: z.string()
});
export type AuditEventRefV1 = z.infer<typeof AuditEventRefSchema>;

// Downstream Response Validation Schemas
export const MLResponseSchema = z.object({
  probability: z.number().min(0).max(1).nullable(),
  signals: z.object({
    name_similarity: z.number(),
    phonetic_similarity: z.number(),
    identifier_similarity: z.number(),
    context_similarity: z.number(),
    lexical_similarity: z.number()
  }).optional()
});

export const GraphNodeSchema = z.object({
  id: z.string(),
  label: z.string().optional(),
  type: z.string().optional(),
  properties: z.record(z.string(), z.any()).optional()
});

export const GraphEdgeSchema = z.object({
  source: z.string(),
  target: z.string(),
  type: z.string(),
  weight: z.number().optional(),
  properties: z.record(z.string(), z.any()).optional()
});

export const GraphResponseSchema = z.object({
  nodes: z.array(GraphNodeSchema),
  edges: z.array(GraphEdgeSchema)
});

export const AISearchResultSchema = z.object({
  id: z.string(),
  evidence_id: z.string().optional(),
  score: z.number().optional(),
  snippet: z.string().optional(),
  source: z.string().optional()
});

export const AIResponseSchema = z.object({
  status: z.string().optional(),
  results: z.array(AISearchResultSchema),
  insights: z.array(InsightSchema).optional()
});

export const AnomalyResponseSchema = z.object({
  anomaly_score: z.number().min(0).max(1),
  flags: z.array(z.string()),
  explanation: z.string().optional()
});

export const RelationshipResponseSchema = RelationshipSchema;

export const TemporalAnalysisResponseSchema = z.object({
  insights: z.array(InsightSchema).optional(),
  summary: z.string().optional()
});

export const BridgeAnalysisResponseSchema = z.object({
  insights: z.array(InsightSchema).optional(),
  key_bridges: z.array(
    z.object({
      entity_id: z.string(),
      betweenness_score: z.number()
    })
  ).optional()
});

// --- 7. ENTITY_RESOLUTION.v1 ---
export const EntityResolutionEventSchema = z.object({
  candidate_id: CandidateIdSchema,
  case_id: CaseIdSchema,
  decision: z.enum(['ACCEPTED', 'REJECTED', 'DEFERRED']),
  canonical_entity: EntitySchema.optional(),
  reviewer_id: UserIdSchema,
  decided_at: TimestampSchema
});

export type EntityResolutionEventV1 = z.infer<typeof EntityResolutionEventSchema>;

// =====================================================================
// D4 Contracts (Types and Interfaces)
// =====================================================================

export const CONTRACT_VERSION = "PS26189-CONTRACT-v1";

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

export interface ENTITY_v1 {
  id: string;
  type: NodeType;
  case_id: string;
  event_time?: string; // ISO-8601 UTC string if Event
  properties?: Record<string, any>;
}

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

export interface CASE_v1 {
  id: string;
  name: string;
  description: string;
  created_at: string; // ISO-8601 UTC
}

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

export interface INSIGHT_v1 {
  id: string;
  case_id: string;
  type: "POTENTIAL_BRIDGE" | "COMMUNITY" | "CENTRALITY" | "TEMPORAL_CHANGE";
  title: string;
  description: string;
  target_entity_ids: string[];
  supporting_entities?: string[];
  evidence_ids: string[];
  timestamp: string; // ISO-8601 UTC
}

export interface LEAD_v1 {
  id: string;
  case_id: string;
  title: string;
  description: string;
  evidence_ids: string[];
  created_at: string; // ISO-8601 UTC
}

export type AuditResourceType = "CASE" | "EVIDENCE" | "GRAPH" | "REPORT" | "ADMIN";
export type AuditOutcome = "SUCCESS" | "DENIED" | "ERROR";

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

export interface AuthContext {
  user_id: string;
  actor_id: string;
  role: string;
  case_id: string;
  allowed_case_ids: string[];
  access_level: string;
  correlation_id?: string;
}
