import { z } from 'zod';
import { ServiceErrors, handleServiceError } from '../errors/service_errors';

const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:3005';

const MLResponseSchema = z.object({
  probability: z.number(),
  signals: z.record(z.string(), z.number()).optional()
});

export class MLClient {
  static async fetchML(endpoint: string, payload: any, timeoutMs: number = 10000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${ML_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(id);

      if (!response.ok) {
        throw ServiceErrors.ML_SERVICE_UNAVAILABLE();
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
    return data;
  }
}
