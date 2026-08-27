import { NextResponse } from 'next/server';
import { pgPool } from '@/src/db';

export async function GET() {
  try {
    const res = await pgPool.query('SELECT * FROM cases;');
    
    // Map database cases to the shape expected by the frontend UI
    const cases = res.rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      owner_id: row.owner_id,
      classification: row.classification,
      description: '',
      created_at: new Date().toISOString(),
      evidence_count: 0,
      entity_count: 14,
      relationship_count: 14
    }));

    return NextResponse.json(cases);
  } catch (error: any) {
    return NextResponse.json({
      error: 'POSTGRESQL_QUERY_FAILED',
      message: error.message
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const id = `CASE-${Math.floor(1000 + Math.random() * 9000)}`;
    const title = body.title || 'Untitled Case';
    const classification = body.classification || 'UNCLASSIFIED';
    const ownerId = 'USR-201'; // Default logged-in investigator ID

    // Ensure the owner user exists in the database
    await pgPool.query(
      `INSERT INTO users (id, display_name, status) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (id) DO NOTHING;`,
      [ownerId, 'Investigator Officer', 'ACTIVE']
    );

    const query = 'INSERT INTO cases (id, title, status, owner_id, classification) VALUES ($1, $2, $3, $4, $5) RETURNING *;';
    const res = await pgPool.query(query, [
      id,
      title,
      'ACTIVE',
      ownerId,
      classification
    ]);

    const createdCase = res.rows[0];
    return NextResponse.json({
      id: createdCase.id,
      title: createdCase.title,
      status: createdCase.status,
      owner_id: createdCase.owner_id,
      classification: createdCase.classification,
      description: '',
      created_at: new Date().toISOString(),
      evidence_count: 0,
      entity_count: 0,
      relationship_count: 0
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({
      error: 'POSTGRESQL_INSERTION_FAILED',
      message: error.message
    }, { status: 500 });
  }
}
