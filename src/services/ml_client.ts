import { z } from 'zod';
import { ServiceErrors, handleServiceError } from '../errors/service_errors';
import { MLResponseSchema, AnomalyResponseSchema } from '../contracts';

const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:3005';

export class MLClient {
  static async fetchML(endpoint: string, payload: any, timeoutMs: number = 10000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (payload?.correlation_id) {
        headers['X-Correlation-ID'] = payload.correlation_id;
      }

      const response = await fetch(`${ML_URL}${endpoint}`, {
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

  static async predictEntityMatch(candidatePair: any) {
    const data = await this.fetchML('/predict/entity-match', candidatePair, 10000);
    const parsed = MLResponseSchema.safeParse(data);
    if (!parsed.success) {
      throw ServiceErrors.INVALID_SERVICE_RESPONSE(parsed.error);
    }
    return parsed.data;
  }

  static async predictAnomaly(activitySeries: any) {
    const data = await this.fetchML('/predict/anomaly', activitySeries, 10000);
    const parsed = AnomalyResponseSchema.safeParse(data);
    if (!parsed.success) {
      throw ServiceErrors.INVALID_SERVICE_RESPONSE(parsed.error);
    }
    return parsed.data;
  }
}
