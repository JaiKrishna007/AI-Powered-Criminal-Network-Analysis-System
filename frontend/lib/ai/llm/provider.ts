import { CONFIG } from '../../config.js';

export interface LLMRequest {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
}

export interface LLMResponse {
  content: string;
  raw?: any;
}

export interface LLMProvider {
  generate(request: LLMRequest): Promise<LLMResponse>;
}

/**
 * Production Ollama LLM Provider targeting Qwen3 4B Q4 via local Ollama.
 * Endpoint default: ${CONFIG.OLLAMA_BASE_URL}/api/generate
 * Model default: ${CONFIG.OLLAMA_MODEL}
 * Throws explicit service error when Ollama is unreachable or fails.
 * NO SILENT FAKE FALLBACKS IN PRODUCTION.
 */
export class OllamaLLMProvider implements LLMProvider {
  private baseUrl: string;
  private model: string;

  constructor(
    baseUrl: string = CONFIG.OLLAMA_BASE_URL,
    model: string = CONFIG.OLLAMA_MODEL
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.model = model;
  }

  public getModelName(): string {
    return this.model;
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public async generate(request: LLMRequest): Promise<LLMResponse> {
    const endpoint = `${this.baseUrl}/api/generate`;
    const prompt = `${request.systemPrompt}\n\n${request.userPrompt}`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: false,
          options: {
            temperature: request.temperature ?? 0.1,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama service returned HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as { response?: string };
      if (!data || typeof data.response !== 'string') {
        throw new Error('Malformed response received from Ollama service');
      }

      return {
        content: data.response,
        raw: data,
      };
    } catch (err: any) {
      // Mandatory explicit service error handling in production
      throw new Error(`[OllamaLLMProvider] Mandatory local LLM invocation failed (model: ${this.model}): ${err.message}`);
    }
  }
}

/**
 * Mock LLM Provider for deterministic unit testing ONLY.
 */
export class MockLLMProvider implements LLMProvider {
  private mockResponder?: (request: LLMRequest) => string;

  constructor(mockResponder?: (request: LLMRequest) => string) {
    this.mockResponder = mockResponder;
  }

  public async generate(request: LLMRequest): Promise<LLMResponse> {
    if (this.mockResponder) {
      return { content: this.mockResponder(request) };
    }

    const uLower = request.userPrompt.toLowerCase();

    // Check for unsupported topics / questions with no matching evidence
    if (uLower.includes('voldemort') || uLower.includes('submarine') || uLower.includes('no retrieved context available')) {
      return { content: 'INSUFFICIENT_EVIDENCE' };
    }

    // Default deterministic responder for testing
    if (uLower.includes('prompt-injection') || uLower.includes('ignore previous')) {
      return {
        content: 'Based strictly on evidence ID ev_001, Person Alpha engaged in transaction of $50,000 on 2026-03-15.',
      };
    }

    if (uLower.includes('retrieved evidence chunks')) {
      return {
        content: 'Based on the retrieved evidence, evidence ID ev_001 documents transaction of $50,000 between entity ent_001 and ent_002 on 2026-03-15.',
      };
    }

    return { content: 'INSUFFICIENT_EVIDENCE' };
  }
}
