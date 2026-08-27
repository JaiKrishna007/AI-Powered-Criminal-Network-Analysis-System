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
};
