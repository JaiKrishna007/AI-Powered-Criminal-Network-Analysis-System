/**
 * ML Service Client for Developer 4 — GRAPH / TRUST Module
 * Integrates Repo A (Graph/Trust) with Repo B (ML Subsystem)
 */

export interface EntityMatchRequest {
  record_a_id: string;
  record_b_id: string;
  name_sim: number;
  address_sim: number;
  org_sim: number;
  phone_match: boolean;
  vehicle_match: boolean;
}

export interface EntityMatchResponse {
  model: string;
  model_version: string;
  entity_ids: [string, string];
  score: number;
  status: "HIGH_CONFIDENCE_MATCH" | "REVIEW" | "LOW_CONFIDENCE_NON_MATCH" | string;
  signals: {
    name_similarity: number;
    address_similarity: number;
    phone_match: boolean;
    vehicle_match: boolean;
  };
}

export interface AnomalyRequest {
  entity_id: string;
  calls: number;
  transactions: number;
  amount: number;
}

export interface AnomalyResponse {
  model: string;
  model_version: string;
  entity_id: string;
  score: number;
  status: "POTENTIAL_ANOMALY" | "NORMAL_BEHAVIOR" | string;
  signals: {
    communication_spike: boolean;
    transaction_spike: boolean;
    location_change: boolean;
  };
}

export class MLClient {
  private baseUrl: string;

  constructor(baseUrl: string = process.env.ML_SERVICE_URL || "http://localhost:8000") {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  /**
   * Calls POST /predict/entity-match on Repo B's ML Service
   */
  async predictEntityMatch(req: EntityMatchRequest): Promise<EntityMatchResponse> {
    const url = `${this.baseUrl}/predict/entity-match`;
    try {
      return await this.postJson<EntityMatchRequest, EntityMatchResponse>(url, req);
    } catch (error) {
      return {
        model: "UNKNOWN",
        model_version: "UNKNOWN",
        entity_ids: [req.record_a_id, req.record_b_id],
        score: 0,
        status: "MODEL_UNAVAILABLE",
        signals: {
          name_similarity: req.name_sim,
          address_similarity: req.address_sim,
          phone_match: req.phone_match,
          vehicle_match: req.vehicle_match,
        },
      };
    }
  }

  /**
   * Calls POST /predict/anomaly on Repo B's ML Service
   */
  async predictAnomaly(req: AnomalyRequest): Promise<AnomalyResponse> {
    const url = `${this.baseUrl}/predict/anomaly`;
    try {
      return await this.postJson<AnomalyRequest, AnomalyResponse>(url, req);
    } catch (error) {
      return {
        model: "UNKNOWN",
        model_version: "UNKNOWN",
        entity_id: req.entity_id,
        score: 0,
        status: "MODEL_UNAVAILABLE",
        signals: {
          communication_spike: false,
          transaction_spike: false,
          location_change: false,
        },
      };
    }
  }

  private async postJson<TIn, TOut>(url: string, payload: TIn): Promise<TOut> {
    if (typeof globalThis.fetch === "function") {
      const res = await globalThis.fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        throw new Error(`ML Service request to ${url} failed with HTTP ${res.status}`);
      }
      return (await res.json()) as TOut;
    } else {
      // Fallback using Node.js http/https
      const http = await import("http");
      const https = await import("https");
      const parsedUrl = new URL(url);
      const transport = parsedUrl.protocol === "https:" ? https : http;
      const dataString = JSON.stringify(payload);

      return new Promise((resolve, reject) => {
        const req = transport.request(
          url,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Content-Length": Buffer.byteLength(dataString)
            }
          },
          (res) => {
            let body = "";
            res.on("data", (chunk) => (body += chunk));
            res.on("end", () => {
              if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                try {
                  resolve(JSON.parse(body) as TOut);
                } catch (e) {
                  reject(new Error(`Failed to parse ML response JSON from ${url}: ${e}`));
                }
              } else {
                reject(new Error(`ML Service request to ${url} returned HTTP ${res.statusCode}: ${body}`));
              }
            });
          }
        );
        req.on("error", (err) => reject(err));
        req.write(dataString);
        req.end();
      });
    }
  }
}
