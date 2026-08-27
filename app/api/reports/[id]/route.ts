import { NextResponse } from 'next/server';
import { pgPool } from '@/src/db';
import { Neo4jGraphService } from '@/lib/graph/neo4j';
import { GraphStore } from '@/lib/graph/store';
import { AuditLogger } from '@/lib/audit/audit_logger';
import { ReportGenerator } from '@/lib/reports/report_generator';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const caseId = params.id;
  try {
    // 1. Fetch case details from PostgreSQL
    const caseRes = await pgPool.query('SELECT * FROM cases WHERE id = $1;', [caseId]);
    const foundCase = caseRes.rows[0];
    if (!foundCase) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    const caseSummary = {
      id: foundCase.id,
      name: foundCase.title,
      description: foundCase.classification || 'UNCLASSIFIED',
      created_at: new Date().toISOString()
    };

    // 2. Fetch evidence list from PostgreSQL
    const evRes = await pgPool.query('SELECT * FROM evidence WHERE case_id = $1;', [caseId]);
    const dataSources = evRes.rows.map((ev: any) => ({
      id: ev.id,
      case_id: ev.case_id,
      file_name: ev.file_name || ev.source_ref,
      mime_type: ev.mime_type || 'application/octet-stream',
      sha256_hash: ev.sha256,
      created_at: ev.created_at || new Date().toISOString()
    }));

    // 3. Load nodes/edges from Neo4j into GraphStore
    const auditLogger = new AuditLogger();
    const neo4jService = new Neo4jGraphService();
    const store = new GraphStore(auditLogger, neo4jService);

    if (neo4jService.isConnected()) {
      try {
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
            properties: rel.properties
          });
        });
      } catch (err) {
        console.error('[Report Context Loader] Neo4j load failed:', err);
      }
    } else {
      return NextResponse.json({
        error: 'NEO4J_CONNECTION_FAILED',
        message: 'Neo4j connection required to compile investigative report.'
      }, { status: 502 });
    }

    // 4. Generate report
    const generator = new ReportGenerator(store, auditLogger);
    const authScope = {
      actor_id: 'USR-201',
      correlation_id: `REPORT-GEN-${Date.now()}`,
      allowed_case_ids: [caseId]
    };

    const report = generator.generateReport({
      case_summary: caseSummary,
      data_sources: dataSources,
      leads: []
    }, authScope);

    return NextResponse.json(report);
  } catch (error: any) {
    return NextResponse.json({ error: 'REPORT_GENERATION_FAILED', message: error.message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  return NextResponse.json({ success: true });
}
