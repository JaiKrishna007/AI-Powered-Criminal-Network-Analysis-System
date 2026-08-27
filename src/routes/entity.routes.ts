import { Router, Response } from 'express';
import { AuthMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { EntityReviewService } from '../services/entity_review.service';
import { db } from '../db';

const router = Router();

router.use(AuthMiddleware.authenticate);

/**
 * Get Candidates for a Case Scope
 */
router.get('/candidates/case/:case_id', AuthMiddleware.requireCaseAccess, async (req: AuthenticatedRequest, res: Response) => {
  const caseId = req.params.case_id;
  const candidates = await db.getCandidatesByCase(caseId);
  return res.status(200).json({ case_id: caseId, candidates });
});

/**
 * Record Human Entity Review Decision
 * Review States: ACCEPTED | REJECTED | DEFERRED
 * Server-side authorization & Case-Scope Check mandatory before accepting review.
 */
router.post('/reviews', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { candidate_id, decision } = req.body;
    if (!candidate_id || !decision) {
      return res.status(400).json({ error: 'MISSING_FIELDS', message: 'candidate_id and decision are required' });
    }

    if (!req.user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    // 1. Resolve candidate
    const candidate = await db.getCandidate(candidate_id);
    if (!candidate) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Candidate record not found' });
    }

    // 2. Determine associated case and verify requester case scope permission
    const caseId = candidate.case_id;
    const hasCaseAccess = await db.isUserMemberOfCase(req.user.id, caseId);
    if (!hasCaseAccess) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Access denied: User is not authorized for candidate case scope',
        data: null
      });
    }

    // 3. Verify specific role authorization for review action
    // INVESTIGATOR: Review candidates
    // SUPERVISOR: Approve entity decisions / review cases
    const hasReviewRole = req.user.roles.includes('INVESTIGATOR') || req.user.roles.includes('SUPERVISOR');
    if (!hasReviewRole) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Access denied: Specific role permission required for entity review (INVESTIGATOR or SUPERVISOR)'
      });
    }

    // 4. Record decision & persist in PostgreSQL entity_review table
    const review = await EntityReviewService.recordReviewDecision(candidate_id, decision, req.user.id);
    return res.status(200).json({ status: 'SUCCESS', review });
  } catch (err: any) {
    return res.status(400).json({ error: 'INVALID_REVIEW_DECISION', message: err.message });
  }
});

export default router;
