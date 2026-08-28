import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { AuditEventRef } from '../models/types';
import { AuthenticatedRequest } from './auth';

export interface RequestWithCorrelation extends Request {
  correlationId?: string;
}

export class AuditMiddleware {
  /**
   * 40. Generates X-Correlation-ID for all requests (Issue 29)
   */
  public static correlationId(req: RequestWithCorrelation, res: Response, next: NextFunction) {
    const correlationId = req.headers['x-correlation-id'] as string || uuidv4();
    req.headers['x-correlation-id'] = correlationId;
    req.correlationId = correlationId;
    res.setHeader('X-Correlation-ID', correlationId);
    next();
  }

  /**
   * 39. Audits critical actions
   */
  public static auditEvent(action: string) {
    return async (req: Request, res: Response, next: NextFunction) => {
      // Execute the request first
      res.on('finish', async () => {
        const authReq = req as AuthenticatedRequest;
        const actorId = authReq.user?.id || 'ANONYMOUS';
        const caseId = req.params.case_id || req.body.case_id || null;
        
        const eventId = `AUD-${Date.now()}-${uuidv4().substring(0, 8)}`;
        const event: any = {
          event_id: eventId,
          actor_id: actorId,
          case_id: caseId,
          action: action
        };

        if (res.statusCode >= 400 && action !== 'LOGIN_FAILURE' && action !== 'ACCESS_DENIED') {
           // We might still want to log failures but we'll stick to the specific event types
        }

        try {
          await db.createAuditEvent(event);
        } catch (e) {
          console.error('Failed to write audit event', e);
        }
      });
      next();
    };
  }

  /**
   * Manual audit log utility for non-middleware usage
   */
  public static async logAction(actorId: string, action: string, caseId?: string) {
    const eventId = `AUD-${Date.now()}-${uuidv4().substring(0, 8)}`;
    const event: any = {
      event_id: eventId,
      actor_id: actorId,
      case_id: caseId || null,
      action: action
    };
    try {
      await db.createAuditEvent(event);
    } catch (e) {
      console.error('Failed to write audit event', e);
    }
  }
}
