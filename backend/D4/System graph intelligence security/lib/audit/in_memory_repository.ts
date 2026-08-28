import { AUDIT_v1 } from "../contracts/types.js";
import { AuditRepository, StoredAuditRecord } from "./repository.js";

export class InMemoryAuditRepository implements AuditRepository {
  private records: StoredAuditRecord[] = [];
  private lastHash: string | undefined = undefined;

  public async save(record: StoredAuditRecord): Promise<void> {
    this.records.push(record);
    this.lastHash = record.event_hash;
  }

  public async getLogs(): Promise<readonly AUDIT_v1[]> {
    return Object.freeze(this.records.map(r => r.audit));
  }

  public async queryLogs(filter: { resource_id?: string; correlation_id?: string; actor_id?: string }): Promise<readonly AUDIT_v1[]> {
    return Object.freeze(
      this.records
        .map(r => r.audit)
        .filter((e) => {
          if (filter.resource_id && e.resource_id !== filter.resource_id) return false;
          if (filter.correlation_id && e.correlation_id !== filter.correlation_id) return false;
          if (filter.actor_id && e.actor_id !== filter.actor_id) return false;
          return true;
        })
    );
  }

  public async getLastHash(): Promise<string | undefined> {
    return this.lastHash;
  }

  public async getStoredRecords(): Promise<readonly StoredAuditRecord[]> {
    return Object.freeze([...this.records]);
  }
}
