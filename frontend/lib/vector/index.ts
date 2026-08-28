import { InternalVectorRecord, VectorRecordMetadata, AuthScopeAdapter } from '../../contracts/adapters.js';
import { CONFIG } from '../config.js';

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

// Security Clearance hierarchy
export const CLEARANCE_LEVELS: Record<string, number> = {
  UNCLASSIFIED: 1,
  CONFIDENTIAL: 2,
  RESTRICTED: 3,
  SECRET: 4,
};

export function isClassificationAuthorized(recordClassification: string, userClearance: string): boolean {
  const recordLevel = CLEARANCE_LEVELS[recordClassification.toUpperCase()] || 1;
  const userLevel = CLEARANCE_LEVELS[userClearance.toUpperCase()] || 1;
  return userLevel >= recordLevel;
}

/**
 * Base Vector Store class (In-Memory implementation by default for unit test isolation).
 */
export class VectorStore {
  protected records: Map<string, InternalVectorRecord> = new Map();

  /**
   * Insert or update a vector record in the store.
   */
  public addRecord(record: InternalVectorRecord): void | Promise<void> {
    this.records.set(record.vector_id, record);
  }

  public getRecord(vectorId: string): InternalVectorRecord | undefined {
    return this.records.get(vectorId);
  }

  public getAllRecords(): InternalVectorRecord[] {
    return Array.from(this.records.values());
  }

  public clear(): void | Promise<void> {
    this.records.clear();
  }

  /**
   * Search vector index with built-in authorization scope, case filter, and classification filter.
   */
  public async searchCandidates(
    queryEmbedding: number[],
    scope: AuthScopeAdapter,
    caseIdFilter?: string,
    classificationFilter?: string,
    topK: number = 10
  ): Promise<Array<{ record: InternalVectorRecord; score: number }>> {
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
      if (!isClassificationAuthorized(record.classification, scope.security_clearance)) {
        continue;
      }

      // 3. Classification Filter
      if (classificationFilter && record.classification.toUpperCase() !== classificationFilter.toUpperCase()) {
        continue;
      }

      const score = cosineSimilarity(queryEmbedding, record.embedding);
      candidates.push({ record, score });
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates.slice(0, topK);
  }

  /**
   * Export contract metadata for external verification.
   */
  public exportMetadata(vectorId: string): VectorRecordMetadata | undefined {
    const record = this.records.get(vectorId);
    if (!record) return undefined;
    
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

/**
 * In-Memory Vector Store subclass explicitly designated for unit testing.
 */
export class InMemoryVectorStore extends VectorStore {}

/**
 * Production Qdrant Vector Store Adapter.
 * Uses Qdrant HTTP REST API to manage vector points and payload filtering.
 * In production, throws explicit service errors when Qdrant endpoint is unreachable.
 * NO SILENT FALLBACKS IN PRODUCTION.
 */
export class QdrantVectorStore extends VectorStore {
  private qdrantUrl: string;
  private collectionName: string;
  private vectorDimension: number;

  constructor(
    qdrantUrl: string = CONFIG.QDRANT_URL,
    collectionName: string = CONFIG.QDRANT_COLLECTION,
    vectorDimension: number = 384
  ) {
    super();
    this.qdrantUrl = qdrantUrl.replace(/\/+$/, '');
    this.collectionName = collectionName;
    this.vectorDimension = vectorDimension;
  }

  public getCollectionName(): string {
    return this.collectionName;
  }

  public getVectorDimension(): number {
    return this.vectorDimension;
  }

  /**
   * Validates or creates Qdrant collection with matching embedding dimension.
   */
  public async createOrValidateCollection(): Promise<void> {
    const endpoint = `${this.qdrantUrl}/collections/${this.collectionName}`;
    try {
      const getRes = await fetch(endpoint);
      if (getRes.ok) return;

      const createRes = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vectors: {
            size: this.vectorDimension,
            distance: 'Cosine',
          },
        }),
      });

      if (!createRes.ok) {
        throw new Error(`Failed to create Qdrant collection ${this.collectionName}: HTTP ${createRes.status}`);
      }
    } catch (err: any) {
      throw new Error(`[QdrantVectorStore] Mandatory collection setup failed: ${err.message}`);
    }
  }

  public override async addRecord(record: InternalVectorRecord): Promise<void> {
    // Dimension match validation (Contract Section 9)
    if (record.embedding.length !== this.vectorDimension) {
      throw new Error(
        `[QdrantVectorStore] Vector dimension mismatch: record dimension (${record.embedding.length}) does not match Qdrant collection dimension (${this.vectorDimension}).`
      );
    }

    this.records.set(record.vector_id, record);
    const endpoint = `${this.qdrantUrl}/collections/${this.collectionName}/points`;

    try {
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          points: [
            {
              id: record.vector_id,
              vector: record.embedding,
              payload: {
                vector_id: record.vector_id,
                case_id: record.case_id,
                source_ref: record.source_ref,
                chunk_ref: record.chunk_ref,
                model_version: record.model_version,
                text_hash: record.text_hash,
                classification: record.classification,
                entity_ids: record.entity_ids,
                content: record.content,
              },
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`Qdrant point insertion returned HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (err: any) {
      throw new Error(`[QdrantVectorStore] Mandatory vector database point insertion failed: ${err.message}`);
    }
  }

  public override async searchCandidates(
    queryEmbedding: number[],
    scope: AuthScopeAdapter,
    caseIdFilter?: string,
    classificationFilter?: string,
    topK: number = 10
  ): Promise<Array<{ record: InternalVectorRecord; score: number }>> {
    const endpoint = `${this.qdrantUrl}/collections/${this.collectionName}/points/search`;

    const mustFilters: any[] = [];

    mustFilters.push({
      key: 'case_id',
      match: {
        value: caseIdFilter || (scope.authorized_case_ids.length > 0 ? scope.authorized_case_ids[0] : ''),
      },
    });

    if (classificationFilter) {
      mustFilters.push({
        key: 'classification',
        match: {
          value: classificationFilter,
        },
      });
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vector: queryEmbedding,
          filter: {
            must: mustFilters,
          },
          limit: topK,
          with_payload: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Qdrant vector search returned HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as { result?: Array<{ payload: any; score: number }> };
      if (!data || !Array.isArray(data.result)) {
        throw new Error('Malformed response received from Qdrant service');
      }

      const candidates: Array<{ record: InternalVectorRecord; score: number }> = [];

      for (const res of data.result) {
        const payload = res.payload;
        if (!payload) continue;

        if (!isClassificationAuthorized(payload.classification, scope.security_clearance)) {
          continue;
        }

        candidates.push({
          record: {
            vector_id: payload.vector_id,
            case_id: payload.case_id,
            source_ref: payload.source_ref,
            chunk_ref: payload.chunk_ref,
            model_version: payload.model_version,
            text_hash: payload.text_hash,
            classification: payload.classification,
            entity_ids: payload.entity_ids || [],
            embedding: queryEmbedding,
            content: payload.content || '',
          },
          score: res.score,
        });
      }

      return candidates;
    } catch (err: any) {
      throw new Error(`[QdrantVectorStore] Mandatory vector database query failed: ${err.message}`);
    }
  }
}
