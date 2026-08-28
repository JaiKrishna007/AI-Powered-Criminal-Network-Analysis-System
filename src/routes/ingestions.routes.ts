import { Router, Response } from 'express';
import { AuthMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { db } from '../db';

const router = Router();

router.use(AuthMiddleware.authenticate);

/**
 * 14. Get Ingestion Job Status
 * GET /api/ingestions/:id
 */
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const job = await db.getIngestionJob(req.params.id);
  
  if (!job) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Ingestion job not found' });
  }

  // Authorize based on case membership
  if (!req.user!.roles.includes('SYSTEM ADMIN')) {
    const hasAccess = await db.isUserMemberOfCase(req.user!.id, job.case_id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Not authorized for this case scope' });
    }
  }

  return res.status(200).json({ job });
});

export default router;
