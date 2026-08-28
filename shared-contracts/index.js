"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONTRACT_VERSION = exports.EntityResolutionEventSchema = exports.BridgeAnalysisResponseSchema = exports.TemporalAnalysisResponseSchema = exports.RelationshipResponseSchema = exports.AnomalyResponseSchema = exports.AIResponseSchema = exports.AISearchResultSchema = exports.GraphResponseSchema = exports.GraphEdgeSchema = exports.GraphNodeSchema = exports.MLResponseSchema = exports.AuditEventRefSchema = exports.CaseSchema = exports.UserSchema = exports.ReportSchema = exports.ReportIdSchema = exports.IngestJobSchema = exports.InsightSchema = exports.EvidenceSchema = exports.ClassificationSchema = exports.ClassificationLevels = exports.RelationshipSchema = exports.EntitySchema = exports.TimestampSchema = exports.EntityIdSchema = exports.CandidateIdSchema = exports.JobIdSchema = exports.InsightIdSchema = exports.RelationshipIdSchema = exports.EvidenceIdSchema = exports.CaseIdSchema = exports.UserIdSchema = void 0;
const zod_1 = require("zod");
// ID formats strictly string matching
exports.UserIdSchema = zod_1.z.string().regex(/^USR-.*$/);
exports.CaseIdSchema = zod_1.z.string().regex(/^CASE-.*$/);
exports.EvidenceIdSchema = zod_1.z.string().regex(/^EVD-.*$/);
exports.RelationshipIdSchema = zod_1.z.string().regex(/^REL-.*$/);
exports.InsightIdSchema = zod_1.z.string().regex(/^INS-.*$/);
exports.JobIdSchema = zod_1.z.string().regex(/^JOB-.*$/);
exports.CandidateIdSchema = zod_1.z.string().regex(/^CAND-.*$/);
exports.EntityIdSchema = zod_1.z.string().regex(/^ENT-.*$/);
// Timestamp strict UTC ISO-8601
exports.TimestampSchema = zod_1.z.string().datetime();
// --- 1. ENTITY.v1 (D2 Zod Definition) ---
exports.EntitySchema = zod_1.z.object({
    id: exports.EntityIdSchema,
    name: zod_1.z.string(),
    type: zod_1.z.string(),
    identifiers: zod_1.z.record(zod_1.z.string(), zod_1.z.string()).optional(),
    properties: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
    created_at: exports.TimestampSchema,
    updated_at: exports.TimestampSchema.optional()
});
// --- 2. REL.v1 (D2 Zod Definition) ---
exports.RelationshipSchema = zod_1.z.object({
    id: exports.RelationshipIdSchema,
    source_id: zod_1.z.string(),
    target_id: zod_1.z.string(),
    type: zod_1.z.string(),
    weight: zod_1.z.number().min(0).max(1).optional(),
    evidence_ids: zod_1.z.array(zod_1.z.string()).optional(),
    properties: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
    created_at: exports.TimestampSchema
});
// Classification Clearance Scope Enum
exports.ClassificationLevels = [
    'PUBLIC',
    'UNCLASSIFIED',
    'CONFIDENTIAL',
    'CASE_RESTRICTED',
    'RESTRICTED',
    'SENSITIVE',
    'SECRET',
    'TOP_SECRET'
];
exports.ClassificationSchema = zod_1.z.enum(exports.ClassificationLevels);
// --- 3. EVIDENCE.v1 (D2 Zod Definition) ---
exports.EvidenceSchema = zod_1.z.object({
    id: exports.EvidenceIdSchema,
    case_id: exports.CaseIdSchema,
    source_type: zod_1.z.string(),
    source_ref: zod_1.z.string(),
    storage_uri: zod_1.z.string(),
    sha256: zod_1.z.string().length(64),
    classification: exports.ClassificationSchema
});
// --- 4. INSIGHT.v1 (D2 Zod Definition) ---
exports.InsightSchema = zod_1.z.object({
    id: exports.InsightIdSchema.optional(),
    case_id: exports.CaseIdSchema.optional(),
    type: zod_1.z.string(),
    title: zod_1.z.string().optional(),
    content: zod_1.z.string().optional(),
    description: zod_1.z.string().optional(),
    confidence: zod_1.z.number().min(0).max(1).optional(),
    supporting_entities: zod_1.z.array(zod_1.z.string()).optional(),
    supporting_evidence: zod_1.z.array(exports.EvidenceIdSchema).optional(),
    created_at: exports.TimestampSchema.optional()
});
// --- 5. INGEST.v1 (D2 Zod Definition) ---
exports.IngestJobSchema = zod_1.z.object({
    id: exports.JobIdSchema,
    case_id: exports.CaseIdSchema,
    source_ref: zod_1.z.string(),
    state: zod_1.z.enum(['QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED']),
    warnings: zod_1.z.array(zod_1.z.string()).optional(),
    graph_sync: zod_1.z.enum(['SYNCED', 'FAILED', 'PENDING', 'SKIPPED']).optional(),
    error: zod_1.z.string().nullable().optional()
});
// --- 6. REPORT.v1 (D2 Zod Definition) ---
exports.ReportIdSchema = zod_1.z.string().regex(/^REP-.*$/);
exports.ReportSchema = zod_1.z.object({
    id: exports.ReportIdSchema,
    case_id: exports.CaseIdSchema,
    created_by: exports.UserIdSchema,
    status: zod_1.z.enum(['GENERATING', 'COMPLETED', 'FAILED']),
    storage_uri: zod_1.z.string().optional(),
    version: zod_1.z.number().int().default(1),
    base_report_id: exports.ReportIdSchema.optional(),
    parameters: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
    error: zod_1.z.string().optional(),
    created_at: exports.TimestampSchema
});
// Internal Application Schemas
exports.UserSchema = zod_1.z.object({
    id: exports.UserIdSchema,
    username: zod_1.z.string().optional(),
    display_name: zod_1.z.string(),
    status: zod_1.z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'DISABLED']),
    clearance_level: zod_1.z.number().int().min(0).max(4).optional(),
    password_hash: zod_1.z.string().optional()
});
exports.CaseSchema = zod_1.z.object({
    id: exports.CaseIdSchema,
    title: zod_1.z.string(),
    description: zod_1.z.string().optional(),
    status: zod_1.z.enum(['ACTIVE', 'CLOSED', 'ARCHIVED']),
    owner_id: exports.UserIdSchema,
    classification: exports.ClassificationSchema
});
exports.AuditEventRefSchema = zod_1.z.object({
    event_id: zod_1.z.string(),
    case_id: exports.CaseIdSchema.nullable().optional(),
    actor_id: exports.UserIdSchema,
    action: zod_1.z.string(),
    hash: zod_1.z.string(),
    previous_hash: zod_1.z.string()
});
// Downstream Response Validation Schemas
exports.MLResponseSchema = zod_1.z.object({
    probability: zod_1.z.number().min(0).max(1).nullable(),
    signals: zod_1.z.object({
        name_similarity: zod_1.z.number(),
        phonetic_similarity: zod_1.z.number(),
        identifier_similarity: zod_1.z.number(),
        context_similarity: zod_1.z.number(),
        lexical_similarity: zod_1.z.number()
    }).optional()
});
exports.GraphNodeSchema = zod_1.z.object({
    id: zod_1.z.string(),
    label: zod_1.z.string().optional(),
    type: zod_1.z.string().optional(),
    properties: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional()
});
exports.GraphEdgeSchema = zod_1.z.object({
    source: zod_1.z.string(),
    target: zod_1.z.string(),
    type: zod_1.z.string(),
    weight: zod_1.z.number().optional(),
    properties: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional()
});
exports.GraphResponseSchema = zod_1.z.object({
    nodes: zod_1.z.array(exports.GraphNodeSchema),
    edges: zod_1.z.array(exports.GraphEdgeSchema)
});
exports.AISearchResultSchema = zod_1.z.object({
    id: zod_1.z.string(),
    evidence_id: zod_1.z.string().optional(),
    score: zod_1.z.number().optional(),
    snippet: zod_1.z.string().optional(),
    source: zod_1.z.string().optional()
});
exports.AIResponseSchema = zod_1.z.object({
    status: zod_1.z.string().optional(),
    results: zod_1.z.array(exports.AISearchResultSchema),
    insights: zod_1.z.array(exports.InsightSchema).optional()
});
exports.AnomalyResponseSchema = zod_1.z.object({
    anomaly_score: zod_1.z.number().min(0).max(1),
    flags: zod_1.z.array(zod_1.z.string()),
    explanation: zod_1.z.string().optional()
});
exports.RelationshipResponseSchema = exports.RelationshipSchema;
exports.TemporalAnalysisResponseSchema = zod_1.z.object({
    insights: zod_1.z.array(exports.InsightSchema).optional(),
    summary: zod_1.z.string().optional()
});
exports.BridgeAnalysisResponseSchema = zod_1.z.object({
    insights: zod_1.z.array(exports.InsightSchema).optional(),
    key_bridges: zod_1.z.array(zod_1.z.object({
        entity_id: zod_1.z.string(),
        betweenness_score: zod_1.z.number()
    })).optional()
});
// --- 7. ENTITY_RESOLUTION.v1 ---
exports.EntityResolutionEventSchema = zod_1.z.object({
    candidate_id: exports.CandidateIdSchema,
    case_id: exports.CaseIdSchema,
    decision: zod_1.z.enum(['ACCEPTED', 'REJECTED', 'DEFERRED']),
    canonical_entity: exports.EntitySchema.optional(),
    reviewer_id: exports.UserIdSchema,
    decided_at: exports.TimestampSchema
});
// =====================================================================
// D4 Contracts (Types and Interfaces)
// =====================================================================
exports.CONTRACT_VERSION = "PS26189-CONTRACT-v1";
