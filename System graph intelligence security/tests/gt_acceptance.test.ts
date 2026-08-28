import { describe, it, expect, beforeEach } from "vitest";
import {
  AuthContext,
  ENTITY_v1,
  REL_v1,
  CASE_v1,
  EVIDENCE_v1,
  CONTRACT_VERSION,
} from "../lib/contracts/types.js";
import { GraphStore } from "../lib/graph/store.js";
import { FocusedSubgraphExtractor } from "../lib/graph/focused_subgraph.js";
import { TemporalEngine } from "../lib/graph/temporal.js";
import { BridgeDetector } from "../lib/graph/analytics/bridge.js";
import { EvidenceVerifier } from "../lib/integrity/evidence_verifier.js";
import { AuditLogger } from "../lib/audit/audit_logger.js";
import { ReportGenerator } from "../lib/reports/report_generator.js";

describe("Developer 4 — Acceptance Tests (GT-T01 through GT-T09)", () => {
  let store: GraphStore;
  let auditLogger: AuditLogger;
  const auth: AuthContext = {
    actor_id: "agent_tester",
    correlation_id: "corr_test_100",
    allowed_case_ids: ["CASE-001"],
    role: "admin",
  };

  beforeEach(() => {
    auditLogger = new AuditLogger();
    store = new GraphStore(auditLogger, undefined, true); // Force InMemory for testing
  });

  /**
   * GT-T01: Two clusters + connector D-X-E.
   * Expected: X identified as POTENTIAL_BRIDGE candidate.
   * Internal path nodes B, C, F, G are NOT labeled as bridges.
   */
  it("GT-T01: Two clusters + connector D-X-E uniquely identifies X as POTENTIAL_BRIDGE", async () => {
    // Cluster A: A-B, B-C, C-D
    const nodesA: ENTITY_v1[] = [
      { id: "A", type: "Person", case_id: "CASE-001" },
      { id: "B", type: "Phone", case_id: "CASE-001" },
      { id: "C", type: "Location", case_id: "CASE-001" },
      { id: "D", type: "Organization", case_id: "CASE-001" },
    ];
    // Cluster B: E-F, F-G, G-H
    const nodesB: ENTITY_v1[] = [
      { id: "E", type: "Person", case_id: "CASE-001" },
      { id: "F", type: "Phone", case_id: "CASE-001" },
      { id: "G", type: "Location", case_id: "CASE-001" },
      { id: "H", type: "Organization", case_id: "CASE-001" },
    ];
    // Bridge X
    const nodeX: ENTITY_v1 = { id: "X", type: "Person", case_id: "CASE-001" };

    for (const n of [...nodesA, ...nodesB, nodeX]) {
      await store.addEntity(n, auth);
    }

    const edges: REL_v1[] = [
      // Cluster A edges
      { id: "r_ab", source: "A", target: "B", type: "CALLED", case_id: "CASE-001", evidence_ids: ["ev1"] },
      { id: "r_bc", source: "B", target: "C", type: "VISITED", case_id: "CASE-001", evidence_ids: ["ev1"] },
      { id: "r_cd", source: "C", target: "D", type: "LINKED_TO", case_id: "CASE-001", evidence_ids: ["ev1"] },
      // Cluster B edges
      { id: "r_ef", source: "E", target: "F", type: "CALLED", case_id: "CASE-001", evidence_ids: ["ev2"] },
      { id: "r_fg", source: "F", target: "G", type: "VISITED", case_id: "CASE-001", evidence_ids: ["ev2"] },
      { id: "r_gh", source: "G", target: "H", type: "LINKED_TO", case_id: "CASE-001", evidence_ids: ["ev2"] },
      // Bridge edges: D-X, X-E
      { id: "r_dx", source: "D", target: "X", type: "ASSOCIATED_WITH", case_id: "CASE-001", evidence_ids: ["ev3"] },
      { id: "r_xe", source: "X", target: "E", type: "ASSOCIATED_WITH", case_id: "CASE-001", evidence_ids: ["ev3"] },
    ];

    for (const e of edges) {
      await store.addRelationship(e, auth);
    }

    const bridgeDetector = new BridgeDetector();
    const allEntities = await store.getAllEntitiesForCase("CASE-001", auth);
    const allRels = await store.getAllRelationshipsForCase("CASE-001", auth);

    const result = bridgeDetector.detectBridges("CASE-001", allEntities, allRels);
    const insights = result.map(r => r.insight);

    expect(insights.length).toBe(1);
    expect(insights[0].target_entity_ids).toEqual(["X"]);
    expect(insights[0].type).toBe("POTENTIAL_BRIDGE");

    // Explicitly verify internal path nodes B, C, F, G are NOT false positives
    const detectedTargetIds = insights.flatMap((i) => i.target_entity_ids);
    expect(detectedTargetIds).not.toContain("B");
    expect(detectedTargetIds).not.toContain("C");
    expect(detectedTargetIds).not.toContain("F");
    expect(detectedTargetIds).not.toContain("G");
  });

  /**
   * GT-T02: Single dense cluster.
   * Expected: No false positive bridge candidate.
   */
  it("GT-T02: Single dense cluster does not produce false positive bridge", async () => {
    const denseNodes: ENTITY_v1[] = [
      { id: "P1", type: "Person", case_id: "CASE-001" },
      { id: "P2", type: "Person", case_id: "CASE-001" },
      { id: "P3", type: "Person", case_id: "CASE-001" },
      { id: "P4", type: "Person", case_id: "CASE-001" },
    ];

    for (const n of denseNodes) {
      await store.addEntity(n, auth);
    }

    // Fully connected clique
    const edges: REL_v1[] = [
      { id: "e12", source: "P1", target: "P2", type: "CALLED", case_id: "CASE-001", evidence_ids: ["ev1"] },
      { id: "e13", source: "P1", target: "P3", type: "CALLED", case_id: "CASE-001", evidence_ids: ["ev1"] },
      { id: "e14", source: "P1", target: "P4", type: "CALLED", case_id: "CASE-001", evidence_ids: ["ev1"] },
      { id: "e23", source: "P2", target: "P3", type: "CALLED", case_id: "CASE-001", evidence_ids: ["ev1"] },
      { id: "e24", source: "P2", target: "P4", type: "CALLED", case_id: "CASE-001", evidence_ids: ["ev1"] },
      { id: "e34", source: "P3", target: "P4", type: "CALLED", case_id: "CASE-001", evidence_ids: ["ev1"] },
    ];

    for (const e of edges) {
      await store.addRelationship(e, auth);
    }

    const bridgeDetector = new BridgeDetector();
    const result = bridgeDetector.detectBridges(
      "CASE-001",
      await store.getAllEntitiesForCase("CASE-001", auth),
      await store.getAllRelationshipsForCase("CASE-001", auth)
    );
    const insights = result.map(r => r.insight);

    expect(insights.length).toBe(0);
  });

  /**
   * GT-T03: Edge added after T1.
   * Expected: Diff detects edge as ADDED.
   */
  it("GT-T03: Temporal diff correctly identifies ADDED edge between T1 and T2", async () => {
    await store.addEntity({ id: "N1", type: "Person", case_id: "CASE-001" }, auth);
    await store.addEntity({ id: "N2", type: "Phone", case_id: "CASE-001" }, auth);

    // Edge active starting T2
    await store.addRelationship(
      {
        id: "rel_added",
        source: "N1",
        target: "N2",
        type: "CALLED",
        case_id: "CASE-001",
        evidence_ids: ["ev1"],
        event_time: "2026-08-02T10:00:00Z",
      },
      auth
    );

    const temporalEngine = new TemporalEngine(store);
    const diff = await temporalEngine.compareSnapshots(
      "CASE-001",
      "2026-08-01T00:00:00Z",
      "2026-08-03T00:00:00Z",
      auth
    );

    expect(diff.added.length).toBe(1);
    expect(diff.added[0].id).toBe("rel_added");
  });

  /**
   * GT-T04: Edge removed before T2.
   * Expected: Absent from T2 snapshot / marked as REMOVED.
   */
  it("GT-T04: Temporal diff correctly identifies REMOVED edge between T1 and T2", async () => {
    await store.addEntity({ id: "N1", type: "Person", case_id: "CASE-001" }, auth);
    await store.addEntity({ id: "N2", type: "Phone", case_id: "CASE-001" }, auth);

    // Relationship effective only up to T1
    await store.addRelationship(
      {
        id: "rel_removed",
        source: "N1",
        target: "N2",
        type: "USED",
        case_id: "CASE-001",
        evidence_ids: ["ev1"],
        effective_start: "2026-08-01T00:00:00Z",
        effective_end: "2026-08-01T12:00:00Z",
      },
      auth
    );

    const temporalEngine = new TemporalEngine(store);
    const snapT2 = await temporalEngine.getSnapshotAt("CASE-001", "2026-08-02T00:00:00Z", auth);
    expect(snapT2.edges.find((e) => e.id === "rel_removed")).toBeUndefined();

    const diff = await temporalEngine.compareSnapshots(
      "CASE-001",
      "2026-08-01T06:00:00Z",
      "2026-08-02T00:00:00Z",
      auth
    );
    expect(diff.removed.length).toBe(1);
    expect(diff.removed[0].id).toBe("rel_removed");
  });

  /**
   * GT-T05: Large neighborhood extraction truncation.
   * Expected: meta.truncated === true.
   */
  it("GT-T05: Bounded focused subgraph sets meta.truncated === true when node bounds exceeded", async () => {
    // Add 15 entities and a chain of relationships
    for (let i = 1; i <= 15; i++) {
      await store.addEntity({ id: `Node_${i}`, type: "Person", case_id: "CASE-001" }, auth);
    }
    for (let i = 1; i < 15; i++) {
      await store.addRelationship(
        {
          id: `Edge_${i}`,
          source: `Node_${i}`,
          target: `Node_${i + 1}`,
          type: "LINKED_TO",
          case_id: "CASE-001",
          evidence_ids: ["ev1"],
        },
        auth
      );
    }

    const extractor = new FocusedSubgraphExtractor(store as any);
    const result = await extractor.extractFocusedSubgraph(
      {
        case_id: "CASE-001",
        seed_ids: ["Node_1"],
        max_hops: 10,
        max_nodes: 5, // Restrict to max 5 nodes
      },
      auth
    );

    expect(result.nodes.length).toBe(5);
    expect(result.meta.truncated).toBe(true);
    expect(result.meta.node_count).toBe(5);
  });

  /**
   * GT-T06: Unchanged evidence artifact verification.
   * Expected: VERIFIED and AUDIT event emitted.
   */
  it("GT-T06: Unchanged evidence artifact returns VERIFIED and logs AUDIT event", async () => {
    const verifier = new EvidenceVerifier(auditLogger);
    const content = "Confidential evidence raw binary data payload";
    const computedHash = verifier.computeSha256(content);

    const evidence: EVIDENCE_v1 = {
      id: "EV-101",
      case_id: "CASE-001",
      file_name: "intercept.dat",
      mime_type: "application/octet-stream",
      sha256_hash: computedHash,
      created_at: new Date().toISOString(),
    };

    const res = await verifier.verifyEvidence(evidence, content, auth);
    expect(res.status).toBe("VERIFIED");

    const auditLogs = await auditLogger.getLogs();
    const evAudit = auditLogs.find((l) => l.resource_id === "EV-101");
    expect(evAudit).toBeDefined();
    expect(evAudit?.outcome).toBe("SUCCESS");
    expect(evAudit?.resource_type).toBe("EVIDENCE");
  });

  /**
   * GT-T07: Modified evidence artifact verification.
   * Expected: MISMATCH and AUDIT event emitted.
   */
  it("GT-T07: Modified evidence artifact returns MISMATCH and logs AUDIT event", async () => {
    const verifier = new EvidenceVerifier(auditLogger);
    const originalContent = "Original evidence file data";
    const originalHash = verifier.computeSha256(originalContent);

    const evidence: EVIDENCE_v1 = {
      id: "EV-102",
      case_id: "CASE-001",
      file_name: "call_log.csv",
      mime_type: "text/csv",
      sha256_hash: originalHash,
      created_at: new Date().toISOString(),
    };

    const tamperedContent = "Original evidence file data [TAMPERED]";
    const res = await verifier.verifyEvidence(evidence, tamperedContent, auth);
    expect(res.status).toBe("MISMATCH");

    const auditLogs = await auditLogger.getLogs();
    const evAudit = auditLogs.find((l) => l.resource_id === "EV-102");
    expect(evAudit).toBeDefined();
    expect(evAudit?.outcome).toBe("ERROR");
  });

  /**
   * GT-T08: Critical action audit logging.
   * Expected: Valid append-only AUDIT.v1 event with exact fields.
   */
  it("GT-T08: Critical action logs append-only AUDIT.v1 entry with exact schema fields", async () => {
    const entry = await auditLogger.log(
      "officer_32",
      "DELETE_GRAPH_NODE",
      "GRAPH",
      "Node_99",
      "SUCCESS",
      "corr_888",
      { reason: "Court order deletion" }
    );

    expect(entry.event_id).toBeDefined();
    expect(entry.actor_id).toBe("officer_32");
    expect(entry.action).toBe("DELETE_GRAPH_NODE");
    expect(entry.resource_type).toBe("GRAPH");
    expect(entry.resource_id).toBe("Node_99");
    expect(entry.outcome).toBe("SUCCESS");
    expect(entry.correlation_id).toBe("corr_888");
    expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO-8601 UTC
  });

  /**
   * GT-T09: Complete case report generation.
   * Expected: REPORT.v1 containing all 11 required sections and evidence references.
   */
  it("GT-T09: Complete case report contains all 11 required sections and evidence references", async () => {
    await store.addEntity({ id: "P_10", type: "Person", case_id: "CASE-001" }, auth);
    await store.addEntity({ id: "P_20", type: "Phone", case_id: "CASE-001" }, auth);

    await store.addRelationship(
      {
        id: "R_100",
        source: "P_10",
        target: "P_20",
        type: "USED",
        case_id: "CASE-001",
        evidence_ids: ["EV-01"],
        event_time: "2026-08-10T12:00:00Z",
      },
      auth
    );

    const caseSummary: CASE_v1 = {
      id: "CASE-001",
      name: "Operation CyberShield",
      description: "Financial fraud investigation",
      created_at: "2026-08-01T00:00:00Z",
    };

    const dataSources: EVIDENCE_v1[] = [
      {
        id: "EV-01",
        case_id: "CASE-001",
        file_name: "phone_dump.json",
        mime_type: "application/json",
        sha256_hash: "abcd1234efgh5678",
        created_at: "2026-08-01T10:00:00Z",
      },
    ];

    const generator = new ReportGenerator(store, auditLogger);
    const report = await generator.generateReport({ case_summary: caseSummary, data_sources: dataSources }, auth);

    expect(report.contract_version).toBe(CONTRACT_VERSION);
    expect(report.section_1_case_summary).toBeDefined();
    expect(report.section_2_data_sources.length).toBe(1);
    expect(report.section_3_key_entities.length).toBe(2);
    expect(report.section_4_relationships.length).toBe(1);
    expect(report.section_5_temporal_findings).toBeDefined();
    expect(report.section_6_bridge_findings).toBeDefined();
    expect(report.section_7_explainable_findings).toBeDefined();
    expect(report.section_8_evidence_references.length).toBe(1);
    expect(report.section_8_evidence_references[0].evidence_id).toBe("EV-01");
    expect(report.section_9_leads).toBeDefined();
    expect(report.section_10_limitations).toBeDefined();
    expect(report.section_11_version_audit.audit_events.length).toBeGreaterThan(0);
  });
});
