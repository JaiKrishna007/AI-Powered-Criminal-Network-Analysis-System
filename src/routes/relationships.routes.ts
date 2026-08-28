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

    // Authorize case
    if (!req.user!.roles.includes('SYSTEM ADMIN')) {
      const hasAccess = await db.isUserMemberOfCase(req.user!.id, caseId);
      if (!hasAccess) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Not authorized for this case scope' });
      }
    }

    const context = {
      user_id: req.user!.id,
      role: req.user!.roles[0],
      case_id: caseId,
      access_level: 'MEMBER'
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

    if (!req.user!.roles.includes('SYSTEM ADMIN')) {
      const hasAccess = await db.isUserMemberOfCase(req.user!.id, caseId);
      if (!hasAccess) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Not authorized for this case scope' });
      }
    }

    const context = {
      user_id: req.user!.id,
      role: req.user!.roles[0],
      case_id: caseId,
      access_level: 'MEMBER'
    };

    // 1. Get relationship
    const relationship = await GraphClient.getRelationship(context, req.params.id);
    const evidenceIds: string[] = relationship.evidence_ids || [];

    // 2. Fetch evidence metadata
    const evidenceList = [];
    for (const evId of evidenceIds) {
      const ev = await db.getEvidence(evId);
      if (ev && ev.case_id === caseId) {
        evidenceList.push(ev);
      }
    }

    return res.status(200).json({ evidence: evidenceList });
  } catch (err) {
    next(err);
  }
});

export default router;
