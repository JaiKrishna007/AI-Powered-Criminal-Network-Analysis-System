import { NextResponse } from 'next/server';
import { mockDB } from '@/lib/client-contracts/mockData';
import { handleProxyOrFallback } from '@/lib/client-contracts/proxyHelper';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const caseId = params.id;
  return handleProxyOrFallback(request, `/api/cases/${caseId}/leads`, async () => {
    const caseLeads = mockDB.leads.filter((l) => l.case_id === caseId);
    return caseLeads;
  });
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const caseId = params.id;
  return handleProxyOrFallback(request, `/api/cases/${caseId}/leads`, async () => {
    try {
      const clonedRequest = request.clone();
      const { leadId, status } = await clonedRequest.json();
      
      // Find the lead to update
      const lead = mockDB.leads.find((l) => l.id === leadId && l.case_id === caseId);
      if (!lead) {
        return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
      }
      
      if (status) {
        lead.status = status;
        // Record this action in a simulated audit log
        mockDB.entities.push({
          id: `AUD-${Date.now()}`,
          type: 'EVENT',
          canonical_name: `Lead Status Change: ${lead.title} -> ${status}`,
          aliases: [],
          confidence: 1.0
        });
      }
      
      return NextResponse.json(lead);
    } catch (error) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
  });
}
