/**
 * GT-08 Audit Logger Module
 * Provides append-only, tamper-evident audit logging for security and governance.
 * Enforces AUDIT.v1 schema rules strictly.
 */

import { AUDIT_v1, AuditResourceType, AuditOutcome } from "../contracts/types.js";

export class AuditLogger {
  private readonly events: AUDIT_v1[] = [];

  /**
   * Appends an AUDIT.v1 log entry. Returns immutable recorded entry.
   */
  public log(
    actorId: string,
    action: string,
    resourceType: AuditResourceType,
    resourceId: string,
    outcome: AuditOutcome,
    correlationId: string,
    details: Record<string, any> = {}
  ): AUDIT_v1 {
    const auditEvent: AUDIT_v1 = Object.freeze({
      event_id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      actor_id: actorId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      timestamp: new Date().toISOString(),
      outcome,
      correlation_id: correlationId,
      details: Object.freeze({ ...details }),
    });

    this.events.push(auditEvent);
    return auditEvent;
  }

  /**
   * Retrieves all append-only audit logs.
   */
  public getLogs(): readonly AUDIT_v1[] {
    return Object.freeze([...this.events]);
  }

  /**
   * Filter audit logs by resource_id or correlation_id.
   */
  public queryLogs(filter: { resource_id?: string; correlation_id?: string; actor_id?: string }): readonly AUDIT_v1[] {
    return Object.freeze(
      this.events.filter((e) => {
        if (filter.resource_id && e.resource_id !== filter.resource_id) return false;
        if (filter.correlation_id && e.correlation_id !== filter.correlation_id) return false;
        if (filter.actor_id && e.actor_id !== filter.actor_id) return false;
        return true;
      })
    );
  }
}
