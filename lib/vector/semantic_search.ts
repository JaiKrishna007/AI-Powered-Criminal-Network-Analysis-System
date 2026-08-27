import { VectorStore } from './index.js';
import { EmbeddingGenerator, generateDeterministicEmbedding } from '../ai/embeddings/generator.js';
import { AuthScopeAdapter, SearchV1Adapter, SearchResultItem } from '../../contracts/adapters.js';

export class SemanticSearchEngine {
  private vectorStore: VectorStore;
  private embeddingGenerator: EmbeddingGenerator;

  constructor(vectorStore: VectorStore, embeddingGenerator: EmbeddingGenerator) {
    this.vectorStore = vectorStore;
    this.embeddingGenerator = embeddingGenerator;
  }

  /**
   * Performs scope-enforced vector semantic retrieval.
   */
  public search(
    query: string,
    scope: AuthScopeAdapter,
    caseId?: string,
    classificationFilter?: string,
    topK: number = 5,
    minScoreThreshold: number = 0.05
  ): SearchV1Adapter {
    const queryEmbedding = generateDeterministicEmbedding(query, 128);
    
    const candidates = this.vectorStore.searchCandidates(
      queryEmbedding,
      scope,
      caseId,
      classificationFilter,
      topK
    );

    // Filter candidates below relevance score threshold
    const filteredCandidates = candidates.filter(({ score }) => score >= minScoreThreshold);

    const results: SearchResultItem[] = filteredCandidates.map(({ record, score }) => ({
      vector_id: record.vector_id,
      case_id: record.case_id,
      source_ref: record.source_ref,
      chunk_ref: record.chunk_ref,
      relevance_score: Number(score.toFixed(4)),
      snippet: record.content,
      classification: record.classification,
      entity_ids: record.entity_ids,
    }));

    return {
      query,
      case_id: caseId || (scope.authorized_case_ids.length > 0 ? scope.authorized_case_ids[0] : ''),
      results,
      total: results.length,
    };
  }
}
