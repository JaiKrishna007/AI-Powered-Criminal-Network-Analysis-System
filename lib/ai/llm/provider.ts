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
 * Production Ollama LLM Provider.
 * Calls local Ollama API at endpoint (default: http://localhost:11434/api/generate).
 * Throws explicit service error when Ollama is unreachable or fails.
 * NO SILENT FAKE FALLBACKS IN PRODUCTION.
 */
export class OllamaLLMProvider implements LLMProvider {
  private endpoint: string;
  private model: string;

  constructor(endpoint: string = 'http://localhost:11434/api/generate', model: string = 'llama3.2') {
    this.endpoint = endpoint;
    this.model = model;
  }

  public async generate(request: LLMRequest): Promise<LLMResponse> {
    const prompt = `${request.systemPrompt}\n\n${request.userPrompt}`;

    try {
      const response = await fetch(this.endpoint, {
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
      // Production Rule: Explicit service failure, do NOT fabricate answers or pretend Copilot succeeded.
      throw new Error(`[OllamaLLMProvider] Mandatory local LLM invocation failed: ${err.message}`);
    }
  }
}

/**
 * Mock LLM Provider for deterministic automated testing ONLY.
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
