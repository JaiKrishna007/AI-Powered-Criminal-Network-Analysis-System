import { describe, it, expect, beforeEach } from "vitest";
import {
  CONTRACT_VERSION,
  NodeType,
  RelationshipType,
  ENTITY_v1,
  REL_v1,
  GRAPH_v1,
  AuthContext,
} from "../lib/contracts/types.js";
import { GraphStore } from "../lib/graph/store.js";
import { AuditLogger } from "../lib/audit/audit_logger.js";

describe("PS26189-CONTRACT-v1 Contract Definitions", () => {
  it("should have correct canonical contract version string", () => {
    expect(CONTRACT_VERSION).toBe("PS26189-CONTRACT-v1");
  });

  it("should allow valid node entity types", () => {
    const validNodeTypes: NodeType[] = [
      "Person",
      "Phone",
      "IMEI",
      "BankAccount",
      "Vehicle",
      "Location",
      "Organization",
      "FIR",
      "Case",
      "Event",
    ];
    expect(validNodeTypes.length).toBe(10);
  });

  it("should allow valid relationship types", () => {
    const validRelTypes: RelationshipType[] = [
      "CALLED",
      "TRANSFERRED_MONEY",
      "USED",
      "OWNED",
      "VISITED",
      "MET_AT",
      "TRAVELED_WITH",
      "LINKED_TO",
      "ASSOCIATED_WITH",
      "PART_OF_CASE",
    ];
    expect(validRelTypes.length).toBe(10);
  });
});

describe("GraphStore Operations and Security", () => {
  let store: GraphStore;
  let auditLogger: AuditLogger;
  const auth: AuthContext = {
    user_id: "inv_007",
    case_id: "CASE-001",
    access_level: "WRITE",
    actor_id: "investigator_007",
    correlation_id: "corr_999",
    allowed_case_ids: ["CASE-001"],
    role: "admin",
  };

  beforeEach(() => {
    auditLogger = new AuditLogger();
    store = new GraphStore(auditLogger, undefined, true); // force InMemory for tests
  });

  it("should add entities and relationships under valid auth", async () => {
    const p1: ENTITY_v1 = { id: "p1", type: "Person", case_id: "CASE-001" };
    const p2: ENTITY_v1 = { id: "p2", type: "Phone", case_id: "CASE-001" };

    await store.addEntity(p1, auth);
    await store.addEntity(p2, auth);

    const rel: REL_v1 = {
      id: "r1",
      source: "p1",
      target: "p2",
      type: "USED",
      case_id: "CASE-001",
      evidence_ids: ["EV-100"],
    };
    await store.addRelationship(rel, auth);

    const graph: GRAPH_v1 = await store.getGraphForCase("CASE-001", auth);
    expect(graph.nodes.length).toBe(2);
    expect(graph.edges.length).toBe(1);
    expect(graph.meta.truncated).toBe(false);
    expect(graph.meta.node_count).toBe(2);
    expect(graph.meta.edge_count).toBe(1);
  });

  it("should deny access to unauthorized case_id and emit AUDIT.v1 event with DENIED outcome", async () => {
    const unauthorizedAuth: AuthContext = {
      user_id: "guest_user",
      case_id: "CASE-002",
      access_level: "READ",
      actor_id: "guest",
      correlation_id: "corr_000",
      allowed_case_ids: ["CASE-002"],
      role: "admin",
    };

    await expect(store.getGraphForCase("CASE-001", unauthorizedAuth)).rejects.toThrow();

    const auditLogs = await auditLogger.getLogs();
    const deniedLog = auditLogs.find((l) => l.outcome === "DENIED");
    expect(deniedLog).toBeDefined();
    expect(deniedLog?.actor_id).toBe("guest");
    expect(deniedLog?.resource_type).toBe("GRAPH");
    expect(deniedLog?.outcome).toBe("DENIED");
  });
});
