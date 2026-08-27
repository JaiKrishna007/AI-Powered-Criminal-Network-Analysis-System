import { NextResponse } from 'next/server';
import { mockDB } from '@/lib/client-contracts/mockData';
import { handleProxyOrFallback } from '@/lib/client-contracts/proxyHelper';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const reportId = params.id;
  return handleProxyOrFallback(request, `/api/reports/${reportId}`, async () => {
    // Find report by ID (e.g. RPT-1042)
    let report = mockDB.reports[reportId];
    
    // If not found directly, check if the param is actually a case_id (e.g. CASE-1042)
    if (!report) {
      const caseReport = Object.values(mockDB.reports).find((r) => r.case_id === reportId);
      if (caseReport) {
        report = caseReport;
      }
    }

    if (!report) {
      // Generate default report for this case if not exists
      const caseObj = mockDB.cases.find((c) => c.id === reportId);
      if (!caseObj) {
        return NextResponse.json({ error: 'Report or Case not found' }, { status: 404 });
      }
      
      report = {
        id: `RPT-${caseObj.id.split('-')[1]}`,
        case_id: caseObj.id,
        version: 1,
        status: 'DRAFT',
        created_by: 'Investigator Arash',
        created_at: new Date().toISOString(),
        sections: {
          summary: `Auto-generated investigative briefing for ${caseObj.title}.`,
          findings: [
            'No specific findings compiled yet.'
          ],
          limitations: [
            'Initial assessment phase only.'
          ]
        }
      };
      mockDB.reports[report.id] = report;
    }

    return NextResponse.json(report);
  });
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const reportId = params.id;
  return handleProxyOrFallback(request, `/api/reports/${reportId}`, async () => {
    try {
      const clonedRequest = request.clone();
      const body = await clonedRequest.json();
      const { summary, findings, limitations, status } = body;
      
      let report = mockDB.reports[reportId];
      if (!report) {
        const caseReport = Object.values(mockDB.reports).find((r) => r.case_id === reportId);
        if (caseReport) {
          report = caseReport;
        }
      }
      
      if (!report) {
        return NextResponse.json({ error: 'Report not found' }, { status: 404 });
      }
      
      // If status is transitioning to FINALIZED, we increment the version to preserve history (FR-26)
      if (status === 'FINALIZED' && report.status !== 'FINALIZED') {
        report.version += 1;
      }
      
      if (summary) report.sections.summary = summary;
      if (findings) report.sections.findings = findings;
      if (limitations) report.sections.limitations = limitations;
      if (status) report.status = status;
      report.created_at = new Date().toISOString();
      
      mockDB.reports[report.id] = report;
      
      return NextResponse.json(report);
    } catch (error) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
  });
}
