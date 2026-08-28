/**
 * GT-08 Audit Logger Module
 * Provides append-only, tamper-evident audit logging for security and governance.
 * Enforces AUDIT.v1 schema rules strictly and implements cryptographic hash chaining.
 */

import { createHash } from "crypto";
import { AUDIT_v1, AuditResourceType, AuditOutcome } from "../contracts/types.js";
import { AuditRepository, StoredAuditRecord } from "./repository.js";
import { InMemoryAuditRepository } from "./in_memory_repository.js";

export class AuditLogger {
  private repository: AuditRepository;
  private writeMutex: Promise<void> = Promise.resolve();

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
    correlationId?: string,
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
      correlation_id: correlationId || "NO_CORRELATION",
      details: { ...details },
    };

    const auditEvent: AUDIT_v1 = Object.freeze({
      ...baseEvent,
      details: Object.freeze(baseEvent.details),
    });

    const appendTask = async () => {
      const canonicalizedEvent = JSON.stringify(baseEvent);
      const lastHash = await this.repository.getLastHash();
      const hashInput = (lastHash || "GENESIS") + canonicalizedEvent;
      const eventHash = this.computeSha256(hashInput);

      const storedRecord: StoredAuditRecord = Object.freeze({
        audit: auditEvent,
        previous_hash: lastHash,
        event_hash: eventHash,
      });

      await this.repository.save(storedRecord);
    };
    const currentMutex = this.writeMutex;
    let releaseMutex!: () => void;
    this.writeMutex = new Promise((resolve) => {
      releaseMutex = resolve;
    });

    try {
      await currentMutex;
      await appendTask();
    } finally {
      releaseMutex();
    }

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

  /**
   * Verifies the cryptographic integrity of the entire audit chain.
   */
  public async verifyChain(): Promise<boolean> {
    const records = await this.repository.getStoredRecords();
    let expectedLastHash: string | undefined = undefined;

    for (const record of records) {
      if (record.previous_hash !== expectedLastHash) {
        return false;
      }
      
      const canonicalizedEvent = JSON.stringify({
        event_id: record.audit.event_id,
        actor_id: record.audit.actor_id,
        action: record.audit.action,
        resource_type: record.audit.resource_type,
        resource_id: record.audit.resource_id,
        timestamp: record.audit.timestamp,
        outcome: record.audit.outcome,
        correlation_id: record.audit.correlation_id,
        details: record.audit.details,
      });

      const hashInput = (record.previous_hash || "GENESIS") + canonicalizedEvent;
      const expectedEventHash = this.computeSha256(hashInput);

      if (expectedEventHash !== record.event_hash) {
        return false;
      }

      expectedLastHash = expectedEventHash;
    }

    return true;
  }
}
