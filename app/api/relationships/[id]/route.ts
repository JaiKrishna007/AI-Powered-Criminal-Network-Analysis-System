import { NextResponse } from 'next/server';
import { mockDB } from '@/lib/client-contracts/mockData';
import { handleProxyOrFallback } from '@/lib/client-contracts/proxyHelper';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const relId = params.id;
  return handleProxyOrFallback(request, `/api/relationships/${relId}`, async () => {
    const rel = mockDB.relationships.find((r) => r.id === relId);
    
    if (!rel) {
      return NextResponse.json({ error: 'Relationship not found' }, { status: 404 });
    }
    
    // Find evidence linked to this relationship
    const evidenceList = mockDB.evidence.filter((ev) => rel.evidence_ids.includes(ev.id));
    
    return NextResponse.json({
      relationship: rel,
      evidence: evidenceList
    });
  });
}
