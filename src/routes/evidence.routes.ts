import { Router, Response } from 'express';
import { AuthMiddleware, AuthenticatedRequest } from '../middleware/auth';
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

  // Authorize based on case membership
  if (!req.user!.roles.includes('SYSTEM ADMIN')) {
    const hasAccess = await db.isUserMemberOfCase(req.user!.id, evidence.case_id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Not authorized for this case scope' });
    }
  }

  const integrityResult = await EvidenceService.verifyEvidenceIntegrity(req.params.id);
  return res.status(200).json(integrityResult);
});

export default router;
