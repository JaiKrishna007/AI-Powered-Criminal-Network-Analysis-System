import { NextResponse } from 'next/server';
import { FocusedSubgraphExtractor } from '@/lib/graph/focused_subgraph';
import { GraphStore } from '@/lib/graph/store';
import { Neo4jGraphService } from '@/lib/graph/neo4j';
import { AuditLogger } from '@/lib/audit/audit_logger';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const caseId = params.id;
  const { searchParams } = new URL(request.url);
  const seed = searchParams.get('seed');
  const hops = parseInt(searchParams.get('hops') || '2', 10);
  const goalMode = searchParams.get('goal');
  const validFrom = searchParams.get('validFrom');
  const validTo = searchParams.get('validTo');

  const auditLogger = new AuditLogger();
  const neo4jService = new Neo4jGraphService();
  const store = new GraphStore(auditLogger, neo4jService);

  // Relaxed strict connection check to allow mock data fallback
  if (!neo4jService.isConnected()) {
    return NextResponse.json({
      error: 'GRAPH_DB_DISCONNECTED',
      message: 'Neo4j connection is required for graph features.'
    }, { status: 503 });
  }

  try {
    // 1. Fetch case nodes from live Neo4j database
    const nodeRecords = await neo4jService.executeCypher(
      `MATCH (n) WHERE n.case_id = $caseId RETURN n;`,
      { caseId }
    );
    nodeRecords.forEach((record: any) => {
      const node = record.get('n');
      store.addEntity({
        id: node.properties.id,
        type: node.labels[0] as any,
        case_id: caseId,
        properties: node.properties
      });
    });

    // 2. Fetch case relationships from live Neo4j database
    const relRecords = await neo4jService.executeCypher(
      `MATCH (s)-[r]->(t) WHERE r.case_id = $caseId RETURN r;`,
      { caseId }
    );
    relRecords.forEach((record: any) => {
      const rel = record.get('r');
      store.addRelationship({
        id: rel.properties.id,
        source: rel.properties.source || rel.startNodeElementId || rel.start || '',
        target: rel.properties.target || rel.endNodeElementId || rel.end || '',
        type: rel.type,
        case_id: caseId,
        evidence_ids: rel.properties.evidence_ids || [],
        event_time: rel.properties.event_time || rel.properties.timestamp,
        effective_start: rel.properties.effective_start,
        effective_end: rel.properties.effective_end,
        properties: rel.properties
      });
    });

    // 3. Extract subgraph deterministically
    const extractor = new FocusedSubgraphExtractor(store);
    const subgraph = extractor.extractFocusedSubgraph({
      case_id: caseId,
      seed_ids: seed ? seed.split(',') : [],
      max_hops: hops,
      time_start: validFrom || undefined,
      time_end: validTo || undefined,
      rel_types: undefined,
      max_nodes: 50
    });


    return NextResponse.json(subgraph);
  } catch (error: any) {
    return NextResponse.json({
      error: 'GRAPH_EXTRACTION_FAILED',
      message: error.message
    }, { status: 500 });
  }
}
