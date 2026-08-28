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
   * Safely resolves a path and ensures it does not escape the base directory (Issue 33).
   */
  static safeStoragePath(baseDir: string, storageKey: string): string {
    const resolvedPath = path.resolve(baseDir, storageKey);
    if (!resolvedPath.startsWith(path.resolve(baseDir) + path.sep) && resolvedPath !== path.resolve(baseDir)) {
      throw new Error('Path traversal detected');
    }
    return resolvedPath;
  }
  /**
   * Saves the raw buffer to the file system and returns the storage metadata (provider, key, URI, SHA-256).
   * Uses clean case-scoped key naming (e.g. CASE-1042/EVD-001.pdf or EVD-001.pdf).
   */
  static async storeOriginalEvidence(
    evidenceId: string,
    content: Buffer | string,
    extension: string,
    caseId?: string
  ): Promise<{ storage_provider: 'local'; storage_key: string; storage_uri: string; sha256: string }> {
    const buffer = typeof content === 'string' ? Buffer.from(content) : content;
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    
    const ext = extension.toLowerCase();
    const storageKey = caseId ? `${caseId}/${evidenceId}.${ext}` : `${evidenceId}.${ext}`;
    const filePath = path.join(EVIDENCE_DIR, storageKey);
    
    // Ensure parent directory exists for case-scoped storage
    const parentDir = path.dirname(filePath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    // Never overwrite original artifact
    if (fs.existsSync(filePath)) {
      throw new Error(`Artifact ${evidenceId} already exists`);
    }

    await fs.promises.writeFile(filePath, buffer);

    return {
      storage_provider: 'local',
      storage_key: storageKey,
      storage_uri: `local://${storageKey}`,
      sha256
    };
  }

  /**
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

    const storageUri = evidence.storage_uri || '';
    if (!storageUri.startsWith('local://')) {
      return {
        evidence_id: evidenceId,
        integrity: { status: 'NOT_VERIFIED', message: 'Only local:// storage provider is supported for integrity checks' }
      };
    }

    const storageKey = storageUri.replace('local://', '');
    let filePath: string;
    try {
      filePath = this.safeStoragePath(EVIDENCE_DIR, storageKey);
    } catch (err: any) {
      return {
        evidence_id: evidenceId,
        integrity: { status: 'ERROR', message: err.message }
      };
    }

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
