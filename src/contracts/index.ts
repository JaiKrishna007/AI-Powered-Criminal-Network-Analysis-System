import { z } from 'zod';

// ID formats strictly string matching
export const UserIdSchema = z.string().regex(/^USR-.*$/);
export const CaseIdSchema = z.string().regex(/^CASE-.*$/);
export const EvidenceIdSchema = z.string().regex(/^EVD-.*$/);
export const RelationshipIdSchema = z.string().regex(/^REL-.*$/);
export const InsightIdSchema = z.string().regex(/^INS-.*$/);
export const JobIdSchema = z.string().regex(/^JOB-.*$/);
export const CandidateIdSchema = z.string().regex(/^CAND-.*$/);

// Timestamp strict UTC ISO-8601
export const TimestampSchema = z.string().datetime();

// --- 1. ENTITY.v1 ---
export const EntitySchema = z.object({
  id: z.string(),
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
  properties: z.record(z.string(), z.any()).optional(),
  created_at: TimestampSchema
});

export type RelationshipV1 = z.infer<typeof RelationshipSchema>;

// --- 3. EVIDENCE.v1 ---
export const EvidenceSchema = z.object({
  id: EvidenceIdSchema,
  case_id: CaseIdSchema,
  source_type: z.string(),
  source_ref: z.string(),
  storage_uri: z.string(),
  sha256: z.string().length(64),
  classification: z.string()
});

export type EvidenceV1 = z.infer<typeof EvidenceSchema>;

// --- 4. INSIGHT.v1 ---
export const InsightSchema = z.object({
  id: InsightIdSchema,
  case_id: CaseIdSchema,
  type: z.enum(['ANOMALY', 'PATTERN', 'PREDICTION', 'SUMMARY']),
  content: z.string(),
  confidence: z.number().min(0).max(1),
  supporting_evidence: z.array(EvidenceIdSchema).optional(),
  created_at: TimestampSchema
});

export type InsightV1 = z.infer<typeof InsightSchema>;

// --- 5. INGEST.v1 ---
export const IngestJobSchema = z.object({
  id: JobIdSchema,
  case_id: CaseIdSchema,
  source_ref: z.string(),
  state: z.enum(['QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED']),
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
  status: z.string(),
  owner_id: UserIdSchema,
  classification: z.string()
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

export const GraphResponseSchema = z.object({
  nodes: z.array(z.any()),
  edges: z.array(z.any())
});

export const AIResponseSchema = z.object({
  results: z.array(z.any()),
  insights: z.array(z.any()).optional()
});

export const AnomalyResponseSchema = z.object({
  anomaly_score: z.number().min(0).max(1),
  flags: z.array(z.string()),
  explanation: z.string().optional()
});

export const RelationshipResponseSchema = z.object({
  id: RelationshipIdSchema,
  source_id: z.string(),
  target_id: z.string(),
  type: z.string(),
  weight: z.number().optional()
});
