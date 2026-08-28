import { z } from 'zod';
import { ServiceErrors, handleServiceError } from '../errors/service_errors';
import { AuthContext } from './ai_client';

const getD4Url = () => process.env.D4_SERVICE_URL || 'http://localhost:8003';

import { GraphResponseSchema, BridgeAnalysisResponseSchema, TemporalAnalysisResponseSchema } from '../contracts';

import { signAuthContext } from '../utils/security';

export class GraphClient {
  static async fetchD4(endpoint: string, context: AuthContext, payload: any, timeoutMs: number = 10000, schema?: z.ZodTypeAny) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const { contextHeader, signatureHeader } = signAuthContext({
        user_id: context.user_id,
        role: context.role,
        case_id: context.case_id,
        access_level: context.access_level
      });

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Authorization-Context': contextHeader,
        'X-Authorization-Signature': signatureHeader
      };

      if (context.correlation_id) {
        headers['X-Correlation-ID'] = context.correlation_id;
      }

      const response = await fetch(`${getD4Url()}${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ context, ...payload }),
        signal: controller.signal
      });

      clearTimeout(id);

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
           throw ServiceErrors.DOWNSTREAM_UNAUTHORIZED('GRAPH_SERVICE');
        } else if (response.status >= 500) {
           throw ServiceErrors.DOWNSTREAM_FAILURE('GRAPH_SERVICE');
        } else {
           throw ServiceErrors.GRAPH_SERVICE_UNAVAILABLE();
        }
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
        throw ServiceErrors.SERVICE_TIMEOUT('GRAPH_SERVICE');
      }
      throw handleServiceError(error);
    }
  }

  static async getFocusedGraph(context: AuthContext, entityId: string, hops: number = 2) {
    return await this.fetchD4('/graph/focused', context, { entityId, hops }, 10000, GraphResponseSchema);
  }

  static async getBridgeAnalysis(context: AuthContext) {
    return await this.fetchD4('/analytics/bridge', context, {}, 15000, BridgeAnalysisResponseSchema);
  }

  static async getTemporalAnalysis(context: AuthContext, timeRange: any) {
    return await this.fetchD4('/analytics/temporal', context, { timeRange }, 15000, TemporalAnalysisResponseSchema);
  }

  static async getRelationshipPath(context: AuthContext, sourceId: string, targetId: string) {
    return await this.fetchD4('/graph/path', context, { sourceId, targetId }, 10000, GraphResponseSchema);
  }
  static async getRelationship(context: AuthContext, relationshipId: string) {
    return await this.fetchD4(`/relationships/${relationshipId}`, context, {}, 10000);
  }
}
