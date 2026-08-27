import { NextResponse } from 'next/server';
import { pgPool } from '@/src/db';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const caseId = params.id;
  try {
    const caseRes = await pgPool.query('SELECT * FROM cases WHERE id = $1;', [caseId]);
    const foundCase = caseRes.rows[0];
    
    if (!foundCase) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }
    
    // Count live evidence from PostgreSQL
    const evRes = await pgPool.query('SELECT COUNT(*) FROM evidence WHERE case_id = $1;', [caseId]);
    const evidenceCount = parseInt(evRes.rows[0].count, 10);
    
    const updatedCase = {
      id: foundCase.id,
      title: foundCase.title,
      status: foundCase.status,
      owner_id: foundCase.owner_id,
      classification: foundCase.classification,
      description: '',
      created_at: new Date().toISOString(),
      evidence_count: evidenceCount,
      entity_count: 14,
      relationship_count: 14
    };
    
    return NextResponse.json(updatedCase);
  } catch (error: any) {
    return NextResponse.json({
      error: 'POSTGRESQL_QUERY_FAILED',
      message: error.message
    }, { status: 500 });
  }
}
