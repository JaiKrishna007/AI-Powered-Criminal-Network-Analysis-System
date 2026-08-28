import { z } from 'zod';
import { ServiceErrors, handleServiceError } from '../errors/service_errors';
import { MLResponseSchema, AnomalyResponseSchema } from '../contracts';

const getMLUrl = () => process.env.ML_SERVICE_URL || 'http://localhost:8001';

import { signAuthContext } from '../utils/security';
import { AuthContext } from './ai_client';

export class MLClient {
  static async fetchML(endpoint: string, payload: any, timeoutMs: number = 10000, context?: Partial<AuthContext>) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const authData = context ? {
        user_id: context.user_id || 'SYSTEM_INTERNAL',
        role: context.role || 'INVESTIGATOR',
        case_id: context.case_id || 'GLOBAL',
        access_level: context.access_level || 'ADMIN',
        correlation_id: context.correlation_id || payload?.correlation_id
      } : {
        service: 'D2_CONTROL_PLANE',
        timestamp: new Date().toISOString(),
        correlation_id: payload?.correlation_id
      };

      const { contextHeader, signatureHeader } = signAuthContext(authData);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Authorization-Context': contextHeader,
        'X-Authorization-Signature': signatureHeader
      };

      if (payload?.correlation_id) {
        headers['X-Correlation-ID'] = payload.correlation_id;
      }

      const response = await fetch(`${getMLUrl()}${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(id);

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw ServiceErrors.DOWNSTREAM_UNAUTHORIZED('ML_SERVICE');
        } else if (response.status >= 500) {
          throw ServiceErrors.DOWNSTREAM_FAILURE('ML_SERVICE');
        } else {
          throw ServiceErrors.ML_SERVICE_UNAVAILABLE();
        }
      }

      const data = await response.json();
      return data;
    } catch (error: any) {
      clearTimeout(id);
      if (error.name === 'AbortError') {
        throw ServiceErrors.ML_SERVICE_TIMEOUT();
      }
      throw handleServiceError(error);
    }
  }

  static async predictEntityMatch(candidatePair: any, context?: Partial<AuthContext>) {
    const data = await this.fetchML('/predict/entity-match', candidatePair, 10000, context);
    const parsed = MLResponseSchema.safeParse(data);
    if (!parsed.success) {
      throw ServiceErrors.INVALID_SERVICE_RESPONSE(parsed.error);
    }
    return parsed.data;
  }

  static async predictAnomaly(activitySeries: any, context?: Partial<AuthContext>) {
    const data = await this.fetchML('/predict/anomaly', activitySeries, 10000, context);
    const parsed = AnomalyResponseSchema.safeParse(data);
    if (!parsed.success) {
      throw ServiceErrors.INVALID_SERVICE_RESPONSE(parsed.error);
    }
    return parsed.data;
  }
}
