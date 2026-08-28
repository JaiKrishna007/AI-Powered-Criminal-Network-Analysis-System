/**
 * Centralized Configuration for AI/RAG Technology Stack.
 * Reads environment variables with production defaults.
 */
export const CONFIG = {
  OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  OLLAMA_MODEL: process.env.OLLAMA_MODEL || 'qwen3:4b-q4',
  QDRANT_URL: process.env.QDRANT_URL || 'http://localhost:6333',
  QDRANT_COLLECTION: process.env.QDRANT_COLLECTION || 'netra_evidence_chunks',
  EMBEDDING_MODEL_NAME: process.env.EMBEDDING_MODEL_NAME || 'multilingual-e5-small-class',
  EMBEDDING_MODEL_VERSION: process.env.EMBEDDING_MODEL_VERSION || 'v1.0.0',
};

/**
 * Validates configuration settings and throws fast if required production environment variables are missing or invalid.
 */
export function validateConfig(): void {
  if (!CONFIG.OLLAMA_BASE_URL || !CONFIG.OLLAMA_MODEL) {
    throw new Error('Invalid Configuration: OLLAMA_BASE_URL and OLLAMA_MODEL must be defined.');
  }
  if (!CONFIG.QDRANT_URL || !CONFIG.QDRANT_COLLECTION) {
    throw new Error('Invalid Configuration: QDRANT_URL and QDRANT_COLLECTION must be defined.');
  }
  if (!CONFIG.EMBEDDING_MODEL_NAME) {
    throw new Error('Invalid Configuration: EMBEDDING_MODEL_NAME must be defined.');
  }
}

