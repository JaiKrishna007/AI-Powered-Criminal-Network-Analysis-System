import { NextResponse } from 'next/server';
import { pgPool } from '@/src/db';
import { Neo4jGraphService } from '@/lib/graph/neo4j';
import { LeadRankingEngine } from '@/lib/intelligence/leads/ranking';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const caseId = params.id;
  try {
    const neo4jService = new Neo4jGraphService();
    if (!neo4jService.isConnected()) {
      return NextResponse.json({
        error: 'GRAPH_DB_DISCONNECTED',
        message: 'Neo4j connection is required to generate leads.'
      }, { status: 503 });
    }

    // 1. Fetch live entities from Neo4j
    const entitiesList: any[] = [];
    const nodeRecords = await neo4jService.executeCypher(
      `MATCH (n) WHERE n.case_id = $caseId RETURN n;`,
      { caseId }
    );
    nodeRecords.forEach((record: any) => {
      const node = record.get('n');
      entitiesList.push({
        id: node.properties.id,
        type: node.labels[0].toUpperCase(),
        case_id: caseId,
        name: node.properties.canonical_name || node.properties.name || node.properties.id,
        classification: node.properties.classification || 'UNCLASSIFIED',
        created_at: node.properties.created_at || new Date().toISOString(),
        attributes: node.properties
      });
    });

    // 2. Fetch live evidence from PostgreSQL
    const evRes = await pgPool.query('SELECT * FROM evidence WHERE case_id = $1;', [caseId]);
    const evidenceList = evRes.rows.map((ev: any) => ({
      id: ev.id,
      case_id: ev.case_id,
      file_name: ev.file_name || ev.source_ref,
      mime_type: ev.mime_type || 'application/octet-stream',
      sha256_hash: ev.sha256,
      created_at: ev.created_at || new Date().toISOString(),
      content: ev.content || ''
    }));

    // 3. Score using LeadRankingEngine
    const leadRankingEngine = new LeadRankingEngine();
    const authScope = {
      user_id: 'USR-201',
      authorized_case_ids: [caseId],
      security_clearance: 'SECRET' as const
    };

    const scoringInputs = entitiesList.map((ent) => {
      // Find evidence referencing this entity
      const relatedEv = evidenceList.filter(
        (ev) => (ev.content && ev.content.toLowerCase().includes(ent.name.toLowerCase())) || ev.id === ent.id
      );
      return {
        case_id: caseId,
        target_entity: ent,
        related_evidence: relatedEv as any,
        related_relationships: [], // optional
        query_relevance: ent.type === 'PERSON' ? 0.9 : 0.6
      };
    });

    const rankedLeads = leadRankingEngine.rankTasks(scoringInputs, authScope);

    // 4. Map to UI Lead shape
    const uiLeads = rankedLeads.map((lead) => {
      const node = entitiesList.find((e) => e.id === lead.target_entity_id);
      return {
        id: lead.lead_id,
        case_id: lead.case_id,
        title: `Verify Suspect: ${node ? node.name : lead.target_entity_id}`,
        description: lead.advisory_notes,
        evidence_ids: [],
        created_at: lead.created_at,
        status: 'OPEN' as const,
        priority: lead.lead_score >= 2.5 ? 'HIGH' : lead.lead_score >= 1.5 ? 'MEDIUM' : 'LOW'
      };
    });

    return NextResponse.json(uiLeads);
  } catch (error: any) {
    return NextResponse.json({
      error: 'LEADS_GENERATION_FAILED',
      message: error.message
    }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  // Return standard success callback or record action in PostgreSQL
  return NextResponse.json({ success: true });
}
