import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { db } from '../db';
import { EVIDENCE_DIR } from '../config/paths';

if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

export class EvidenceService {
  /**
   * 24. Original evidence artifact is not actually stored
   * Saves the raw buffer to the file system and returns the storage URI and SHA-256
   */
  static async storeOriginalEvidence(evidenceId: string, content: Buffer | string, extension: string): Promise<{ storage_uri: string, sha256: string }> {
    const buffer = typeof content === 'string' ? Buffer.from(content) : content;
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    
    const fileName = `${evidenceId}.${extension.toLowerCase()}`;
    const filePath = path.join(EVIDENCE_DIR, fileName);
    
    // Never overwrite original artifact (though evidenceId is randomly generated, we ensure it's safe)
    if (fs.existsSync(filePath)) {
      throw new Error(`Artifact ${evidenceId} already exists`);
    }

    await fs.promises.writeFile(filePath, buffer);

    return {
      storage_uri: `local://${fileName}`,
      sha256
    };
  }

  /**
   * 25 & 26. SHA-256 verification and Integrity status
   * Loads the original artifact, calculates current SHA, and compares with stored SHA.
   */
  static async verifyEvidenceIntegrity(evidenceId: string): Promise<any> {
    const evidence = await db.getEvidence(evidenceId);
    if (!evidence) {
      return {
        evidence_id: evidenceId,
        integrity: { status: 'MISSING', message: 'Evidence record not found in DB' }
      };
    }

    if (!evidence.storage_uri.startsWith('local://')) {
      return {
        evidence_id: evidenceId,
        integrity: { status: 'NOT_VERIFIED', message: 'Only local:// storage is supported for integrity checks' }
      };
    }

    const fileName = evidence.storage_uri.replace('local://', '');
    const filePath = path.join(EVIDENCE_DIR, fileName);

    if (!fs.existsSync(filePath)) {
      return {
        evidence_id: evidenceId,
        integrity: {
          status: 'MISSING',
          stored_sha256: evidence.sha256,
          verified_at: new Date().toISOString()
        }
      };
    }

    const buffer = await fs.promises.readFile(filePath);
    const verified_sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

    const status = verified_sha256 === evidence.sha256 ? 'VALID' : 'TAMPERED';

    return {
      evidence_id: evidenceId,
      integrity: {
        status,
        stored_sha256: evidence.sha256,
        verified_sha256,
        verified_at: new Date().toISOString()
      }
    };
  }
}
