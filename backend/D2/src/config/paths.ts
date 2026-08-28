import path from 'path';

export const EVIDENCE_DIR = process.env.EVIDENCE_STORAGE_PATH 
  ? path.resolve(process.cwd(), process.env.EVIDENCE_STORAGE_PATH)
  : path.resolve(process.cwd(), 'data/evidence');

// Future-proofing for report storage directory
export const REPORTS_DIR = process.env.REPORTS_STORAGE_PATH
  ? path.resolve(process.cwd(), process.env.REPORTS_STORAGE_PATH)
  : path.resolve(process.cwd(), 'data/reports');

// Unified upload and ingestion size limits (Issue 33)
export const MAX_EVIDENCE_SIZE_MB = parseInt(process.env.MAX_EVIDENCE_SIZE_MB || '50', 10);
export const MAX_EVIDENCE_SIZE_BYTES = MAX_EVIDENCE_SIZE_MB * 1024 * 1024;
