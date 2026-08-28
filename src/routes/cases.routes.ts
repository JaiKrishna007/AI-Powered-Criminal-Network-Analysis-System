import { Router, Response } from 'express';
import { AuthMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { AuditMiddleware } from '../middleware/audit';
import { db } from '../db';
import { Case, CaseMember } from '../models/types';
import { IngestionService } from '../services/ingestion.service';
import { EntityReviewService } from '../services/entity_review.service';
import { AIClient } from '../services/ai_client';
import { GraphClient } from '../services/graph_client';

const router = Router();

router.use(AuthMiddleware.authenticate);

/**
 * 13. Case list/search endpoint
 */
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const status = req.query.status as string;
  const search = req.query.search as string;
  const isSystemAdmin = req.user!.roles.includes('SYSTEM ADMIN');
  const filtered = await db.getCasesForUser(req.user!.id, isSystemAdmin, { status, search });

  return res.status(200).json({ cases: filtered });
});

/**
 * Create Case
 */
router.post('/', AuditMiddleware.auditEvent('CASE_CREATE'), async (req: AuthenticatedRequest, res: Response) => {
  const { id, title, status, classification, description } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'MISSING_FIELDS', message: 'title is required' });
  }

  const caseId = id || `CASE-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  (req as any).case_id = caseId;

  const caseObj: Case = {
    id: caseId,
    title,
    description,
    status: status || 'ACTIVE',
    owner_id: req.user!.id,
    classification: classification || 'UNCLASSIFIED'
  };

  await db.createCase(caseObj);
  return res.status(201).json({ status: 'SUCCESS', case: caseObj });
});

/**
 * Get Case details
 */
router.get('/:case_id', AuthMiddleware.requireCaseAccess, AuditMiddleware.auditEvent('CASE_ACCESS'), async (req: AuthenticatedRequest, res: Response) => {
  const caseObj = await db.getCase(req.params.case_id);
  if (!caseObj) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Case not found' });
  }
  return res.status(200).json({ case: caseObj });
});

/**
 * Add Case Member
 */
router.post('/:case_id/members', AuthMiddleware.requireCaseAccess, AuditMiddleware.auditEvent('CASE_UPDATE'), async (req: AuthenticatedRequest, res: Response) => {
  const caseId = req.params.case_id;
  const { user_id, access_level } = req.body;

  const targetCase = await db.getCase(caseId);
  if (!targetCase) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Case not found' });
  }

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
 * 14. Ingestion Endpoint (POST /api/cases/:id/ingestions)
 */
router.post('/:case_id/ingestions', AuthMiddleware.requireCaseAccess, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const case_id = req.params.case_id;
    const { source_type, source_ref, storage_uri, content, classification } = req.body;

    if (classification) {
      await AuthMiddleware.authorizeCaseAccess({
        userId: req.user!.id,
        caseId: case_id,
        classification
      });
    }

    await AuditMiddleware.logAction(req.user!.id, 'INGEST_EVIDENCE', case_id);

    if (!source_type || !content) {
      return res.status(400).json({ error: 'MISSING_REQUIRED_FIELDS', message: 'source_type and content are required' });
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
    if (err.code === 'CASE_ACCESS_DENIED' || err.message?.includes('Clearance') || err.message?.includes('Access denied')) {
      return res.status(403).json({ error: 'FORBIDDEN', message: err.message });
    }
    if (err.code) {
      return res.status(400).json({ error: err.code, message: err.message });
    }
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message || 'Ingestion failure' });
  }
});

/**
 * Get Evidence List for a Case Scope
 */
router.get('/:case_id/evidence', AuthMiddleware.requireCaseAccess, async (req: AuthenticatedRequest, res: Response) => {
  const list = await db.getAuthorizedEvidenceByCase(
    { user_id: req.user!.id, clearance_level: req.user!.clearance_level, roles: req.user!.roles },
    req.params.case_id
  );
  return res.status(200).json({ case_id: req.params.case_id, evidence: list });
});

/**
 * 15. Entity API
 */
router.get('/:case_id/entities', AuthMiddleware.requireCaseAccess, async (req: AuthenticatedRequest, res: Response) => {
  const candidates = await db.getCandidatesByCase(req.params.case_id);
  return res.status(200).json({ case_id: req.params.case_id, candidates });
});

router.post('/:case_id/entities/resolve', AuthMiddleware.requireCaseAccess, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { candidate_id, decision } = req.body;
    if (!candidate_id || !decision) {
      return res.status(400).json({ error: 'MISSING_FIELDS', message: 'candidate_id and decision are required' });
    }

    const hasReviewRole = req.user!.roles.includes('INVESTIGATOR') || req.user!.roles.includes('SUPERVISOR');
    if (!hasReviewRole) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Access denied: Requires INVESTIGATOR or SUPERVISOR' });
    }

    const review = await EntityReviewService.recordReviewDecision(candidate_id, decision, req.user!.id);
    await AuditMiddleware.logAction(req.user!.id, 'ENTITY_REVIEW', req.params.case_id);
    
    return res.status(200).json({ status: 'SUCCESS', review });
  } catch (err: any) {
    return res.status(400).json({ error: 'INVALID_REVIEW_DECISION', message: err.message });
  }
});

// Helper for AI/Graph auth context reading actual case access level from DB
const buildAuthContext = async (req: AuthenticatedRequest & { correlationId?: string }, caseId: string) => {
  const { getEffectiveRole } = await import('../utils/security.js');
  const member = await db.getCaseMember(caseId, req.user!.id);
  const accessLevel = member?.access_level || (req.user!.roles.includes('SYSTEM ADMIN') ? 'ADMIN' : 'INVESTIGATOR');
  const role = getEffectiveRole(req.user!.roles);
  return {
    user_id: req.user!.id,
    role,
    case_id: caseId,
    access_level: accessLevel,
    correlation_id: req.correlationId
  };
};

/**
 * 16. Search Endpoint
 */
router.post('/:case_id/search', AuthMiddleware.requireCaseAccess, AuditMiddleware.auditEvent('SEARCH'), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { query, filters } = req.body;
    const authCtx = await buildAuthContext(req, req.params.case_id);
    const result = await AIClient.searchCase(authCtx, query, filters);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * 17. Copilot Endpoint
 */
router.post('/:case_id/copilot', AuthMiddleware.requireCaseAccess, AuditMiddleware.auditEvent('COPILOT'), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { query } = req.body;
    const authCtx = await buildAuthContext(req, req.params.case_id);
    const result = await AIClient.copilot(authCtx, query);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * 18. Leads Endpoint
 */
router.post('/:case_id/leads', AuthMiddleware.requireCaseAccess, AuditMiddleware.auditEvent('LEAD_GENERATION'), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { request } = req.body;
    const authCtx = await buildAuthContext(req, req.params.case_id);
    const result = await AIClient.generateLeads(authCtx, request);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * 19. Graph Endpoint
 */
router.get('/:case_id/graph', AuthMiddleware.requireCaseAccess, AuditMiddleware.auditEvent('GRAPH_ACCESS'), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { entityId, hops } = req.query;
    const authCtx = await buildAuthContext(req, req.params.case_id);
    const result = await GraphClient.getFocusedGraph(authCtx, entityId as string, Number(hops) || 2);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * 20. Bridge Endpoint
 */
router.post('/:case_id/analytics/bridge', AuthMiddleware.requireCaseAccess, AuditMiddleware.auditEvent('GRAPH_ACCESS'), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const authCtx = await buildAuthContext(req, req.params.case_id);
    const result = await GraphClient.getBridgeAnalysis(authCtx);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * 21. Temporal Endpoint
 */
router.post('/:case_id/analytics/temporal', AuthMiddleware.requireCaseAccess, AuditMiddleware.auditEvent('GRAPH_ACCESS'), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { timeRange } = req.body;
    const authCtx = await buildAuthContext(req, req.params.case_id);
    const result = await GraphClient.getTemporalAnalysis(authCtx, timeRange);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * 23. Reports Endpoint
 */
router.post('/:case_id/reports', AuthMiddleware.requireCaseAccess, AuditMiddleware.auditEvent('REPORT_GENERATION'), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { parameters } = req.body;
    const { ReportService } = await import('../services/report.service.js');
    const authContext = await buildAuthContext(req, req.params.case_id);
    const report = await ReportService.generateCaseReport(authContext, parameters || {});
    return res.status(202).json({ 
      report_id: report.id,
      status: report.status
    });
  } catch (err) {
    next(err);
  }
});

export default router;
