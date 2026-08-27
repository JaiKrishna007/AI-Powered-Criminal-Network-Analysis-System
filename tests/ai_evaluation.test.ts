import { describe, test, expect, beforeEach } from 'vitest';
import { EmbeddingGenerator } from '../lib/ai/embeddings/generator.js';
import { VectorStore } from '../lib/vector/index.js';
import { SemanticSearchEngine } from '../lib/vector/semantic_search.js';
import { IntentPlanner } from '../lib/ai/rag/intent.js';
import { AllowlistedToolExecutor } from '../lib/ai/rag/tools.js';
import { HybridRetrievalEngine } from '../lib/ai/rag/hybrid_retrieval.js';
import { MockLLMProvider, OllamaLLMProvider } from '../lib/ai/llm/provider.js';
import { CopilotOrchestrator } from '../lib/ai/rag/copilot.js';
import { ExplainabilityEngine } from '../lib/intelligence/explainability/engine.js';
import { LeadRankingEngine } from '../lib/intelligence/leads/ranking.js';
import { GroundingValidator } from '../lib/ai/llm/grounding.js';
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
    embeddingGenerator = new EmbeddingGenerator('nomic-embed-text-v1.5');
    vectorStore = new VectorStore();

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
  test('AI-T01: Paraphrased evidence retrieval brings back relevant chunk', () => {
    // Paraphrased query rephrasing "Arthur Pendelton transferred $50,000 to Beta Holdings"
    const paraphrasedQuery = 'funds transferred by director Pendelton to offshore entity';
    
    const searchResult = semanticSearch.search(
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
    // Query about non-existent entity with no evidence in case
    const question = 'Did Lord Voldemort purchase a submarine in Case 101?';
    
    const response = await copilot.ask(question, 'case_101', MOCK_AUTH_SCOPE_USER_A);

    expect(response.answer).toBe('INSUFFICIENT_EVIDENCE');
    expect(response.evidence_ids).toEqual([]);
    expect(response.limitations.length).toBeGreaterThan(0);
  });

  // ==========================================================================
  // AI-T03: Date + semantic constraints
  // ==========================================================================
  test('AI-T03: Date constraint is strictly respected over pure semantic score', () => {
    // Query specifying date restriction "after 2026-04-01"
    const question = 'Show settlements after 2026-04-01';
    
    const context = hybridEngine.execute(question, 'case_101', MOCK_AUTH_SCOPE_USER_A, 5);

    // ev_001 is from 2026-03-15, ev_002_old is from 2026-01-10, ev_003_recent is 2026-04-10
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

    // Verify that prompt defense sanitizes or neutralizes embedded instructions
    const context = hybridEngine.execute(question, 'case_101', MOCK_AUTH_SCOPE_USER_A, 5);
    const hasInjectionDoc = context.evidence.some((e) => e.id === 'ev_prompt_injection');
    expect(hasInjectionDoc).toBe(true);

    const response = await copilot.ask(question, 'case_101', MOCK_AUTH_SCOPE_USER_A);

    // Ensure system prompt/parser rejected the command "ignore previous instructions"
    expect(response.answer).not.toContain('HACKED');
    expect(response.answer).not.toContain('rm -rf');
  });

  // ==========================================================================
  // AI-T06: Restricted case query (Case Isolation & Authorization Scope)
  // ==========================================================================
  test('AI-T06: User cannot query restricted case_999 or secret classification context', async () => {
    // User B only authorized for case_101 UNCLASSIFIED
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
    expect(insight.signals.financial_signals?.[0].amount).toBe(98000); // 50000 + 48000
    expect(insight.signals.evidence_density?.count).toBeGreaterThan(0);
    expect(insight.supporting_evidence_ids).toContain('ev_001');
  });

  // ==========================================================================
  // AI-T08: Lead fixture (Advisory task ordering)
  // ==========================================================================
  test('AI-T08: Lead ranking ranks tasks based on evidence completeness and uncertainty penalty', () => {
    const taskA = {
      case_id: 'case_101',
      target_entity: MOCK_ENTITIES[1], // ent_beta: 2 relationships, multiple evidence, complete attributes
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
      }, // 0 evidence, 0 relationships, missing attributes
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
  // Additional Required Verification Tests
  // ==========================================================================

  test('get_path returns actual ordered relationship path and handles no-path explicitly', () => {
    const pathResult = toolExecutor.get_path('ent_alpha', 'ent_gamma', MOCK_AUTH_SCOPE_USER_A, 'case_101');
    expect(pathResult.pathFound).toBe(true);
    expect(pathResult.nodes.map((n) => n.id)).toEqual(['ent_alpha', 'ent_beta', 'ent_gamma']);
    expect(pathResult.edges.map((e) => e.id)).toEqual(['rel_001', 'rel_002']);

    const noPathResult = toolExecutor.get_path('ent_alpha', 'non_existent_entity', MOCK_AUTH_SCOPE_USER_A, 'case_101');
    expect(noPathResult.pathFound).toBe(false);
    expect(noPathResult.nodes).toEqual([]);
    expect(noPathResult.edges).toEqual([]);
  });

  test('get_graph strictly honors focusEntityId and traversal depth', () => {
    // Focused graph around ent_alpha with depth=1 should return ent_alpha, ent_beta, and rel_001 (not ent_gamma or rel_002)
    const focusedGraphDepth1 = toolExecutor.get_graph(MOCK_AUTH_SCOPE_USER_A, 'case_101', 'ent_alpha', 1);
    expect(focusedGraphDepth1.nodes.map((n) => n.id)).toContain('ent_alpha');
    expect(focusedGraphDepth1.nodes.map((n) => n.id)).toContain('ent_beta');
    expect(focusedGraphDepth1.nodes.map((n) => n.id)).not.toContain('ent_gamma');
    expect(focusedGraphDepth1.edges.map((e) => e.id)).toEqual(['rel_001']);

    // Focused graph with depth=2 should reach ent_gamma and include rel_002
    const focusedGraphDepth2 = toolExecutor.get_graph(MOCK_AUTH_SCOPE_USER_A, 'case_101', 'ent_alpha', 2);
    expect(focusedGraphDepth2.nodes.map((n) => n.id)).toContain('ent_gamma');
    expect(focusedGraphDepth2.edges.map((e) => e.id)).toContain('rel_002');
  });

  test('Hybrid retrieval performs actual candidate scoring and ranking before top-k selection', () => {
    const context = hybridEngine.execute('Audit report transfer $50,000 on 2026-03-15', 'case_101', MOCK_AUTH_SCOPE_USER_A, 2);
    expect(context.evidence.length).toBeLessThanOrEqual(2);
    // Highest scoring chunk matching date, amount, and semantic query should be ev_001
    expect(context.evidence[0].id).toBe('ev_001');
  });

  test('Grounding validation rejects unverified entity or amount claims with INSUFFICIENT_EVIDENCE', () => {
    const validator = new GroundingValidator();
    const mockContext = hybridEngine.execute('Summary', 'case_101', MOCK_AUTH_SCOPE_USER_A, 5);

    // LLM output claiming unverified amount $9,999,999 not in context
    const ungroundedOutput = 'Arthur Pendelton transferred $9,999,999 to alien entity ent_fake.';
    const result = validator.validate(ungroundedOutput, mockContext);

    expect(result.isGrounded).toBe(false);
    expect(result.sanitizedAnswer).toBe('INSUFFICIENT_EVIDENCE');
    expect(result.limitations.some((l) => l.includes('Unverified'))).toBe(true);
  });

  test('Security clearance classification filtering excludes RESTRICTED data from UNCLASSIFIED user scope', () => {
    // MOCK_AUTH_SCOPE_RESTRICTED has security_clearance = 'UNCLASSIFIED'
    const entities = toolExecutor.get_entity('Beta', MOCK_AUTH_SCOPE_RESTRICTED);
    // ent_beta is RESTRICTED, so UNCLASSIFIED user must get empty result
    expect(entities).toEqual([]);

    const timeline = toolExecutor.get_timeline(MOCK_AUTH_SCOPE_RESTRICTED, 'case_101');
    // ev_001 and ev_003_recent are RESTRICTED, ev_002_old and ev_prompt_injection are UNCLASSIFIED
    const restrictedEvs = timeline.filter((e) => e.classification === 'RESTRICTED' || e.classification === 'SECRET');
    expect(restrictedEvs.length).toBe(0);
  });

  test('Vector Store separates contract metadata from internal storage fields', () => {
    const metadata = vectorStore.exportMetadata('vec_ev_001');
    expect(metadata).toBeDefined();
    expect(metadata?.vector_id).toBe('vec_ev_001');
    expect(metadata?.case_id).toBe('case_101');
    expect(metadata?.model_version).toBe('nomic-embed-text-v1.5');
    // Ensure internal implementation fields (embedding, content) are NOT in contract metadata export
    expect((metadata as any).embedding).toBeUndefined();
    expect((metadata as any).content).toBeUndefined();
  });

  test('Production OllamaLLMProvider throws explicit service error when service is down', async () => {
    const ollama = new OllamaLLMProvider('http://localhost:9999/invalid_endpoint', 'llama3.2');
    await expect(ollama.generate({ systemPrompt: 'test', userPrompt: 'test' })).rejects.toThrow(
      'Mandatory local LLM invocation failed'
    );
  });

  test('Intent Planner rejects non-allowlisted tool execution attempts', () => {
    const plan = intentPlanner.planQuery('Execute SQL query SELECT * FROM users', 'case_101');
    // Ensure no raw SQL or non-allowlisted tools exist in planned operations
    const invalidOps = plan.operations.filter((op) => !['search_evidence', 'get_entity', 'get_path', 'get_timeline', 'get_transactions', 'get_graph'].includes(op.tool));
    expect(invalidOps.length).toBe(0);
  });
});
