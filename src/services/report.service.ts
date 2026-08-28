import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { db } from '../db';
import { Report } from '../models/types';
import { AuthContext, AIClient } from './ai_client';
import { GraphClient } from './graph_client';
import { EvidenceService } from './evidence.service';
import { AuthMiddleware } from '../middleware/auth';
import { REPORTS_DIR } from '../config/paths';

export interface ReportAnalysisStatus {
  graph: 'AVAILABLE' | 'UNAVAILABLE' | 'EMPTY';
  temporal: 'AVAILABLE' | 'UNAVAILABLE' | 'EMPTY';
  bridge: 'AVAILABLE' | 'UNAVAILABLE' | 'EMPTY';
  ai_copilot: 'AVAILABLE' | 'UNAVAILABLE';
  ai_leads: 'AVAILABLE' | 'UNAVAILABLE' | 'EMPTY';
}

export class ReportService {
  /**
   * Generates a 16-section Case Intelligence Report.
   * Dispatches generation via BullMQ asynchronously while persisting GENERATING record.
   * Enforces atomic version sequencing to prevent version race conditions (Issue 18).
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

    // Atomic version calculation (Issue 18)
    let version = 1;
    if (params?.base_report_id) {
      const baseReport = await db.getReport(params.base_report_id);
      if (baseReport && baseReport.case_id === caseId) {
        version = (baseReport.version || 1) + 1;
      }
    } else {
      const existingReports = await db.getReportsByCase(caseId);
      if (existingReports.length > 0) {
        const maxVersion = Math.max(...existingReports.map((r: any) => r.version || 1));
        version = maxVersion + 1;
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

    // Attempt creation with optimistic retry on race condition
    let created = false;
    let attempts = 0;
    while (!created && attempts < 3) {
      try {
        report.version = version;
        report = await db.createReport(report);
        created = true;
      } catch (err: any) {
        if (err.code === 11000 || err.message?.includes('Duplicate report version')) {
          version++;
          attempts++;
        } else {
          throw err;
        }
      }
    }

    // Queue with BullMQ when available, or process asynchronously in background
    const { reportQueue } = await import('../workers/report.queue.js');
    if (reportQueue && process.env.NODE_ENV !== 'test') {
      try {
        await reportQueue.add('generateReport', {
          reportId,
          caseId,
          userContext,
          version,
          params
        });
      } catch (err: any) {
        console.warn(`Failed to enqueue report to BullMQ, falling back to in-process execution: ${err.message}`);
        this.compileReportDirectly(reportId, caseObj, filePath, userContext, version, params).catch(async (e: any) => {
          console.error(`Failed to generate report ${reportId}:`, e);
          await db.updateReport(reportId, {
            status: 'FAILED',
            error: e.message || 'Report generation failed'
          });
        });
      }
    } else {
      if (process.env.NODE_ENV === 'test') {
        try {
          await this.compileReportDirectly(reportId, caseObj, filePath, userContext, version, params);
        } catch (e: any) {
          await db.updateReport(reportId, {
            status: 'FAILED',
            error: e.message || 'Report generation failed'
          });
        }
      } else {
        this.compileReportDirectly(reportId, caseObj, filePath, userContext, version, params).catch(async (e: any) => {
          console.error(`Failed to generate report ${reportId}:`, e);
          await db.updateReport(reportId, {
            status: 'FAILED',
            error: e.message || 'Report generation failed'
          });
        });
      }
    }

    return (await db.getReport(reportId)) || report;
  }

  public static async compileReportDirectly(
    reportId: string,
    caseObj: any,
    filePath: string,
    authCtx: AuthContext,
    version: number,
    params: any
  ) {
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
            const analysisStatus: ReportAnalysisStatus = {
              graph: 'AVAILABLE',
              temporal: 'AVAILABLE',
              bridge: 'AVAILABLE',
              ai_copilot: 'AVAILABLE',
              ai_leads: 'AVAILABLE'
            };

            // Section 1: Case Metadata & Cover Header
            doc.fontSize(22).text('CRIMINAL NETWORK ANALYSIS REPORT', { align: 'center' });
            doc.moveDown(0.5);
            doc.fontSize(14).text(`Operation / Case: ${caseObj.title} (${caseObj.id})`, { align: 'center' });
            doc.fontSize(11).text(`Classification: ${caseObj.classification} | Status: ${caseObj.status}`, { align: 'center' });
            doc.moveDown(1.5);
            doc.fontSize(10).text(`Report Identifier: ${reportId}`);
            doc.text(`Report Version: v${version}`);
            doc.text(`Generated By: ${authCtx.user_id} (${authCtx.role || 'INVESTIGATOR'})`);
            doc.text(`Generated At (UTC): ${new Date().toISOString()}`);
            doc.moveDown();

            // Section 2: Investigation Scope
            doc.fontSize(14).text('2. Investigation Scope', { underline: true });
            doc.moveDown(0.3);
            doc.fontSize(10).text(caseObj.description || 'Targeted criminal network analysis for active law enforcement inquiry.');
            doc.text(`Classification Level: ${caseObj.classification}`);
            doc.moveDown();

            // Section 3: Data Sources
            const evidenceList = await db.getEvidenceByCase(caseObj.id);
            doc.fontSize(14).text('3. Data Sources', { underline: true });
            doc.moveDown(0.3);
            if (evidenceList.length === 0) {
              doc.fontSize(10).text('No physical or digital evidence artifacts uploaded yet.');
            } else {
              for (const ev of evidenceList) {
                doc.fontSize(10).text(`• Source: ${ev.source_ref} (${ev.source_type}) - Storage: ${ev.storage_uri}`);
              }
            }
            doc.moveDown();

            // Section 4: Key Entities
            const candidates = await db.getCandidatesByCase(caseObj.id);
            const acceptedEntities = candidates.filter(c => c.status === 'ACCEPTED');
            doc.fontSize(14).text('4. Key Entities', { underline: true });
            doc.moveDown(0.3);
            if (acceptedEntities.length === 0) {
              doc.fontSize(10).text('No entities accepted for this case yet.');
            } else {
              for (const ent of acceptedEntities) {
                doc.fontSize(10).text(`• [${ent.id}] ${ent.name} (Phone: ${ent.normalized_phone || 'N/A'}) - Resolution Score: ${ent.score}`);
              }
            }
            doc.moveDown();

            // Section 5: Key Relationships
            doc.fontSize(14).text('5. Key Relationships', { underline: true });
            doc.moveDown(0.3);
            doc.fontSize(10).text('Direct relational connections across entities, devices, bank accounts, and locations (CALLED, TRANSFERRED_MONEY, USED, VISITED, MET_AT, LINKED_TO).');
            doc.moveDown();

            // Section 6: Focused Graph Snapshot & Topology Visual (Issues 11 & 12)
            doc.addPage();
            doc.fontSize(14).text('6. Focused Graph Topology & Visual Snapshot', { underline: true });
            doc.moveDown(0.3);
            try {
              const graphData = await GraphClient.getFocusedGraph(authCtx, 'SEED', 2);
              const nodes = graphData?.nodes || [];
              const edges = graphData?.edges || [];

              if (nodes.length === 0) {
                analysisStatus.graph = 'EMPTY';
                doc.fontSize(10).fillColor('#64748B').text('No graph nodes or topological entities discovered for this case.');
                doc.fillColor('#000000');
              } else {
                analysisStatus.graph = 'AVAILABLE';
                doc.fontSize(10).text(`Total Discovered Nodes: ${nodes.length}`);
                doc.text(`Total Discovered Edges: ${edges.length}`);
                doc.moveDown(0.5);

                // Render vector graph visual only when authentic nodes exist (Issue 12)
                const startX = 50;
                const startY = doc.y + 10;
                const boxWidth = 495;
                const boxHeight = 160;

                doc.save();
                doc.rect(startX, startY, boxWidth, boxHeight).fillAndStroke('#F8FAFC', '#CBD5E1');

                const renderNodes = nodes.slice(0, 4);
                const positions = [
                  { x: startX + 70, y: startY + 70 },
                  { x: startX + 200, y: startY + 40 },
                  { x: startX + 330, y: startY + 70 },
                  { x: startX + 200, y: startY + 120 }
                ];

                // Draw edges
                doc.strokeColor('#94A3B8').lineWidth(1.5);
                for (let i = 0; i < renderNodes.length - 1; i++) {
                  const p1 = positions[i % positions.length];
                  const p2 = positions[(i + 1) % positions.length];
                  doc.moveTo(p1.x, p1.y).lineTo(p2.x, p2.y).stroke();
                }

                // Draw authentic nodes
                renderNodes.forEach((node: any, idx: number) => {
                  const pos = positions[idx];
                  const isPerson = (node.type || 'PERSON') === 'PERSON';
                  const fillColor = isPerson ? '#EF4444' : '#3B82F6';

                  doc.circle(pos.x, pos.y, 16).fillColor(fillColor).fillAndStroke(fillColor, '#1E293B');
                  doc.fontSize(7).fillColor('#FFFFFF').text(node.type ? node.type[0] : 'N', pos.x - 3, pos.y - 4);
                  doc.fontSize(8).fillColor('#1E293B').text((node.label || node.id || `Node ${idx + 1}`).substring(0, 18), pos.x - 30, pos.y + 20, { width: 65, align: 'center' });
                });

                doc.restore();
                doc.y = startY + boxHeight + 15;
              }
            } catch (e: any) {
              analysisStatus.graph = 'UNAVAILABLE';
              console.warn(`Graph analysis fetch error for report ${reportId}:`, e);
              doc.fontSize(10).fillColor('#64748B').text('Network topology analysis unavailable.');
              doc.fillColor('#000000');
            }
            doc.moveDown();

            // Section 7: Temporal Findings (Issues 11 & 13)
            doc.fontSize(14).text('7. Temporal Findings', { underline: true });
            doc.moveDown(0.3);
            try {
              const temporal = await GraphClient.getTemporalAnalysis(authCtx, 'latest');
              if (temporal?.summary) {
                analysisStatus.temporal = 'AVAILABLE';
                doc.fontSize(10).text(temporal.summary);
              } else {
                analysisStatus.temporal = 'EMPTY';
                doc.fontSize(10).text('No temporal timeline patterns identified.');
              }
            } catch (e: any) {
              analysisStatus.temporal = 'UNAVAILABLE';
              console.warn(`Temporal analysis fetch error for report ${reportId}:`, e);
              doc.fontSize(10).text('Temporal analysis unavailable.');
            }
            doc.moveDown();

            // Section 8: Bridge / Cluster Findings (Issues 11 & 14)
            doc.fontSize(14).text('8. Bridge & Cluster Findings', { underline: true });
            doc.moveDown(0.3);
            try {
              const bridge = await GraphClient.getBridgeAnalysis(authCtx);
              if (bridge?.key_bridges && bridge.key_bridges.length > 0) {
                analysisStatus.bridge = 'AVAILABLE';
                bridge.key_bridges.forEach((b: any) => doc.fontSize(10).text(`• Bridge Entity: ${b.entity_id} (Betweenness Centrality: ${b.betweenness_score})`));
              } else {
                analysisStatus.bridge = 'EMPTY';
                doc.fontSize(10).text('No critical single-point bridges identified in the network.');
              }
            } catch (e: any) {
              analysisStatus.bridge = 'UNAVAILABLE';
              console.warn(`Bridge analysis fetch error for report ${reportId}:`, e);
              doc.fontSize(10).text('Bridge and cluster analysis unavailable.');
            }
            doc.moveDown();

            // Section 9: AI-Generated Analytical Summary (Issues 11 & 15)
            doc.fontSize(14).text('9. AI-Generated Analytical Summary', { underline: true });
            doc.moveDown(0.3);
            doc.fontSize(8).fillColor('#DC2626').text('[DISCLAIMER: AI-generated analytical summary — strictly investigative inference, not verified factual evidence or human judgment.]');
            doc.fillColor('#000000').moveDown(0.4);
            try {
              const copilotResult = await AIClient.copilot(authCtx, 'Summarize primary network risk and suspicious activities');
              analysisStatus.ai_copilot = 'AVAILABLE';
              doc.fontSize(10).text(`• Analytical Inference: ${copilotResult?.response || 'No anomalous risk patterns flagged.'}`);
              doc.fontSize(9).fillColor('#475569').text(`• Confidence: ${copilotResult?.confidence ? Math.round(copilotResult.confidence * 100) + '%' : 'Probabilistic Model'}`);
              doc.fontSize(9).text('• Supporting Evidence: Referenced case artifacts and normalized entity records.');
              doc.fontSize(9).text('• Analytical Limitations: Requires independent corroboration by case officers prior to executive action.');
              doc.fillColor('#000000');
            } catch (e: any) {
              analysisStatus.ai_copilot = 'UNAVAILABLE';
              console.warn(`AI copilot fetch error for report ${reportId}:`, e);
              doc.fontSize(10).text('AI Copilot analysis unavailable.');
            }
            doc.moveDown();

            // Section 10: Evidence References & Cryptographic Integrity Verification (Issue 17)
            doc.addPage();
            doc.fontSize(14).text('10. Evidence Cryptographic Integrity Verification', { underline: true });
            doc.moveDown(0.3);
            if (evidenceList.length === 0) {
              doc.fontSize(10).text('No physical or digital evidence artifacts uploaded.');
            } else {
              for (const ev of evidenceList) {
                const integrityCheck = await EvidenceService.verifyEvidenceIntegrity(ev.id);
                const integrityStatus = integrityCheck?.integrity?.status || 'UNKNOWN';
                const statusColor = integrityStatus === 'VALID' ? '#16A34A' : integrityStatus === 'TAMPERED' ? '#DC2626' : '#EAB308';
                
                doc.fontSize(9).fillColor('#000000').text(`• Evidence ID: ${ev.id} | Source: ${ev.source_ref} | Stored SHA-256: ${ev.sha256.substring(0, 16)}... | Integrity: `, { continued: true });
                doc.fillColor(statusColor).text(`[${integrityStatus}]`);
                doc.fillColor('#000000');
              }
            }
            doc.moveDown();

            // Section 11: Investigative Leads
            doc.fontSize(14).text('11. Actionable Investigative Leads', { underline: true });
            doc.moveDown(0.3);
            try {
              const leadsResult = await AIClient.generateLeads(authCtx, 'Identify top 3 actionable leads for field units');
              if (leadsResult?.leads && leadsResult.leads.length > 0) {
                analysisStatus.ai_leads = 'AVAILABLE';
                leadsResult.leads.forEach((l: any, idx: number) => {
                  doc.fontSize(10).text(`${idx + 1}. [Priority: ${l.priority || 'MEDIUM'}] ${l.description || l.action}`);
                });
              } else {
                analysisStatus.ai_leads = 'EMPTY';
                doc.fontSize(10).text('No immediate high-priority leads detected.');
              }
            } catch (e: any) {
              analysisStatus.ai_leads = 'UNAVAILABLE';
              console.warn(`AI leads fetch error for report ${reportId}:`, e);
              doc.fontSize(10).text('Investigative lead generation unavailable.');
            }
            doc.moveDown();

            // Section 12: Investigator Notes
            doc.fontSize(14).text('12. Investigator Notes', { underline: true });
            doc.moveDown(0.3);
            doc.fontSize(10).text(params?.investigator_notes || params?.notes || 'No custom notes provided for this report iteration.');
            doc.moveDown();

            // Section 13: Analysis Component Status & Disclaimers (Issue 11)
            doc.fontSize(14).text('13. Intelligence Component Status Summary', { underline: true });
            doc.moveDown(0.3);
            doc.fontSize(9).text(`• Graph Topology Engine (D4): ${analysisStatus.graph}`);
            doc.text(`• Temporal Clustering Engine (D4): ${analysisStatus.temporal}`);
            doc.text(`• Bridge Detection Engine (D4): ${analysisStatus.bridge}`);
            doc.text(`• AI Copilot Synthesis (D3): ${analysisStatus.ai_copilot}`);
            doc.text(`• Investigative Lead Generator (D3): ${analysisStatus.ai_leads}`);
            doc.moveDown();

            // Section 14: Limitations & Caveats
            doc.fontSize(14).text('14. Limitations & Analytical Bounds', { underline: true });
            doc.moveDown(0.3);
            doc.fontSize(10).text('Findings are based on current evidence records and automated probabilistic graph matching models. Low-confidence matches and anomaly flags require field verification by authorized officers.');
            doc.moveDown();

            // Section 15: Audit Ledger Metadata (Issue 16)
            const latestAudit = await db.getLatestAuditEvent();
            const auditHash = latestAudit ? latestAudit.hash : 'GENESIS';

            doc.fontSize(14).text('15. Cryptographic Audit Ledger Metadata', { underline: true });
            doc.moveDown(0.3);
            doc.fontSize(10).text(`Audit Ledger Root Hash: ${auditHash}`);
            doc.text(`Correlation ID: ${authCtx.correlation_id || 'N/A'}`);
            doc.moveDown();

            // Section 16: Version Lineage
            doc.fontSize(14).text('16. Report Version & Lineage', { underline: true });
            doc.moveDown(0.3);
            doc.fontSize(10).text(`Current Version: ${version}`);
            doc.text(`Base Report Reference: ${params?.base_report_id || 'Initial Genesis Report'}`);
            doc.text(`Generated At: ${new Date().toISOString()}`);

            doc.end();

            // Store analysis_status in report record (Issue 11)
            await db.updateReport(reportId, {
              parameters: {
                ...params,
                analysis_status: analysisStatus
              }
            });
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
