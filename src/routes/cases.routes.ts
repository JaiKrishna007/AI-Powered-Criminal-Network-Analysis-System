import { Router, Response } from 'express';
import { AuthMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { db } from '../db';
import { Case, CaseMember } from '../models/types';

const router = Router();

router.use(AuthMiddleware.authenticate);

/**
 * Create Case
 */
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  const { id, title, status, classification } = req.body;
  if (!id || !title) {
    return res.status(400).json({ error: 'MISSING_FIELDS', message: 'id and title are required' });
  }

  const caseObj: Case = {
    id,
    title,
    status: status || 'ACTIVE',
    owner_id: req.user!.id,
    classification: classification || 'UNCLASSIFIED'
  };

  await db.createCase(caseObj);
  return res.status(201).json({ status: 'SUCCESS', case: caseObj });
});

/**
 * Add Case Member
 */
router.post('/:case_id/members', async (req: AuthenticatedRequest, res: Response) => {
  const caseId = req.params.case_id;
  const { user_id, access_level } = req.body;

  const targetCase = await db.getCase(caseId);
  if (!targetCase) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Case not found' });
  }

  // Only case owner or admin can add members
  if (targetCase.owner_id !== req.user!.id && !req.user!.roles.includes('SYSTEM ADMIN')) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Only case owner or system admin can manage case membership' });
  }

  const member: CaseMember = {
    case_id: caseId,
    user_id,
    access_level: access_level || 'READ'
  };

  await db.addCaseMember(member);
  return res.status(200).json({ status: 'SUCCESS', member });
});

/**
 * Get Case details
 */
router.get('/:case_id', AuthMiddleware.requireCaseAccess, async (req: AuthenticatedRequest, res: Response) => {
  const caseObj = await db.getCase(req.params.case_id);
  if (!caseObj) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Case not found' });
  }
  return res.status(200).json({ case: caseObj });
});

export default router;
