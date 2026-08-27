import { Router, Response } from 'express';
import { AuthMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { db } from '../db';

const router = Router();

router.use(AuthMiddleware.authenticate);
router.use(AuthMiddleware.requireAdmin);

/**
 * Admin: Get System Users
 */
router.get('/users', async (_req: AuthenticatedRequest, res: Response) => {
  return res.status(200).json({ status: 'SUCCESS', message: 'Admin users list' });
});

/**
 * Admin: Get Audit Event References
 */
router.get('/audit-logs', async (_req: AuthenticatedRequest, res: Response) => {
  const events = await db.getAllAuditEvents();
  return res.status(200).json({ status: 'SUCCESS', audit_events: events });
});

export default router;
