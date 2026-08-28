import path from 'path';

export const EVIDENCE_DIR = process.env.EVIDENCE_STORAGE_PATH 
  ? path.resolve(process.cwd(), process.env.EVIDENCE_STORAGE_PATH)
  : path.resolve(process.cwd(), 'data/evidence');

// Future-proofing for report storage directory
export const REPORTS_DIR = process.env.REPORTS_STORAGE_PATH
  ? path.resolve(process.cwd(), process.env.REPORTS_STORAGE_PATH)
  : path.resolve(process.cwd(), 'data/reports');
