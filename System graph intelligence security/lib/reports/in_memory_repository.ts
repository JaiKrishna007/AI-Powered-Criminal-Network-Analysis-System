import { REPORT_v1 } from "../contracts/types.js";
import { ReportRepository } from "./repository.js";

export class InMemoryReportRepository implements ReportRepository {
  private reports: Map<string, REPORT_v1> = new Map();

  public async save(report: REPORT_v1): Promise<void> {
    this.reports.set(report.id, report);
  }

  public async getReport(id: string): Promise<REPORT_v1 | undefined> {
    return this.reports.get(id);
  }

  public async getReportsByCase(caseId: string): Promise<REPORT_v1[]> {
    return Array.from(this.reports.values()).filter((r) => r.case_id === caseId);
  }
}
