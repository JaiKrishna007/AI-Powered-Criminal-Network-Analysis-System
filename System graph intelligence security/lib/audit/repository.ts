import { AUDIT_v1 } from "../contracts/types.js";

export interface AuditRepository {
  save(event: AUDIT_v1): Promise<void>;
  getLogs(): Promise<readonly AUDIT_v1[]>;
  queryLogs(filter: { resource_id?: string; correlation_id?: string; actor_id?: string }): Promise<readonly AUDIT_v1[]>;
  getLastHash(): Promise<string | undefined>;
}
