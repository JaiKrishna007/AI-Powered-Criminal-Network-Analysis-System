import { NextResponse } from 'next/server';
import { pgPool } from '@/src/db';
import { Neo4jGraphService } from '@/lib/graph/neo4j';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const relId = params.id;
  try {
    const neo4jService = new Neo4jGraphService();
    if (!neo4jService.isConnected()) {
      return NextResponse.json({ error: 'Graph Database Disconnected' }, { status: 503 });
    }

    // Query relationship from Neo4j
    const records = await neo4jService.executeCypher(
      `MATCH (s)-[r]->(t) WHERE r.id = $relId RETURN r;`,
      { relId }
    );
    
    if (records.length === 0) {
      return NextResponse.json({ error: 'Relationship not found' }, { status: 404 });
    }

    const rel = records[0].get('r');
    const mappedRel = {
      id: rel.properties.id,
      source: rel.properties.source || '',
      target: rel.properties.target || '',
      type: rel.type,
      case_id: rel.properties.case_id,
      evidence_ids: rel.properties.evidence_ids || [],
      timestamp: rel.properties.event_time || rel.properties.timestamp,
      amount: rel.properties.amount ? parseFloat(rel.properties.amount) : undefined,
      confidence: rel.properties.confidence ? parseFloat(rel.properties.confidence) : 1.0
    };

    // Query evidence logs from PostgreSQL database
    let evidenceList: any[] = [];
    if (mappedRel.evidence_ids.length > 0) {
      const evRes = await pgPool.query(
        'SELECT * FROM evidence WHERE id = ANY($1::text[]);',
        [mappedRel.evidence_ids]
      );
      evidenceList = evRes.rows.map((ev: any) => ({
        id: ev.id,
        case_id: ev.case_id,
        source_type: ev.source_type,
        source_ref: ev.source_ref,
        sha256: ev.sha256,
        content: ev.content || ''
      }));
    }

    return NextResponse.json({
      relationship: mappedRel,
      evidence: evidenceList
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'RELATIONSHIP_QUERY_FAILED', message: error.message }, { status: 500 });
  }
}
