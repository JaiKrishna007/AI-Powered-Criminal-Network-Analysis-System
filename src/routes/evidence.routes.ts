import { Router, Response } from 'express';
import { AuthMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { IngestionService } from '../services/ingestion.service';
import { db } from '../db';

const router = Router();

router.use(AuthMiddleware.authenticate);

/**
 * BE-01 Ingestion Endpoint
 */
router.post('/ingest', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { case_id, source_type, source_ref, storage_uri, content, classification } = req.body;

    if (!case_id || !source_type || !content) {
      return res.status(400).json({ error: 'MISSING_REQUIRED_FIELDS', message: 'case_id, source_type, and content are required' });
    }

    // Verify case access
    if (!req.user?.roles.includes('SYSTEM ADMIN')) {
      const hasAccess = await db.isUserMemberOfCase(req.user!.id, case_id);
      if (!hasAccess) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'User is not a member of case scope' });
      }
    }

    const result = await IngestionService.processIngestion({
      case_id,
      source_type,
      source_ref: source_ref || 'upload',
      storage_uri: storage_uri || `file://${source_ref || 'upload'}`,
      content,
      classification
    });

    return res.status(200).json({
      status: 'SUCCESS',
      job: result.job,
      evidence: result.evidence,
      candidates: result.candidatesExtracted,
      is_duplicate: result.isDuplicate || false
    });
  } catch (err: any) {
    if (err.code) {
      return res.status(400).json({ error: err.code, message: err.message });
    }
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message || 'Ingestion failure' });
  }
});

/**
 * Get Evidence List for a Case Scope
 */
router.get('/case/:case_id', AuthMiddleware.requireCaseAccess, async (req: AuthenticatedRequest, res: Response) => {
  const caseId = req.params.case_id;
  const list = await db.getEvidenceByCase(caseId);
  return res.status(200).json({ case_id: caseId, evidence: list });
});

export default router;
