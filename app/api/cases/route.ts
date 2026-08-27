import { NextResponse } from 'next/server';
import { mockDB } from '@/lib/client-contracts/mockData';
import { handleProxyOrFallback } from '@/lib/client-contracts/proxyHelper';

export async function GET(request: Request) {
  return handleProxyOrFallback(request, '/api/cases', async () => {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 300));
    return mockDB.cases;
  });
}

export async function POST(request: Request) {
  return handleProxyOrFallback(request, '/api/cases', async () => {
    try {
      const clonedRequest = request.clone();
      const body = await clonedRequest.json();
      const newCase = {
        id: `CASE-${Math.floor(1000 + Math.random() * 9000)}`,
        title: body.title || 'Untitled Case',
        status: 'ACTIVE' as const,
        owner_id: 'USR-201',
        classification: body.classification || 'CASE_RESTRICTED',
        description: body.description || '',
        created_at: new Date().toISOString(),
        evidence_count: 0,
        entity_count: 0,
        relationship_count: 0
      };
      
      mockDB.cases.unshift(newCase);
      return NextResponse.json(newCase, { status: 201 });
    } catch (error) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
  });
}
