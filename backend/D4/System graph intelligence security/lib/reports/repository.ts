import { REPORT_v1 } from "../contracts/types.js";

export interface ReportRepository {
  save(report: REPORT_v1): Promise<void>;
  getReport(id: string): Promise<REPORT_v1 | undefined>;
  getReportsByCase(caseId: string): Promise<REPORT_v1[]>;
}
