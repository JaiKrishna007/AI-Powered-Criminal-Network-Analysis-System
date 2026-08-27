import { InternalVectorRecord, VectorRecordMetadata, AuthScopeAdapter } from '../../contracts/adapters.js';

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// Security Clearance levels hierarchy
const CLEARANCE_LEVELS: Record<string, number> = {
  UNCLASSIFIED: 1,
  CONFIDENTIAL: 2,
  RESTRICTED: 3,
  SECRET: 4,
};

export class VectorStore {
  private records: Map<string, InternalVectorRecord> = new Map();

  /**
   * Insert or update a vector record in the store.
   */
  public addRecord(record: InternalVectorRecord): void {
    this.records.set(record.vector_id, record);
  }

  public getRecord(vectorId: string): InternalVectorRecord | undefined {
    return this.records.get(vectorId);
  }

  public getAllRecords(): InternalVectorRecord[] {
    return Array.from(this.records.values());
  }

  public clear(): void {
    this.records.clear();
  }

  /**
   * Checks if user scope permits access to a specific classification.
   */
  private isClassificationAuthorized(recordClassification: string, userClearance: string): boolean {
    const recordLevel = CLEARANCE_LEVELS[recordClassification.toUpperCase()] || 1;
    const userLevel = CLEARANCE_LEVELS[userClearance.toUpperCase()] || 1;
    return userLevel >= recordLevel;
  }

  /**
   * Search vector index with built-in authorization scope, case filter, and classification filter.
   */
  public searchCandidates(
    queryEmbedding: number[],
    scope: AuthScopeAdapter,
    caseIdFilter?: string,
    classificationFilter?: string,
    topK: number = 10
  ): Array<{ record: InternalVectorRecord; score: number }> {
    const candidates: Array<{ record: InternalVectorRecord; score: number }> = [];

    for (const record of this.records.values()) {
      // 1. Case Isolation Scope Enforcement
      if (!scope.authorized_case_ids.includes(record.case_id)) {
        continue;
      }
      if (caseIdFilter && record.case_id !== caseIdFilter) {
        continue;
      }

      // 2. Security Clearance Authorization
      if (!this.isClassificationAuthorized(record.classification, scope.security_clearance)) {
        continue;
      }

      // 3. Classification Filter
      if (classificationFilter && record.classification.toUpperCase() !== classificationFilter.toUpperCase()) {
        continue;
      }

      const score = cosineSimilarity(queryEmbedding, record.embedding);
      candidates.push({ record, score });
    }

    // Sort descending by similarity score
    candidates.sort((a, b) => b.score - a.score);
    return candidates.slice(0, topK);
  }

  /**
   * Export strictly contract-compliant vector metadata for external verification (AI-01 requirement).
   */
  public exportMetadata(vectorId: string): VectorRecordMetadata | undefined {
    const record = this.records.get(vectorId);
    if (!record) return undefined;
    
    // Explicitly select contract-required metadata fields, excluding internal embedding/content
    return {
      vector_id: record.vector_id,
      case_id: record.case_id,
      source_ref: record.source_ref,
      chunk_ref: record.chunk_ref,
      model_version: record.model_version,
      text_hash: record.text_hash,
      classification: record.classification,
      entity_ids: record.entity_ids,
    };
  }
}
