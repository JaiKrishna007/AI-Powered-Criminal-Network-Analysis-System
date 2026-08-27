import { NextResponse } from 'next/server';
import { mockDB } from '@/lib/client-contracts/mockData';
import { handleProxyOrFallback } from '@/lib/client-contracts/proxyHelper';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const caseId = params.id;
  return handleProxyOrFallback(request, `/api/cases/${caseId}/search`, async () => {
    try {
      const clonedRequest = request.clone();
      const { query } = await clonedRequest.json();
      if (!query) {
        return NextResponse.json({ error: 'Query is required' }, { status: 400 });
      }
      
      const lowerQuery = query.toLowerCase();
      
      // Filter matching entities
      const matchedEntities = mockDB.entities.filter((e) => 
        e.canonical_name.toLowerCase().includes(lowerQuery) || 
        e.type.toLowerCase().includes(lowerQuery) ||
        e.aliases.some((a) => a.toLowerCase().includes(lowerQuery))
      );
      
      // Filter matching evidence
      const matchedEvidence = mockDB.evidence.filter((e) => 
        e.case_id === caseId && (
          e.id.toLowerCase().includes(lowerQuery) ||
          e.source_type.toLowerCase().includes(lowerQuery) ||
          e.source_ref.toLowerCase().includes(lowerQuery) ||
          (e.content && e.content.toLowerCase().includes(lowerQuery))
        )
      );
      
      // Find matching relationships connecting matched entities
      const matchedEntityIds = new Set(matchedEntities.map((e) => e.id));
      const matchedRelationships = mockDB.relationships.filter((r) => 
        matchedEntityIds.has(r.source) || matchedEntityIds.has(r.target)
      );
      
      return NextResponse.json({
        query,
        entities: matchedEntities,
        evidence: matchedEvidence,
        relationships: matchedRelationships
      });
    } catch (error) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
  });
}
