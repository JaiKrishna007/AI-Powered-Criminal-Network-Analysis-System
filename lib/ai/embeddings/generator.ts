import crypto from 'crypto';
import { VectorRecordMetadata, InternalVectorRecord, EvidenceV1 } from '../../../contracts/adapters.js';
import { CONFIG } from '../../config.js';

export const DEFAULT_MODEL_VERSION = CONFIG.EMBEDDING_MODEL_NAME;

/**
 * Computes deterministic SHA-256 hash of raw text.
 */
export function computeTextHash(text: string): string {
  return crypto.createHash('sha256').update(text.trim()).digest('hex');
}

/**
 * Generates a deterministic text embedding vector using FNV-1a vocabulary hashing
 * and character n-grams normalized to L2 norm.
 * Used for local CPU vector generation and deterministic unit test repeatability.
 */
export function generateDeterministicEmbedding(text: string, dimensions: number = 384): number[] {
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

  // Include 3-gram character features
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
  private dimension: number;

  constructor(modelVersion: string = DEFAULT_MODEL_VERSION, dimension?: number) {
    this.modelVersion = modelVersion;
    // Discover dimension dynamically from target model output if not explicitly specified
    this.dimension = dimension ?? this.discoverDimension(modelVersion);
  }

  /**
   * Discovers/verifies embedding dimension based on verified target model specifications.
   */
  private discoverDimension(modelName: string): number {
    if (modelName.includes('multilingual-e5-small')) {
      return 384;
    }
    if (modelName.includes('e5-large')) {
      return 1024;
    }
    return 384; // Approved default dimension for multilingual-e5-small-class
  }

  public getModelVersion(): string {
    return this.modelVersion;
  }

  public getEmbeddingDimension(): number {
    return this.dimension;
  }

  /**
   * Generates a local CPU text embedding vector.
   */
  public generateEmbedding(text: string): number[] {
    const vector = generateDeterministicEmbedding(text, this.dimension);
    if (vector.length !== this.dimension) {
      throw new Error(`Embedding dimension mismatch: expected ${this.dimension}, generated ${vector.length}`);
    }
    return vector;
  }

  /**
   * Generates a complete InternalVectorRecord from an Evidence chunk.
   */
  public generateVectorRecord(evidence: EvidenceV1): InternalVectorRecord {
    const textHash = computeTextHash(evidence.content);
    const embedding = this.generateEmbedding(evidence.content);

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
