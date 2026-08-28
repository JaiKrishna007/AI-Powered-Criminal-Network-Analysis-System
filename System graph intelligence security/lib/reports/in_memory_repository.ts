import { REPORT_v1 } from "../contracts/types.js";
import { ReportRepository } from "./repository.js";

export class InMemoryReportRepository implements ReportRepository {
  private reports: Map<string, REPORT_v1> = new Map();

  public async save(report: REPORT_v1): Promise<void> {
    if (this.reports.has(report.id)) {
      throw new Error(`Report ID ${report.id} already exists. Cannot overwrite.`);
    }

    const existingCaseReports = await this.getReportsByCase(report.case_id);
    const versionExists = existingCaseReports.some(
      (r) => r.section_11_version_audit.report_version === report.section_11_version_audit.report_version
    );
    if (versionExists) {
      throw new Error(`Report version ${report.section_11_version_audit.report_version} already finalized for case ${report.case_id}.`);
    }

    this.reports.set(report.id, report);
  }

  public async getReport(id: string): Promise<REPORT_v1 | undefined> {
    return this.reports.get(id);
  }

  public async getReportsByCase(caseId: string): Promise<REPORT_v1[]> {
    return Array.from(this.reports.values()).filter((r) => r.case_id === caseId);
  }
}
