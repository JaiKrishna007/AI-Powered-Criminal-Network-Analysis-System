import { AUDIT_v1 } from "../contracts/types.js";

export interface StoredAuditRecord {
  audit: AUDIT_v1;
  previous_hash?: string;
  event_hash: string;
}

export interface AuditRepository {
  save(record: StoredAuditRecord): Promise<void>;
  getLogs(): Promise<readonly AUDIT_v1[]>;
  queryLogs(filter: { resource_id?: string; correlation_id?: string; actor_id?: string }): Promise<readonly AUDIT_v1[]>;
  getLastHash(): Promise<string | undefined>;
  getStoredRecords(): Promise<readonly StoredAuditRecord[]>;
}
