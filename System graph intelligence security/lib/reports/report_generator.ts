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
import { ReportRepository } from "./repository.js";
import { InMemoryReportRepository } from "./in_memory_repository.js";

export interface ReportGenerationInput {
  case_summary: CASE_v1;
  data_sources: EVIDENCE_v1[];
  leads?: LEAD_v1[];
  max_nodes?: number;
  report_version?: string; // e.g. "v1", "v2"
  time_start?: string; // Optional period start for temporal diff
  time_end?: string; // Optional period end for temporal diff
}

export class ReportGenerator {
  private temporalEngine: TemporalEngine;
  private bridgeDetector: BridgeDetector;
  private reportRepository: ReportRepository;

  constructor(
    private store: GraphStore,
    private auditLogger: AuditLogger = new AuditLogger(),
    reportRepository?: ReportRepository
  ) {
    this.temporalEngine = new TemporalEngine(store);
    this.bridgeDetector = new BridgeDetector();
    this.reportRepository = reportRepository || new InMemoryReportRepository();
  }

  public async generateReport(
    input: ReportGenerationInput,
    auth: AuthContext
  ): Promise<REPORT_v1> {
    const { case_summary, data_sources, leads = [], max_nodes = 1000, report_version, time_start, time_end } = input;
    const caseId = case_summary.id;

    if (!auth.allowed_case_ids.includes(caseId)) {
      await this.auditLogger.log(
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

    const graph = await this.store.getGraphForCase(caseId, auth, max_nodes);
    const analyticsGraph = await this.store.getAuthorizedAnalyticsGraph(caseId, auth);

    const previousReports = await this.reportRepository.getReportsByCase(caseId);
    previousReports.sort((a, b) => new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime());
    const latestReport = previousReports.length > 0 ? previousReports[0] : undefined;

    let computedVersion = report_version;
    if (!computedVersion) {
      computedVersion = `1.${previousReports.length}`;
    }

    let effectiveTimeStart = time_start;
    if (!effectiveTimeStart && latestReport) {
      effectiveTimeStart = latestReport.generated_at;
    }
    const effectiveTimeEnd = time_end || new Date().toISOString();

    // Temporal findings (Use actual Temporal Engine Diff if timestamps provided or inferred)
    let temporalDiff: any = { added: [], removed: [], changed: [], unknown_timestamps_count: 0 };
    if (effectiveTimeStart) {
      temporalDiff = await this.temporalEngine.compareSnapshots(caseId, effectiveTimeStart, effectiveTimeEnd, auth);
    }

    const allCaseEdges = await this.store.getAllRelationshipsForCase(caseId, auth);
    const unknownTimestampsCount = allCaseEdges.filter(
      (e) => !e.event_time && !e.effective_start && !e.valid_from && !(e.properties && (e.properties.effective_start || e.properties.valid_from))
    ).length;

    // Bridge findings using the unbounded authorized analytics graph
    const bridgeFindings = this.bridgeDetector.detectBridges(
      caseId,
      analyticsGraph.nodes,
      analyticsGraph.edges
    );

    // XAI Explainable findings (Issue 18: Translate bridge insights into explicit XAI formats)
    const explainableFindings: INSIGHT_v1[] = bridgeFindings.map(insight => {
      const properties: any = (insight as any).properties || {};
      
      return {
        ...insight,
        title: `Explainability Details: ${insight.title}`,
        description: `Reasoning: Node ${insight.target_entity_ids[0]} acts as an articulation point or strong bridge (Betweenness: ${properties.normalizedBetweenness?.toFixed(2) || 'N/A'}, Cross-community density: ${properties.crossCommunityDegree?.toFixed(2) || 'N/A'}). Temporal relevance: ${properties.temporalRelevance?.toFixed(2) || 'N/A'}.`,
        // We include confidence, reasons, limitations inside properties
        ...( { properties: {
          confidence: properties.bridgeScore || 0,
          limitations: "Algorithm uses MVP connected components. Cross-community density is an approximation.",
          reasons: properties
        } } as any )
      };
    });

    // Evidence references traceability (Issue 19: Validated against data_sources)
    const validDataSourceIds = new Set(data_sources.map(ds => ds.id));
    
    const evidenceRefMap = new Map<
      string,
      { nodes: Set<string>; edges: Set<string> }
    >();
    
    data_sources.forEach((ds) => {
      evidenceRefMap.set(ds.id, { nodes: new Set(), edges: new Set() });
    });

    for (const e of graph.edges) {
      for (const evId of (e.evidence_ids || [])) {
        // Validate evidence existence
        if (!validDataSourceIds.has(evId)) {
          await this.auditLogger.log(auth.actor_id, "VALIDATE_EVIDENCE", "EVIDENCE", evId, "ERROR", auth.correlation_id, { reason: "Evidence referenced in graph not found in data_sources", edge_id: e.id });
          continue;
        }

        if (!evidenceRefMap.has(evId)) {
          evidenceRefMap.set(evId, { nodes: new Set(), edges: new Set() });
        }
        const ref = evidenceRefMap.get(evId)!;
        ref.edges.add(e.id);
        ref.nodes.add(e.source);
        ref.nodes.add(e.target);
      }
    }

    const evidenceReferences = Array.from(evidenceRefMap.entries()).map(
      ([evId, ref]) => ({
        evidence_id: evId,
        linked_nodes_count: ref.nodes.size,
        linked_edges_count: ref.edges.size,
      })
    );

    const auditEvents = Array.from(await this.auditLogger.getLogs());

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
        period_start: time_start,
        period_end: time_end,
        snapshot_at: new Date().toISOString(),
        diff_added: temporalDiff.added,
        diff_removed: temporalDiff.removed,
        diff_changed: temporalDiff.changed,
        timeline_events: graph.edges.filter((e) => !!e.event_time || !!e.effective_start || !!e.valid_from),
        unknown_timestamps_count: unknownTimestampsCount,
      },
      section_6_bridge_findings: bridgeFindings,
      section_7_explainable_findings: explainableFindings,
      section_8_evidence_references: evidenceReferences,
      section_9_leads: leads,
      section_10_limitations: {
        unknown_timestamps_count: unknownTimestampsCount,
        truncated_graph: graph.meta.truncated,
        disclaimer:
          "This report presents structural and temporal graph relationships. No legal or criminal culpability is inferred.",
      },
      section_11_version_audit: {
        report_version: computedVersion,
        audit_events: auditEvents,
      },
    };

    await this.reportRepository.save(report);

    await this.auditLogger.log(
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
