import { GRAPH_v1 } from '../../../../shared-contracts';

const getD4Url = () => process.env.D4_SERVICE_URL || 'http://localhost:8003';

export class GraphContextClient {
  static async fetchD4(endpoint: string, rawContext: string, payload: any, authSignature: string, correlationId?: string) {
    const url = `${getD4Url()}${endpoint}`;

    // Forward the original EXACT raw headers to preserve HMAC validation in D4
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Authorization-Context': rawContext,
      'X-Authorization-Signature': authSignature
    };

    if (correlationId) {
      headers['X-Correlation-ID'] = correlationId;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`D4 Graph Error [${response.status}]: ${text}`);
      throw new Error(`D4 Graph Error: ${response.statusText}`);
    }

    return response.json();
  }

  static async getFocusedGraph(rawContext: string, signature: string, entityId: string, hops: number = 2, correlationId?: string): Promise<GRAPH_v1> {
    return this.fetchD4('/graph/focused', rawContext, { entityId, hops }, signature, correlationId);
  }

  static async getTemporalGraph(rawContext: string, signature: string, query: string, entityId?: string, correlationId?: string): Promise<any> {
    return this.fetchD4('/graph/temporal', rawContext, { query, entityId }, signature, correlationId);
  }
}
