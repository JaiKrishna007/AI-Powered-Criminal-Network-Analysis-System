import crypto from 'crypto';
import { VectorRecordMetadata, InternalVectorRecord, EvidenceV1 } from '../../../contracts/adapters.js';

export const DEFAULT_MODEL_VERSION = 'nomic-embed-text-v1.5';

/**
 * Prototype Embedding Generator implementation.
 * Encapsulates vector generation behind EmbeddingGenerator interface, retaining model_version and text_hash.
 * Uses deterministic term/ngram hashing for synthetic test repeatability without external cloud model dependencies.
 * Designed to be modular and replaceable with a production neural embedding model.
 */

/**
 * Computes deterministic SHA-256 hash of raw text.
 */
export function computeTextHash(text: string): string {
  return crypto.createHash('sha256').update(text.trim()).digest('hex');
}

/**
 * Generates a deterministic text embedding vector using FNV-1a vocabulary hashing
 * (128 dimensions) so term matching and paraphrased queries produce accurate cosine similarity rankings.
 */
export function generateDeterministicEmbedding(text: string, dimensions: number = 128): number[] {
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, '');
  const words = normalized.split(/\s+/).filter((w) => w.length > 2);
  
  const vector = new Array(dimensions).fill(0);
  
  for (const word of words) {
    // FNV-1a hash
    let hash = 2166136261;
    for (let i = 0; i < word.length; i++) {
      hash ^= word.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    const idx = Math.abs(hash) % dimensions;
    vector[idx] += 1.0;
  }

  // Also include 3-gram character features
  for (let i = 0; i < normalized.length - 2; i++) {
    const gram = normalized.slice(i, i + 3);
    let gHash = 2166136261;
    for (let j = 0; j < gram.length; j++) {
      gHash ^= gram.charCodeAt(j);
      gHash = Math.imul(gHash, 16777619);
    }
    const idx = Math.abs(gHash) % dimensions;
    vector[idx] += 0.2;
  }

  // L2 Normalize vector
  let norm = 0;
  for (let i = 0; i < dimensions; i++) {
    norm += vector[i] * vector[i];
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < dimensions; i++) {
      vector[i] /= norm;
    }
  }

  return vector;
}

export class EmbeddingGenerator {
  private modelVersion: string;

  constructor(modelVersion: string = DEFAULT_MODEL_VERSION) {
    this.modelVersion = modelVersion;
  }

  public getModelVersion(): string {
    return this.modelVersion;
  }

  /**
   * Generates a complete InternalVectorRecord from an Evidence chunk.
   */
  public generateVectorRecord(evidence: EvidenceV1): InternalVectorRecord {
    const textHash = computeTextHash(evidence.content);
    const embedding = generateDeterministicEmbedding(evidence.content, 128);

    return {
      vector_id: `vec_${evidence.id}`,
      case_id: evidence.case_id,
      source_ref: evidence.source_ref,
      chunk_ref: evidence.chunk_ref,
      model_version: this.modelVersion,
      text_hash: textHash,
      classification: evidence.classification,
      entity_ids: evidence.entity_ids || [],
      embedding,
      content: evidence.content,
    };
  }

  /**
   * Checks if an existing vector record is stale (model_version change or text_hash mismatch)
   * and regenerates if needed.
   */
  public shouldRegenerate(record: VectorRecordMetadata, currentContent: string): boolean {
    if (record.model_version !== this.modelVersion) {
      return true;
    }
    const currentHash = computeTextHash(currentContent);
    return record.text_hash !== currentHash;
  }
}
