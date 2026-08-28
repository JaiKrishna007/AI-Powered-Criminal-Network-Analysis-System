import { describe, it, expect, beforeEach } from "vitest";
import { MLClient } from "../lib/ml/ml_client.js";
import { INSIGHT_v1 } from "../lib/contracts/types.js";

describe("Graph/Trust → ML Integration (ml_client.ts)", () => {
  let mlClient: MLClient;

  beforeEach(() => {
    mlClient = new MLClient("http://localhost:8000");
  });

  it("Graph/Trust → ML → Entity Match Response (/predict/entity-match)", async () => {
    const req = {
      record_a_id: "A102",
      record_b_id: "B784",
      name_sim: 0.95,
      address_sim: 0.88,
      org_sim: 0.90,
      phone_match: true,
      vehicle_match: true,
    };

    const res = await mlClient.predictEntityMatch(req);

    expect(res).toBeDefined();
    expect(res.model).toBe("entity_resolution");
    expect(res.entity_ids).toEqual(["A102", "B784"]);
    expect(res.score).toBeGreaterThan(0.5);
    expect(res.status).toBe("HIGH_CONFIDENCE_MATCH");
    expect(res.signals.name_similarity).toBe(0.95);
  });

  it("Graph/Trust → ML → Anomaly Response (/predict/anomaly)", async () => {
    const req = {
      entity_id: "P102",
      calls: 143,
      transactions: 12,
      amount: 1200000.0,
    };

    const res = await mlClient.predictAnomaly(req);

    expect(res).toBeDefined();
    expect(res.model).toBe("anomaly_detection");
    expect(res.entity_id).toBe("P102");
    expect(res.score).toBeGreaterThan(0.8);
    expect(res.status).toBe("POTENTIAL_ANOMALY");
    expect(res.signals.communication_spike).toBe(true);
    expect(res.signals.transaction_spike).toBe(true);
  });

  it("Graph/Trust → Combine ML Prediction + Graph Signals → INSIGHT.v1", async () => {
    // 1. Get ML Prediction
    const anomalyRes = await mlClient.predictAnomaly({
      entity_id: "X_BRIDGE",
      calls: 150,
      transactions: 10,
      amount: 2000000.0,
    });

    // 2. Combine with Graph Bridge signal to build INSIGHT.v1
    const insight: INSIGHT_v1 = {
      id: "INS_FUSED_1001",
      case_id: "CASE-001",
      type: "POTENTIAL_BRIDGE",
      title: "High Risk Bridge Entity Flagged by ML & Graph Engine",
      description: `Entity ${anomalyRes.entity_id} acts as a bridge between suspect sub-networks with an anomaly score of ${anomalyRes.score} (${anomalyRes.status}).`,
      target_entity_ids: [anomalyRes.entity_id],
      evidence_ids: ["EVID-101", "EVID-102"],
      timestamp: new Date().toISOString(),
    };

    expect(insight.id).toBe("INS_FUSED_1001");
    expect(insight.case_id).toBe("CASE-001");
    expect(insight.target_entity_ids).toContain("X_BRIDGE");
    expect(insight.description).toContain("POTENTIAL_ANOMALY");
  });
});
