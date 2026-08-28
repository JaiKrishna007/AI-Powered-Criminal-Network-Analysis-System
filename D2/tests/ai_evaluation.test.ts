import { describe, test, expect, beforeEach } from 'vitest';
import { EmbeddingGenerator } from '../lib/ai/embeddings/generator.js';
import { VectorStore, InMemoryVectorStore, QdrantVectorStore } from '../lib/vector/index.js';
import { SemanticSearchEngine } from '../lib/vector/semantic_search.js';
import { IntentPlanner } from '../lib/ai/rag/intent.js';
import { AllowlistedToolExecutor } from '../lib/ai/rag/tools.js';
import { HybridRetrievalEngine } from '../lib/ai/rag/hybrid_retrieval.js';
import { MockLLMProvider, OllamaLLMProvider } from '../lib/ai/llm/provider.js';
import { CopilotOrchestrator } from '../lib/ai/rag/copilot.js';
import { ExplainabilityEngine } from '../lib/intelligence/explainability/engine.js';
import { LeadRankingEngine } from '../lib/intelligence/leads/ranking.js';
import { GroundingValidator } from '../lib/ai/llm/grounding.js';
import { CONFIG } from '../lib/config.js';
import { 
  MOCK_AUTH_SCOPE_USER_A, 
  MOCK_AUTH_SCOPE_RESTRICTED, 
  MOCK_EVIDENCE, 
  MOCK_ENTITIES, 
  MOCK_RELATIONSHIPS 
} from './fixtures.js';

describe('Developer 3 AI / RAG — Contract PS26189-CONTRACT-v1 Test Suite', () => {
  let embeddingGenerator: EmbeddingGenerator;
  let vectorStore: VectorStore;
  let semanticSearch: SemanticSearchEngine;
  let intentPlanner: IntentPlanner;
  let toolExecutor: AllowlistedToolExecutor;
  let hybridEngine: HybridRetrievalEngine;
  let mockLLM: MockLLMProvider;
  let copilot: CopilotOrchestrator;
  let explainabilityEngine: ExplainabilityEngine;
  let leadRankingEngine: LeadRankingEngine;

  beforeEach(() => {
    embeddingGenerator = new EmbeddingGenerator('multilingual-e5-small-class', 384);
    vectorStore = new InMemoryVectorStore();

    // Populate vector index with mock evidence
    for (const ev of MOCK_EVIDENCE) {
      const record = embeddingGenerator.generateVectorRecord(ev);
      vectorStore.addRecord(record);
    }

    semanticSearch = new SemanticSearchEngine(vectorStore, embeddingGenerator);
    intentPlanner = new IntentPlanner();

    toolExecutor = new AllowlistedToolExecutor(semanticSearch, {
      entities: MOCK_ENTITIES,
      relationships: MOCK_RELATIONSHIPS,
      evidence: MOCK_EVIDENCE,
    });

    hybridEngine = new HybridRetrievalEngine(intentPlanner, toolExecutor);
    mockLLM = new MockLLMProvider();
    copilot = new CopilotOrchestrator(hybridEngine, mockLLM);
    explainabilityEngine = new ExplainabilityEngine();
    leadRankingEngine = new LeadRankingEngine();
  });

  // ==========================================================================
  // AI-T01: Paraphrased evidence
  // ==========================================================================
  test('AI-T01: Paraphrased evidence retrieval brings back relevant chunk', async () => {
    const paraphrasedQuery = 'funds transferred by director Pendelton to offshore entity';
    
    const searchResult = await semanticSearch.search(
      paraphrasedQuery,
      MOCK_AUTH_SCOPE_USER_A,
      'case_101',
      undefined,
      5
    );

    expect(searchResult.results.length).toBeGreaterThan(0);
    const topMatch = searchResult.results[0];
    expect(topMatch.vector_id).toBe('vec_ev_001');
    expect(topMatch.source_ref).toBe('doc_bank_statement_march.pdf');
    expect(topMatch.chunk_ref).toBe('chunk_001');
  });

  // ==========================================================================
  // AI-T02: No supporting evidence
  // ==========================================================================
  test('AI-T02: No supporting evidence returns INSUFFICIENT_EVIDENCE without fabrication', async () => {
    const question = 'Did Lord Voldemort purchase a submarine in Case 101?';
    
    const response = await copilot.ask(question, 'case_101', MOCK_AUTH_SCOPE_USER_A);

    expect(response.answer).toBe('INSUFFICIENT_EVIDENCE');
    expect(response.evidence_ids).toEqual([]);
    expect(response.limitations.length).toBeGreaterThan(0);
  });

  // ==========================================================================
  // AI-T03: Date + semantic constraints
  // ==========================================================================
  test('AI-T03: Date constraint is strictly respected over pure semantic score', async () => {
    const question = 'Show settlements after 2026-04-01';
    
    const context = await hybridEngine.execute(question, 'case_101', MOCK_AUTH_SCOPE_USER_A, 5);

    expect(context.evidence.length).toBe(1);
    expect(context.evidence[0].id).toBe('ev_003_recent');
    expect(context.evidence[0].date).toBe('2026-04-10');
  });

  // ==========================================================================
  // AI-T04: Grounded graph path
  // ==========================================================================
  test('AI-T04: Grounded graph path matching answer corresponds to retrieved graph', async () => {
    const question = 'What is the connection path between ent_alpha and ent_gamma?';

    const testLLM = new MockLLMProvider(() => {
      return 'Based on graph rel_001 and rel_002, ent_alpha transferred $50,000 to ent_beta, which then transferred $48,000 to ent_gamma.';
    });
    const customCopilot = new CopilotOrchestrator(hybridEngine, testLLM);

    const response = await customCopilot.ask(question, 'case_101', MOCK_AUTH_SCOPE_USER_A);

    expect(response.answer).toContain('ent_alpha');
    expect(response.answer).toContain('ent_beta');
    expect(response.answer).toContain('ent_gamma');
    expect(response.graph_request).toBeDefined();
    expect(response.graph_request?.focus_entity_id).toBeDefined();
  });

  // ==========================================================================
  // AI-T05: Prompt-injection text in document
  // ==========================================================================
  test('AI-T05: Embedded prompt-injection instruction inside evidence is ignored', async () => {
    const question = 'Summarize suspicious email invoice details in case 101';

    const context = await hybridEngine.execute(question, 'case_101', MOCK_AUTH_SCOPE_USER_A, 5);
    const hasInjectionDoc = context.evidence.some((e) => e.id === 'ev_prompt_injection');
    expect(hasInjectionDoc).toBe(true);

    const response = await copilot.ask(question, 'case_101', MOCK_AUTH_SCOPE_USER_A);

    expect(response.answer).not.toContain('HACKED');
    expect(response.answer).not.toContain('rm -rf');
  });

  // ==========================================================================
  // AI-T06: Restricted case query (Case Isolation & Authorization Scope)
  // ==========================================================================
  test('AI-T06: User cannot query restricted case_999 or secret classification context', async () => {
    const question = 'Retrieve secret intercept documents for Subject Omega in case_999';

    const response = await copilot.ask(question, 'case_999', MOCK_AUTH_SCOPE_RESTRICTED);

    expect(response.answer).toBe('INSUFFICIENT_EVIDENCE');
    expect(response.evidence_ids).toEqual([]);
    expect(response.limitations[0]).toContain('Access Denied');
  });

  // ==========================================================================
  // AI-T07: Explainability
  // ==========================================================================
  test('AI-T07: Insight reasons map to stored signals and supporting evidence', () => {
    const insight = explainabilityEngine.generateInsight(
      'case_101',
      'ent_beta',
      MOCK_EVIDENCE,
      MOCK_RELATIONSHIPS,
      MOCK_AUTH_SCOPE_USER_A
    );

    expect(insight.case_id).toBe('case_101');
    expect(insight.signals.bridge_signals).toBeDefined();
    expect(insight.signals.bridge_signals?.[0].reason_code).toBe('BRIDGE_NODE_HIGH_CENTRALITY');
    expect(insight.signals.financial_signals).toBeDefined();
    expect(insight.signals.financial_signals?.[0].amount).toBe(98000);
    expect(insight.signals.evidence_density?.count).toBeGreaterThan(0);
    expect(insight.supporting_evidence_ids).toContain('ev_001');
  });

  // ==========================================================================
  // AI-T08: Lead fixture (Advisory task ordering)
  // ==========================================================================
  test('AI-T08: Lead ranking ranks tasks based on evidence completeness and uncertainty penalty', () => {
    const taskA = {
      case_id: 'case_101',
      target_entity: MOCK_ENTITIES[1],
      related_evidence: [MOCK_EVIDENCE[0], MOCK_EVIDENCE[2]],
      related_relationships: [MOCK_RELATIONSHIPS[0], MOCK_RELATIONSHIPS[1]],
      query_relevance: 0.9,
    };

    const taskB = {
      case_id: 'case_101',
      target_entity: {
        id: 'ent_weak',
        case_id: 'case_101',
        name: 'Weak Unverified Lead',
        type: 'PERSON',
        classification: 'UNCLASSIFIED',
        created_at: '2026-01-01T00:00:00Z',
      },
      related_evidence: [],
      related_relationships: [],
      query_relevance: 0.2,
    };

    const ranked = leadRankingEngine.rankTasks([taskB, taskA], MOCK_AUTH_SCOPE_USER_A);

    expect(ranked[0].target_entity_id).toBe('ent_beta');
    expect(ranked[1].target_entity_id).toBe('ent_weak');
    expect(ranked[0].lead_score).toBeGreaterThan(ranked[1].lead_score);
    expect(ranked[0].score_breakdown.uncertainty_penalty).toBeLessThan(ranked[1].score_breakdown.uncertainty_penalty);
    expect(ranked[0].advisory_notes).toContain('Advisory task review priority score');
  });

  // ==========================================================================
  // Technology Integration & Verification Tests
  // ==========================================================================

  test('Technology Migration: multilingual-e5-small-class embedding generator initialization and dimension tracking', () => {
    const generator = new EmbeddingGenerator('multilingual-e5-small-class', 384);
    expect(generator.getModelVersion()).toBe('multilingual-e5-small-class');
    expect(generator.getEmbeddingDimension()).toBe(384);

    const vector = generator.generateEmbedding('test transaction text');
    expect(vector.length).toBe(384);

    const record = generator.generateVectorRecord(MOCK_EVIDENCE[0]);
    expect(record.model_version).toBe('multilingual-e5-small-class');
    expect(record.embedding.length).toBe(384);
    expect(record.text_hash).toBeDefined();
  });

  test('Technology Migration: OllamaLLMProvider targets Qwen3 4B Q4 and throws explicit error on production failure', async () => {
    const ollamaProvider = new OllamaLLMProvider('http://localhost:9999/down_endpoint', CONFIG.OLLAMA_MODEL);
    expect(ollamaProvider.getModelName()).toBe(CONFIG.OLLAMA_MODEL);

    await expect(
      ollamaProvider.generate({ systemPrompt: 'test prompt', userPrompt: 'test user query' })
    ).rejects.toThrow('Mandatory local LLM invocation failed');
  });

  test('Technology Migration: QdrantVectorStore adapter throws explicit error when Qdrant endpoint is unreachable in production', async () => {
    const qdrantStore = new QdrantVectorStore('http://localhost:9999/down_qdrant', CONFIG.QDRANT_COLLECTION, 384);
    expect(qdrantStore.getCollectionName()).toBe(CONFIG.QDRANT_COLLECTION);
    expect(qdrantStore.getVectorDimension()).toBe(384);

    const dummyRecord = embeddingGenerator.generateVectorRecord(MOCK_EVIDENCE[0]);
    
    // Explicit error check on production insertion failure
    await expect(qdrantStore.addRecord(dummyRecord)).rejects.toThrow(
      'Mandatory vector database point insertion failed'
    );

    // Explicit error check on production search query failure
    await expect(
      qdrantStore.searchCandidates(dummyRecord.embedding, MOCK_AUTH_SCOPE_USER_A, 'case_101')
    ).rejects.toThrow('Mandatory vector database query failed');
  });

  test('Technology Migration: QdrantVectorStore rejects insertion when vector dimension does not match collection dimension', async () => {
    const qdrantStore = new QdrantVectorStore('http://localhost:6333', CONFIG.QDRANT_COLLECTION, 384);
    const dummyRecord = embeddingGenerator.generateVectorRecord(MOCK_EVIDENCE[0]);
    dummyRecord.embedding = new Array(128).fill(0.1); // Mismatched dimension (128 vs 384)

    await expect(qdrantStore.addRecord(dummyRecord)).rejects.toThrow('Vector dimension mismatch');
  });

  test('Technology Migration: Clear distinction between Qdrant production adapter and InMemory unit test store', () => {
    const memoryStore = new InMemoryVectorStore();
    const qdrantStore = new QdrantVectorStore();

    expect(memoryStore).toBeInstanceOf(InMemoryVectorStore);
    expect(qdrantStore).toBeInstanceOf(QdrantVectorStore);
    expect(qdrantStore.getCollectionName()).toBe(CONFIG.QDRANT_COLLECTION);
  });
});
