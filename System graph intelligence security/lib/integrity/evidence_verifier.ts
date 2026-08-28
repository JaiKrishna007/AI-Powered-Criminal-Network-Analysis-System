/**
 * GT-07 Integrity — Evidence Verification Module
 * Calculates and verifies SHA-256 hashes of evidence artifacts.
 * Records verification outcomes in AUDIT.v1 logs.
 * Does NOT claim automatic court admissibility.
 */

import { createHash } from "node:crypto";
import { EVIDENCE_v1, AuthContext } from "../contracts/types.js";
import { AuditLogger } from "../audit/audit_logger.js";

export class EvidenceVerifier {
  constructor(private auditLogger: AuditLogger = new AuditLogger()) {}

  /**
   * Computes SHA-256 hash for raw content (string or Uint8Array).
   */
  public computeSha256(content: string | Uint8Array): string {
    return createHash("sha256").update(content).digest("hex");
  }

  /**
   * Verifies stored evidence hash against computed content hash.
   */
  public async verifyEvidence(
    evidence: EVIDENCE_v1,
    content: string | Uint8Array,
    auth?: AuthContext
  ): Promise<{ status: "VERIFIED" | "MISMATCH"; computedHash: string; storedHash: string }> {
    const computedHash = this.computeSha256(content);
    const storedHash = evidence.sha256_hash || evidence.stored_hash || "";

    const isMatch = computedHash.toLowerCase() === storedHash.toLowerCase();
    const status = isMatch ? "VERIFIED" : "MISMATCH";

    if (auth) {
      await this.auditLogger.log(
        auth.actor_id,
        "VERIFY_EVIDENCE",
        "EVIDENCE",
        evidence.id,
        isMatch ? "SUCCESS" : "ERROR",
        auth.correlation_id,
        {
          file_name: evidence.file_name,
          computed_hash: computedHash,
          stored_hash: storedHash,
          status,
        }
      );
    }

    return {
      status,
      computedHash,
      storedHash,
    };
  }
}
