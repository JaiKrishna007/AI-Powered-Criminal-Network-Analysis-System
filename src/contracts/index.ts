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

// --- 1. ENTITY.v1 ---
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

// --- 2. REL.v1 ---
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

// --- 3. EVIDENCE.v1 ---
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

// --- 4. INSIGHT.v1 ---
export const InsightSchema = z.object({
  id: InsightIdSchema.optional(),
  case_id: CaseIdSchema.optional(),
  type: z.string(),
  title: z.string().optional(),
  content: z.string().optional(),
  description: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  supporting_entities: z.array(z.string()).optional(),
  supporting_evidence: z.array(EvidenceIdSchema).optional(),
  created_at: TimestampSchema.optional()
});

export type InsightV1 = z.infer<typeof InsightSchema>;

// --- 5. INGEST.v1 ---
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

// --- 6. REPORT.v1 ---
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

// Internal Application Schemas (D2 control plane objects not explicitly in external frozen contract)

export const UserSchema = z.object({
  id: UserIdSchema,
  display_name: z.string(),
  status: z.string(),
  clearance_level: z.number().int().min(0).max(4).optional(),
  password_hash: z.string().optional()
});

export type UserV1 = z.infer<typeof UserSchema>;

export const CaseSchema = z.object({
  id: CaseIdSchema,
  title: z.string(),
  description: z.string().optional(),
  status: z.string(),
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

// --- Downstream Response Validation Schemas (D3/D4/ML) ---
export const MLResponseSchema = z.object({
  probability: z.number().min(0).max(1),
  signals: z.object({
    name_similarity: z.number(),
    phonetic_similarity: z.number(),
    identifier_similarity: z.number(),
    context_similarity: z.number(),
    embedding_similarity: z.number()
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

// Reuse RelationshipSchema for relationship responses (Issue 44)
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
