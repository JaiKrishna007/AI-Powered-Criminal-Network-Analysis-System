import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { db } from '../db';
import { REPORTS_DIR } from '../config/paths';
import { Report } from '../models/types';
import { AuthContext } from './ai_client';
import { GraphClient } from './graph_client';
import { AuthMiddleware } from '../middleware/auth';

if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

export class ReportService {
  /**
   * Generates a comprehensive PDF report for a given case and stores it in the REPORTS_DIR.
   * Enforces D2 authorization and propagates authentic user context.
   */
  static async generateCaseReport(userContext: AuthContext, params: any): Promise<Report> {
    const caseId = userContext.case_id;
    const userId = userContext.user_id;

    // 1. Explicit D2 Authorization Check
    await AuthMiddleware.authorizeCaseAccess({ userId, caseId });

    const caseObj = await db.getCase(caseId);
    if (!caseObj) {
      throw new Error(`Case ${caseId} not found`);
    }

    const reportId = `REP-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const fileName = `${reportId}.pdf`;
    const filePath = path.join(REPORTS_DIR, fileName);

    let version = 1;
    if (params?.base_report_id) {
      const baseReport = await db.getReport(params.base_report_id);
      if (baseReport && baseReport.case_id === caseId) {
        version = (baseReport.version || 1) + 1;
      }
    }

    // Initial record with GENERATING status
    let report: Report = {
      id: reportId,
      case_id: caseId,
      created_by: userId,
      status: 'GENERATING',
      version,
      base_report_id: params?.base_report_id,
      parameters: params,
      created_at: new Date().toISOString()
    };
    report = await db.createReport(report);

    // Fetch case data and compile asynchronously
    this.compileReportContent(reportId, caseObj, filePath, userContext).catch(async (e: any) => {
      console.error(`Failed to generate report ${reportId}:`, e);
      await db.updateReport(reportId, {
        status: 'FAILED',
        error: e.message || 'Report generation failed'
      });
    });

    return report;
  }

  private static async compileReportContent(reportId: string, caseObj: any, filePath: string, authCtx: AuthContext) {
    return new Promise<string>((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const writeStream = fs.createWriteStream(filePath);
        
        doc.pipe(writeStream);

        writeStream.on('error', async (err) => {
          await db.updateReport(reportId, {
            status: 'FAILED',
            error: err.message || 'File stream error during PDF generation'
          });
          reject(err);
        });

        writeStream.on('finish', async () => {
          try {
            await db.updateReport(reportId, {
              status: 'COMPLETED',
              storage_uri: `local://${path.basename(filePath)}`
            });
            resolve(filePath);
          } catch (dbErr) {
            reject(dbErr);
          }
        });

        (async () => {
          try {
            // 1. Cover Page
            doc.fontSize(24).text('CRIMINAL NETWORK ANALYSIS REPORT', { align: 'center' });
            doc.moveDown();
            doc.fontSize(16).text(`Operation: ${caseObj.title}`, { align: 'center' });
            doc.fontSize(12).text(`Classification: ${caseObj.classification}`, { align: 'center' });
            doc.moveDown(2);
            doc.text(`Report ID: ${reportId}`);
            doc.text(`Generated At: ${new Date().toISOString()}`);
            doc.text(`Case Status: ${caseObj.status}`);
            doc.addPage();

            // 2. Fetch Entities and Candidates
            const candidates = await db.getCandidatesByCase(caseObj.id);
            const acceptedEntities = candidates.filter(c => c.status === 'ACCEPTED');

            doc.fontSize(18).text('1. Identified Entities', { underline: true });
            doc.moveDown();
            if (acceptedEntities.length === 0) {
              doc.fontSize(12).text('No entities accepted for this case yet.');
            } else {
              for (const ent of acceptedEntities) {
                doc.fontSize(12).text(`- ${ent.name} (Phone: ${ent.normalized_phone || 'Unknown'}) [Score: ${ent.score}]`);
              }
            }
            doc.addPage();

            // 3. Evidence Sources
            const evidenceList = await db.getEvidenceByCase(caseObj.id);
            doc.fontSize(18).text('2. Evidence & Data Sources', { underline: true });
            doc.moveDown();
            for (const ev of evidenceList) {
              doc.fontSize(12).text(`- ${ev.source_ref} (${ev.source_type}) [Hash: ${ev.sha256.substring(0, 16)}...]`);
            }
            doc.addPage();

            // 4. Graph Snapshot & AI Findings
            // Use requesting user's actual auth context (never manufactured ADMIN context)
            doc.fontSize(18).text('3. Network Analysis Findings', { underline: true });
            doc.moveDown();
            try {
              const temporal = await GraphClient.getTemporalAnalysis(authCtx, 'latest');
              doc.fontSize(12).text('Temporal Summary:');
              doc.text(temporal.summary || 'Insufficient data for temporal analysis.');
              doc.moveDown();

              const bridge = await GraphClient.getBridgeAnalysis(authCtx);
              doc.text('Key Structural Bridges:');
              if (bridge.key_bridges && bridge.key_bridges.length > 0) {
                bridge.key_bridges.forEach((b: any) => doc.text(`- Node ${b.entity_id} (Betweenness: ${b.betweenness_score})`));
              } else {
                doc.text('No critical bridges identified.');
              }
            } catch (e: any) {
              doc.fontSize(12).fillColor('red').text(`Analysis failed: ${e.message}`).fillColor('black');
            }

            // 5. Limitations & Caveats
            doc.addPage();
            doc.fontSize(18).text('4. Limitations & Integrity', { underline: true });
            doc.moveDown();
            doc.fontSize(12).text('This report was generated automatically. Findings are based on extracted evidence and AI models which may contain inaccuracies. All evidence hashes are permanently stored in the audit ledger.');

            doc.end();
          } catch (compilationErr) {
            writeStream.destroy();
            await db.updateReport(reportId, {
              status: 'FAILED',
              error: (compilationErr as any).message || 'Failed during PDF content building'
            });
            reject(compilationErr);
          }
        })();

      } catch (err: any) {
        db.updateReport(reportId, {
          status: 'FAILED',
          error: err.message || 'Report initialization failed'
        }).finally(() => reject(err));
      }
    });
  }
}

