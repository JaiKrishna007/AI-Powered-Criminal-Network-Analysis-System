/**
 * GT-08 Audit Logger Module
 * Provides append-only, tamper-evident audit logging for security and governance.
 * Enforces AUDIT.v1 schema rules strictly and implements cryptographic hash chaining.
 */

import { createHash } from "crypto";
import { AUDIT_v1, AuditResourceType, AuditOutcome } from "../contracts/types.js";
import { AuditRepository } from "./repository.js";
import { InMemoryAuditRepository } from "./in_memory_repository.js";

export class AuditLogger {
  private repository: AuditRepository;

  constructor(repository?: AuditRepository) {
    this.repository = repository || new InMemoryAuditRepository();
  }

  /**
   * Computes SHA-256 hash of string content.
   */
  private computeSha256(content: string): string {
    return createHash("sha256").update(content).digest("hex");
  }

  /**
   * Appends an AUDIT.v1 log entry with cryptographic hash chaining.
   * Returns immutable recorded entry.
   */
  public async log(
    actorId: string,
    action: string,
    resourceType: AuditResourceType,
    resourceId: string,
    outcome: AuditOutcome,
    correlationId: string,
    details: Record<string, any> = {}
  ): Promise<AUDIT_v1> {
    const baseEvent = {
      event_id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      actor_id: actorId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      timestamp: new Date().toISOString(),
      outcome,
      correlation_id: correlationId,
      details: { ...details },
    };

    const canonicalizedEvent = JSON.stringify(baseEvent);
    const lastHash = await this.repository.getLastHash();
    const hashInput = (lastHash || "GENESIS") + canonicalizedEvent;
    const eventHash = this.computeSha256(hashInput);

    const auditEvent: AUDIT_v1 = Object.freeze({
      ...baseEvent,
      previous_hash: lastHash,
      event_hash: eventHash,
      details: Object.freeze(baseEvent.details),
    });

    await this.repository.save(auditEvent);

    return auditEvent;
  }

  /**
   * Retrieves all append-only audit logs.
   */
  public async getLogs(): Promise<readonly AUDIT_v1[]> {
    return this.repository.getLogs();
  }

  /**
   * Filter audit logs by resource_id or correlation_id.
   */
  public async queryLogs(filter: { resource_id?: string; correlation_id?: string; actor_id?: string }): Promise<readonly AUDIT_v1[]> {
    return this.repository.queryLogs(filter);
  }
}
