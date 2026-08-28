// Ollama Integration for D3 Agent Copilot

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'qwen3:4b';

interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function generateCopilotResponse(messages: OllamaMessage[], options = {}) {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: messages,
        stream: false,
        options: {
          temperature: 0.1, // Low temperature for deterministic, factual responses
          ...options
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.message.content;

  } catch (error: any) {
    console.error("Error communicating with Ollama:", error);
    const err = new Error(error.message || "MODEL_UNAVAILABLE");
    err.name = "MODEL_UNAVAILABLE";
    throw err;
  }
}

export async function generateEmbedding(text: string, model: string = 'multilingual-e5-small'): Promise<number[]> {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        prompt: text
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama Embedding API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.embedding;
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw new Error("Embedding generation failed.");
  }
}
