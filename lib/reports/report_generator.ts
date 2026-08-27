/**
 * GT-09 Report Generator
 * Assembles canonical REPORT.v1 containing all 11 required sections with complete evidence traceability.
 */

import {
  REPORT_v1,
  CASE_v1,
  EVIDENCE_v1,
  ENTITY_v1,
  REL_v1,
  INSIGHT_v1,
  LEAD_v1,
  AUDIT_v1,
  CONTRACT_VERSION,
  AuthContext,
} from "../contracts/types.js";
import { GraphStore } from "../graph/store.js";
import { TemporalEngine } from "../graph/temporal.js";
import { BridgeDetector } from "../graph/analytics/bridge.js";
import { AuditLogger } from "../audit/audit_logger.js";

export interface ReportGenerationInput {
  case_summary: CASE_v1;
  data_sources: EVIDENCE_v1[];
  leads?: LEAD_v1[];
  max_nodes?: number;
}

export class ReportGenerator {
  private temporalEngine: TemporalEngine;
  private bridgeDetector: BridgeDetector;

  constructor(
    private store: GraphStore,
    private auditLogger: AuditLogger = new AuditLogger()
  ) {
    this.temporalEngine = new TemporalEngine(store);
    this.bridgeDetector = new BridgeDetector();
  }

  public generateReport(
    input: ReportGenerationInput,
    auth: AuthContext
  ): REPORT_v1 {
    const { case_summary, data_sources, leads = [], max_nodes = 1000 } = input;
    const caseId = case_summary.id;

    if (!auth.allowed_case_ids.includes(caseId)) {
      this.auditLogger.log(
        auth.actor_id,
        "GENERATE_REPORT",
        "REPORT",
        caseId,
        "DENIED",
        auth.correlation_id,
        { reason: "Unauthorized case_id" }
      );
      throw new Error(`Unauthorized access to case_id: ${caseId}`);
    }

    const graph = this.store.getGraphForCase(caseId, auth, max_nodes);

    // Temporal findings
    const allCaseEdges = this.store.getAllRelationshipsForCase(caseId);
    const unknownTimestampsCount = allCaseEdges.filter(
      (e) => !e.event_time && !e.effective_start
    ).length;

    // Bridge findings
    const bridgeFindings = this.bridgeDetector.detectBridges(
      caseId,
      graph.nodes,
      graph.edges
    );

    // Evidence references traceability
    const evidenceRefMap = new Map<
      string,
      { nodes: Set<string>; edges: Set<string> }
    >();
    data_sources.forEach((ds) => {
      evidenceRefMap.set(ds.id, { nodes: new Set(), edges: new Set() });
    });

    graph.edges.forEach((e) => {
      (e.evidence_ids || []).forEach((evId) => {
        if (!evidenceRefMap.has(evId)) {
          evidenceRefMap.set(evId, { nodes: new Set(), edges: new Set() });
        }
        const ref = evidenceRefMap.get(evId)!;
        ref.edges.add(e.id);
        ref.nodes.add(e.source);
        ref.nodes.add(e.target);
      });
    });

    const evidenceReferences = Array.from(evidenceRefMap.entries()).map(
      ([evId, ref]) => ({
        evidence_id: evId,
        linked_nodes_count: ref.nodes.size,
        linked_edges_count: ref.edges.size,
      })
    );

    const auditEvents = Array.from(this.auditLogger.getLogs());

    const report: REPORT_v1 = {
      id: `report_${caseId}_${Date.now()}`,
      case_id: caseId,
      title: `Intelligence & Trust Report — Case ${case_summary.name}`,
      generated_at: new Date().toISOString(),
      contract_version: CONTRACT_VERSION,

      section_1_case_summary: case_summary,
      section_2_data_sources: data_sources,
      section_3_key_entities: graph.nodes,
      section_4_relationships: graph.edges,
      section_5_temporal_findings: {
        snapshot_at: new Date().toISOString(),
        timeline_events: graph.edges.filter((e) => !!e.event_time),
        unknown_timestamps_count: unknownTimestampsCount,
      },
      section_6_bridge_findings: bridgeFindings,
      section_7_explainable_findings: bridgeFindings, // Deterministic explainable findings
      section_8_evidence_references: evidenceReferences,
      section_9_leads: leads,
      section_10_limitations: {
        unknown_timestamps_count: unknownTimestampsCount,
        truncated_graph: graph.meta.truncated,
        disclaimer:
          "This report presents structural and temporal graph relationships. No legal or criminal culpability is inferred.",
      },
      section_11_version_audit: {
        report_version: "1.0.0",
        audit_events: auditEvents,
      },
    };

    this.auditLogger.log(
      auth.actor_id,
      "GENERATE_REPORT",
      "REPORT",
      report.id,
      "SUCCESS",
      auth.correlation_id,
      { case_id: caseId }
    );

    return report;
  }
}
