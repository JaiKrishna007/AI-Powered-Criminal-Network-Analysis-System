import { HybridRetrievalEngine } from './hybrid_retrieval.js';
import { LLMProvider, OllamaLLMProvider } from '../llm/provider.js';
import { SYSTEM_PROMPT_COPILOT, buildSecuredUserPrompt } from '../llm/prompt_defense.js';
import { GroundingValidator } from '../llm/grounding.js';
import { AuthScopeAdapter, CopilotV1Adapter, GraphRequestPayload } from '../../../contracts/adapters.js';

export class CopilotOrchestrator {
  private hybridRetrievalEngine: HybridRetrievalEngine;
  private llmProvider: LLMProvider;
  private groundingValidator: GroundingValidator;

  constructor(
    hybridRetrievalEngine: HybridRetrievalEngine,
    llmProvider: LLMProvider = new OllamaLLMProvider(),
    groundingValidator: GroundingValidator = new GroundingValidator()
  ) {
    this.hybridRetrievalEngine = hybridRetrievalEngine;
    this.llmProvider = llmProvider;
    this.groundingValidator = groundingValidator;
  }

  /**
   * Complete Copilot Pipeline Execution.
   */
  public async ask(
    question: string,
    caseId: string,
    scope: AuthScopeAdapter
  ): Promise<CopilotV1Adapter> {
    // 1. Authorization Scope Guard Check
    if (!scope.authorized_case_ids.includes(caseId)) {
      return {
        answer: 'INSUFFICIENT_EVIDENCE',
        evidence_ids: [],
        limitations: [`Access Denied: Case ID ${caseId} is not within user authorized scope.`],
      };
    }

    // 2. Intent Classification, Allowlisted Tool Execution, & Hybrid Retrieval
    const context = this.hybridRetrievalEngine.execute(question, caseId, scope);

    // 3. Early Check: If zero evidence/relationships retrieved within scope
    if (context.evidence.length === 0 && context.relationships.length === 0 && context.entities.length === 0) {
      return {
        answer: 'INSUFFICIENT_EVIDENCE',
        evidence_ids: [],
        limitations: ['No authorized supporting evidence or relationships found for this case.'],
      };
    }

    // 4. Secured User Prompt Framing (Prompt-Injection Defense)
    const userPrompt = buildSecuredUserPrompt(context);

    // 5. Invoke LLM Provider (Production uses OllamaLLMProvider, throws explicit error on failure)
    const llmResult = await this.llmProvider.generate({
      systemPrompt: SYSTEM_PROMPT_COPILOT,
      userPrompt,
      temperature: 0.1,
    });

    // 6. Grounded Response Validation
    const validation = this.groundingValidator.validate(llmResult.content, context);

    // 7. Optional Graph Request Construction if intent is graph/path related
    let graphRequest: GraphRequestPayload | undefined = undefined;
    if (context.intent === 'CONNECTION_PATH' || context.intent === 'WHY_HIGHLIGHTED') {
      const firstEntityId = context.entities.length > 0 ? context.entities[0].id : undefined;
      graphRequest = {
        focus_entity_id: firstEntityId,
        depth: 2,
        relationship_types: ['TRANSFERRED_FUNDS', 'COMMUNICATED_WITH'],
      };
    }

    return {
      answer: validation.sanitizedAnswer,
      evidence_ids: validation.validatedEvidenceIds,
      limitations: validation.limitations,
      graph_request: graphRequest,
    };
  }
}
