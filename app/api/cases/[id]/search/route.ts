import { NextResponse } from 'next/server';
import { pgPool } from '@/src/db';
import { Neo4jGraphService } from '@/lib/graph/neo4j';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const caseId = params.id;
  try {
    const { query } = await request.json();
    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const lowerQuery = query.toLowerCase();
    const queryLike = `%${lowerQuery}%`;

    // 1. Fetch matching evidence from PostgreSQL
    const evRes = await pgPool.query(
      `SELECT * FROM evidence 
       WHERE case_id = $1 AND (
         id ILIKE $2 OR 
         source_type ILIKE $2 OR 
         source_ref ILIKE $2 OR 
         content ILIKE $2
       );`,
      [caseId, queryLike]
    );

    const matchedEvidence = evRes.rows.map((ev: any) => ({
      id: ev.id,
      case_id: ev.case_id,
      source_type: ev.source_type,
      source_ref: ev.source_ref,
      sha256: ev.sha256,
      content: ev.content || '',
      classification: ev.classification
    }));

    // 2. Fetch matching entities and relationships from Neo4j
    const matchedEntities: any[] = [];
    const matchedRelationships: any[] = [];

    const neo4jService = new Neo4jGraphService();
    if (neo4jService.isConnected()) {
      try {
        const nodeRecords = await neo4jService.executeCypher(
          `MATCH (n) 
           WHERE n.case_id = $caseId AND (
             toLower(n.id) CONTAINS $lowerQuery OR 
             toLower(n.name) CONTAINS $lowerQuery OR 
             toLower(n.canonical_name) CONTAINS $lowerQuery
           ) 
           RETURN n;`,
          { caseId, lowerQuery }
        );
        nodeRecords.forEach((record: any) => {
          const node = record.get('n');
          matchedEntities.push({
            id: node.properties.id,
            type: node.labels[0].toUpperCase(),
            case_id: caseId,
            canonical_name: node.properties.canonical_name || node.properties.name || node.properties.id,
            aliases: node.properties.aliases || []
          });
        });

        const relRecords = await neo4jService.executeCypher(
          `MATCH (s)-[r]->(t) 
           WHERE r.case_id = $caseId AND (
             toLower(r.id) CONTAINS $lowerQuery OR 
             toLower(r.type) CONTAINS $lowerQuery
           ) 
           RETURN r;`,
          { caseId, lowerQuery }
        );
        relRecords.forEach((record: any) => {
          const rel = record.get('r');
          matchedRelationships.push({
            id: rel.properties.id,
            source: rel.properties.source || rel.startNodeElementId || rel.start || '',
            target: rel.properties.target || rel.endNodeElementId || rel.end || '',
            type: rel.type,
            case_id: caseId,
            evidence_ids: rel.properties.evidence_ids || []
          });
        });
      } catch (err) {
        console.error('[Search API Router] Neo4j search failed:', err);
      }
    }

    return NextResponse.json({
      query,
      entities: matchedEntities,
      evidence: matchedEvidence,
      relationships: matchedRelationships
    });
  } catch (error: any) {
    return NextResponse.json({
      error: 'SEARCH_FAILED',
      message: error.message
    }, { status: 500 });
  }
}