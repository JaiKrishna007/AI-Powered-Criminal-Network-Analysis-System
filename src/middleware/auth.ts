import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { AuditEventRef } from '../models/types';
import { ServiceErrors } from '../errors/service_errors';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    display_name: string;
    roles: string[];
  };
}

export interface AuthorizeCaseOptions {
  userId: string;
  caseId: string;
  requiredRole?: string;
  classification?: string; // e.g. SECRET, TOP SECRET
}

export class AuthMiddleware {
  /**
   * Resolves authentication context from the secure session.
   */
  public static async authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    let userId = (req.session as any)?.userId;

    if (!userId && process.env.NODE_ENV === 'test') {
      userId = req.headers['x-user-id'] as string;
    }

    if (!userId) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing or invalid session.' });
    }

    const user = await db.getUser(userId);
    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid user account.' });
    }

    const roles = await db.getUserRoles(userId);
    req.user = {
      id: user.id,
      display_name: user.display_name,
      roles
    };

    next();
  }

  /**
   * Verifies system administration privilege for admin endpoints (BE-T07).
   */
  public static async requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    if (!req.user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    if (!req.user.roles.includes('SYSTEM ADMIN')) {
      const eventId = `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const caseId = (req.params.case_id || req.body?.case_id || null) as string | null;

      await db.createAuditEvent({
        event_id: eventId,
        case_id: caseId,
        actor_id: req.user.id,
        action: `UNAUTHORIZED_ADMIN_ACCESS_ATTEMPT: ${req.method} ${req.originalUrl}`
      });

      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Access denied: Requires SYSTEM ADMIN role',
        audit_event_id: eventId
      });
    }

    next();
  }

  /**
   * Checks case scope before returning data (BE-T06).
   */
  public static async requireCaseAccess(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    if (!req.user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    const caseId = (req.params.case_id || req.query.case_id || req.body?.case_id) as string;

    if (!caseId) {
      return res.status(400).json({ error: 'MISSING_CASE_ID', message: 'Case ID is required' });
    }

    try {
      await AuthMiddleware.authorizeCaseAccess({
        userId: req.user.id,
        caseId: caseId
      });
      next();
    } catch (err: any) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: err.message || 'Access denied',
        data: null
      });
    }
  }

  /**
   * Centralized Authorization function for Case-level access.
   */
  public static async authorizeCaseAccess(options: AuthorizeCaseOptions): Promise<void> {
    const { userId, caseId, requiredRole, classification } = options;

    const roles = await db.getUserRoles(userId);
    if (roles.includes('SYSTEM ADMIN')) return;

    if (requiredRole && !roles.includes(requiredRole)) {
      throw ServiceErrors.CASE_ACCESS_DENIED();
    }

    const hasAccess = await db.isUserMemberOfCase(userId, caseId);
    if (!hasAccess) {
      throw ServiceErrors.CASE_ACCESS_DENIED();
    }

    const targetCase = await db.getCase(caseId);
    if (!targetCase) {
      throw new Error('CASE_NOT_FOUND');
    }

    const clearanceMap: Record<string, number> = {
      'UNCLASSIFIED': 0,
      'CONFIDENTIAL': 1,
      'RESTRICTED': 2,
      'SECRET': 3,
      'TOP_SECRET': 4
    };

    const user = await db.getUser(userId);
    const userClearance = user?.clearance_level ?? 0;
    const requiredClearance = clearanceMap[targetCase.classification] ?? 0;

    if (userClearance < requiredClearance) {
      throw ServiceErrors.CASE_ACCESS_DENIED();
    }
  }
}
