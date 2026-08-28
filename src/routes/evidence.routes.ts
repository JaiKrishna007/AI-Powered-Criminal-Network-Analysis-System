import { Router, Response } from 'express';
import { AuthMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { AuditMiddleware } from '../middleware/audit';
import { EvidenceService } from '../services/evidence.service';
import { db } from '../db';

const router = Router();

router.use(AuthMiddleware.authenticate);

/**
 * 26. Integrity status
 * GET /api/evidence/:id/integrity
 */
router.get('/:id/integrity', async (req: AuthenticatedRequest, res: Response) => {
  const evidence = await db.getEvidence(req.params.id);
  if (!evidence) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Evidence not found' });
  }

  try {
    await AuthMiddleware.authorizeCaseAccess({
      userId: req.user!.id,
      caseId: evidence.case_id
    });
  } catch (err: any) {
    return res.status(403).json({ error: 'FORBIDDEN', message: err.message || 'Access denied' });
  }

  const integrityResult = await EvidenceService.verifyEvidenceIntegrity(req.params.id);
  return res.status(200).json(integrityResult);
});

/**
 * Get Evidence Metadata
 */
router.get('/:id', AuditMiddleware.auditEvent('EVIDENCE_VIEW'), async (req: AuthenticatedRequest, res: Response) => {
  const evidence = await db.getEvidence(req.params.id);
  if (!evidence) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Evidence not found' });
  }

  try {
    await AuthMiddleware.authorizeCaseAccess({
      userId: req.user!.id,
      caseId: evidence.case_id
    });
  } catch (err: any) {
    return res.status(403).json({ error: 'FORBIDDEN', message: err.message || 'Access denied' });
  }

  return res.status(200).json({ evidence });
});

/**
 * Download Evidence Original Artifact
 */
router.get('/:id/download', AuditMiddleware.auditEvent('EVIDENCE_EXPORT'), async (req: AuthenticatedRequest, res: Response) => {
  const evidence = await db.getEvidence(req.params.id);
  if (!evidence) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Evidence not found' });
  }

  try {
    await AuthMiddleware.authorizeCaseAccess({
      userId: req.user!.id,
      caseId: evidence.case_id
    });
  } catch (err: any) {
    return res.status(403).json({ error: 'FORBIDDEN', message: err.message || 'Access denied' });
  }

  if (!evidence.storage_uri.startsWith('local://')) {
    return res.status(400).json({ error: 'INVALID_STORAGE', message: 'Download only supports local storage in this prototype' });
  }

  const { EVIDENCE_DIR } = require('../config/paths');
  const path = require('path');
  const fs = require('fs');
  const fileName = evidence.storage_uri.replace('local://', '');
  const filePath = path.join(EVIDENCE_DIR, fileName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Artifact file missing' });
  }

  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.sendFile(filePath);
});

export default router;
