import { Router, Response } from 'express';
import { AuthMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { db } from '../db';
import { ReportService } from '../services/report.service';
import fs from 'fs';
import path from 'path';
import { REPORTS_DIR } from '../config/paths';

const router = Router();
router.use(AuthMiddleware.authenticate);

/**
 * 23. Report endpoints
 * GET /api/reports/:id
 */
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const report = await db.getReport(req.params.id);
  if (!report) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Report not found' });
  }

  try {
    await AuthMiddleware.authorizeCaseAccess({ userId: req.user!.id, caseId: report.case_id });
  } catch (e) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Not authorized to view reports for this case' });
  }

  return res.status(200).json({ 
    id: report.id,
    case_id: report.case_id,
    status: report.status,
    created_at: report.created_at,
    metadata: { generated_by: report.created_by }
  });
});

/**
 * GET /api/reports/:id/export
 */
router.get('/:id/export', async (req: AuthenticatedRequest, res: Response) => {
  const report = await db.getReport(req.params.id);
  if (!report) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Report not found' });
  }

  try {
    await AuthMiddleware.authorizeCaseAccess({ userId: req.user!.id, caseId: report.case_id });
  } catch (e) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Not authorized to export reports for this case' });
  }

  if (report.status !== 'COMPLETED' || !report.storage_uri) {
    return res.status(400).json({ error: 'NOT_READY', message: 'Report is still generating or failed' });
  }

  const fileName = report.storage_uri.replace('local://', '');
  const filePath = path.resolve(REPORTS_DIR, fileName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'PDF file missing on disk' });
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  
  const readStream = fs.createReadStream(filePath);
  readStream.pipe(res);
});

export default router;
