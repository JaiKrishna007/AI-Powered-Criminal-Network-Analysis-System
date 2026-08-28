/**
 * Developer 4 — Analytics Worker
 * Lightweight in-process asynchronous execution worker for graph analytics,
 * bridge detection, temporal diffing, and report generation.
 */

import { AuthContext, REPORT_v1, CASE_v1, EVIDENCE_v1 } from "../lib/contracts/types.js";
import { GraphStore } from "../lib/graph/store.js";
import { ReportGenerator } from "../lib/reports/report_generator.js";
import { BridgeDetector } from "../lib/graph/analytics/bridge.js";
import { TemporalEngine } from "../lib/graph/temporal.js";
import { AuditLogger } from "../lib/audit/audit_logger.js";

export interface AnalyticsJob {
  id: string;
  case_id: string;
  type: "FULL_ANALYTICS" | "BRIDGE_DETECTION" | "TEMPORAL_DIFF" | "REPORT_GEN";
  auth: AuthContext;
  payload?: {
    case_summary?: CASE_v1;
    data_sources?: EVIDENCE_v1[];
    time1?: string;
    time2?: string;
  };
}

export class AnalyticsWorker {
  private auditLogger: AuditLogger;
  private reportGenerator: ReportGenerator;
  private bridgeDetector: BridgeDetector;
  private temporalEngine: TemporalEngine;

  constructor(private store: GraphStore, auditLogger?: AuditLogger) {
    this.auditLogger = auditLogger || new AuditLogger();
    this.reportGenerator = new ReportGenerator(this.store, this.auditLogger);
    this.bridgeDetector = new BridgeDetector();
    this.temporalEngine = new TemporalEngine(this.store);
  }

  /**
   * Process analytics job asynchronously in-process.
   */
  public async processJob(job: AnalyticsJob): Promise<any> {
    const { case_id, auth, type, payload } = job;

    if (!auth.allowed_case_ids.includes(case_id)) {
      this.auditLogger.log(
        auth.actor_id,
        "PROCESS_JOB",
        "ADMIN",
        job.id,
        "DENIED",
        auth.correlation_id,
        { reason: "Unauthorized case_id", type }
      );
      throw new Error(`Unauthorized case_id: ${case_id}`);
    }

    this.auditLogger.log(
      auth.actor_id,
      "PROCESS_JOB",
      "ADMIN",
      job.id,
      "SUCCESS",
      auth.correlation_id,
      { type, case_id }
    );

    switch (type) {
      case "BRIDGE_DETECTION": {
        const graph = await this.store.getGraphForCase(case_id, auth);
        return this.bridgeDetector.detectBridges(case_id, graph.nodes, graph.edges);
      }

      case "TEMPORAL_DIFF": {
        if (!payload?.time1 || !payload?.time2) {
          throw new Error("Missing time1 or time2 for TEMPORAL_DIFF job");
        }
        return await this.temporalEngine.compareSnapshots(case_id, payload.time1, payload.time2);
      }

      case "REPORT_GEN": {
        if (!payload?.case_summary || !payload?.data_sources) {
          throw new Error("Missing case_summary or data_sources for REPORT_GEN job");
        }
        return await this.reportGenerator.generateReport(
          {
            case_summary: payload.case_summary,
            data_sources: payload.data_sources,
          },
          auth
        );
      }

      case "FULL_ANALYTICS":
      default: {
        const graph = await this.store.getGraphForCase(case_id, auth);
        const bridges = this.bridgeDetector.detectBridges(case_id, graph.nodes, graph.edges);
        return {
          graph,
          bridges,
        };
      }
    }
  }
}
