import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { AuditEventRef } from '../models/types';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    display_name: string;
    roles: string[];
  };
}

export class AuthMiddleware {
  /**
   * Resolves authentication context from request headers (x-user-id).
   */
  public static async authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing user authentication context' });
    }

    const user = await db.getUser(userId);
    if (!user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid user account' });
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
   * If an investigator attempts to access an admin endpoint:
   * Request is denied AND an audit reference is generated in audit_event_ref.
   */
  public static async requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    if (!req.user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    if (!req.user.roles.includes('SYSTEM ADMIN')) {
      const eventId = `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const caseId = (req.params.case_id || req.body?.case_id || null) as string | null;

      const auditEvent: AuditEventRef = {
        event_id: eventId,
        case_id: caseId,
        actor_id: req.user.id,
        action: `UNAUTHORIZED_ADMIN_ACCESS_ATTEMPT: ${req.method} ${req.originalUrl}`
      };

      await db.logAuditEvent(auditEvent);

      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Access denied: Requires SYSTEM ADMIN role',
        audit_event_id: eventId
      });
    }

    next();
  }

  /**
   * Checks case scope before returning evidence, candidate, or protected case data (BE-T06).
   */
  public static async requireCaseAccess(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    if (!req.user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    const caseId = (req.params.case_id || req.query.case_id || req.body?.case_id) as string;

    if (!caseId) {
      return res.status(400).json({ error: 'MISSING_CASE_ID', message: 'Case ID is required' });
    }

    // System Admins have global access
    if (req.user.roles.includes('SYSTEM ADMIN')) {
      return next();
    }

    const hasAccess = await db.isUserMemberOfCase(req.user.id, caseId);
    if (!hasAccess) {
      // Default denial: No data returned
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Access denied: User is not authorized for this case scope',
        data: null
      });
    }

    next();
  }
}
