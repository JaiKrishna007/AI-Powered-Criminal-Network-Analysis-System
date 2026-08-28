import { z } from 'zod';
import { ServiceErrors, handleServiceError } from '../errors/service_errors';

const D3_URL = process.env.D3_SERVICE_URL || 'http://localhost:3003';

export interface AuthContext {
  user_id: string;
  role: string;
  case_id: string;
  access_level: string;
}

const AIResponseSchema = z.object({
  status: z.string(),
  results: z.array(z.any()).optional(),
  data: z.any().optional(),
}).passthrough();

const CopilotResponseSchema = z.object({
  status: z.string(),
  response: z.string(),
  grounding: z.array(z.string()).optional()
}).passthrough();

const LeadResponseSchema = z.object({
  status: z.string(),
  leads: z.array(z.any())
}).passthrough();

export class AIClient {
  static async fetchD3(endpoint: string, context: AuthContext, payload: any, timeoutMs: number = 30000, schema?: z.ZodTypeAny) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${D3_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': JSON.stringify(context)
        },
        body: JSON.stringify({ context, ...payload }),
        signal: controller.signal
      });

      clearTimeout(id);

      if (!response.ok) {
        throw ServiceErrors.AI_SERVICE_UNAVAILABLE();
      }

      const data = await response.json();
      
      if (schema) {
        const parsed = schema.safeParse(data);
        if (!parsed.success) {
          throw ServiceErrors.INVALID_SERVICE_RESPONSE(parsed.error);
        }
        return parsed.data;
      }

      return data;
    } catch (error: any) {
      clearTimeout(id);
      if (error.name === 'AbortError') {
        throw ServiceErrors.SERVICE_TIMEOUT('AI_SERVICE');
      }
      throw handleServiceError(error);
    }
  }

  static async searchCase(context: AuthContext, query: string, filters?: any) {
    return await this.fetchD3('/search', context, { query, filters }, 15000, AIResponseSchema);
  }

  static async copilot(context: AuthContext, query: string) {
    return await this.fetchD3('/copilot', context, { query }, 30000, CopilotResponseSchema);
  }

  static async generateLeads(context: AuthContext, request: any) {
    return await this.fetchD3('/leads', context, { request }, 30000, LeadResponseSchema);
  }
}
