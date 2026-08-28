import { Router, Response } from 'express';
import { AuthMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { GraphClient } from '../services/graph_client';
import { db } from '../db';

const router = Router();

router.use(AuthMiddleware.authenticate);

/**
 * 22. Relationship endpoint missing
 * GET /api/relationships/:id
 */
router.get('/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const caseId = req.query.case_id as string;
    if (!caseId) {
      return res.status(400).json({ error: 'MISSING_CASE_ID', message: 'case_id query parameter is required for authorization' });
    }

    // Centralized case authorization (Issue 6)
    try {
      await AuthMiddleware.authorizeCaseAccess({
        userId: req.user!.id,
        caseId
      });
    } catch (authErr: any) {
      return res.status(403).json({ error: 'FORBIDDEN', message: authErr.message || 'Not authorized for this case scope' });
    }

    // Dynamic case access level resolution (Issue 5)
    const member = await db.getCaseMember(caseId, req.user!.id);
    const effectiveRole = req.user!.roles.includes('SYSTEM ADMIN')
      ? 'SYSTEM ADMIN'
      : req.user!.roles.includes('SUPERVISOR')
      ? 'SUPERVISOR'
      : 'INVESTIGATOR';

    const context = {
      user_id: req.user!.id,
      actor_id: req.user!.id,
      role: effectiveRole,
      case_id: caseId,
      allowed_case_ids: [caseId],
      access_level: member?.access_level || (req.user!.roles.includes('SYSTEM ADMIN') ? 'ADMIN' : 'INVESTIGATOR')
    };

    // Retrieve relationship metadata from D4
    const relationship = await GraphClient.getRelationship(context, req.params.id);
    
    // Return relationship with evidence references
    return res.status(200).json({ relationship, evidence_ids: relationship.evidence_ids || [] });
  } catch (err) {
    next(err);
  }
});

/**
 * 27. Evidence Explorer
 * GET /api/relationships/:id/evidence
 */
router.get('/:id/evidence', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const caseId = req.query.case_id as string;
    if (!caseId) {
      return res.status(400).json({ error: 'MISSING_CASE_ID', message: 'case_id query parameter is required for authorization' });
    }

    // Centralized case authorization (Issue 6)
    try {
      await AuthMiddleware.authorizeCaseAccess({
        userId: req.user!.id,
        caseId
      });
    } catch (authErr: any) {
      return res.status(403).json({ error: 'FORBIDDEN', message: authErr.message || 'Not authorized for this case scope' });
    }

    // Dynamic case access level resolution (Issue 5)
    const member = await db.getCaseMember(caseId, req.user!.id);
    const effectiveRole = req.user!.roles.includes('SYSTEM ADMIN')
      ? 'SYSTEM ADMIN'
      : req.user!.roles.includes('SUPERVISOR')
      ? 'SUPERVISOR'
      : 'INVESTIGATOR';

    const context = {
      user_id: req.user!.id,
      actor_id: req.user!.id,
      role: effectiveRole,
      case_id: caseId,
      allowed_case_ids: [caseId],
      access_level: member?.access_level || (req.user!.roles.includes('SYSTEM ADMIN') ? 'ADMIN' : 'INVESTIGATOR')
    };

    // 1. Get relationship
    const relationship = await GraphClient.getRelationship(context, req.params.id);
    const evidenceIds: string[] = relationship.evidence_ids || [];

    // 2. Fetch and filter evidence by user clearance / classification (Issue 7)
    const evidenceList = [];
    for (const evId of evidenceIds) {
      const ev = await db.getEvidence(evId);
      if (ev && ev.case_id === caseId) {
        try {
          await AuthMiddleware.authorizeCaseAccess({
            userId: req.user!.id,
            caseId,
            classification: ev.classification
          });
          evidenceList.push(ev);
        } catch {
          // Excluded due to insufficient clearance
        }
      }
    }

    return res.status(200).json({ evidence: evidenceList });
  } catch (err) {
    next(err);
  }
});

export default router;
