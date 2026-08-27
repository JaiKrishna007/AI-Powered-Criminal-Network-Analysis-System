import { NextResponse } from 'next/server';
import { mockDB } from '@/lib/client-contracts/mockData';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const caseId = params.id;
  const foundCase = mockDB.cases.find((c) => c.id === caseId);
  
  if (!foundCase) {
    return NextResponse.json({ error: 'Case not found' }, { status: 404 });
  }
  
  // Calculate dynamic stats
  const caseEvidence = mockDB.evidence.filter((e) => e.case_id === caseId);
  
  const updatedCase = {
    ...foundCase,
    evidence_count: caseEvidence.length,
    entity_count: mockDB.entities.length, // simple counts for mock
    relationship_count: mockDB.relationships.length
  };
  
  return NextResponse.json(updatedCase);
}
