import { NextResponse } from 'next/server';
import { mockDB } from '@/lib/client-contracts/mockData';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const caseId = params.id;
  const caseLeads = mockDB.leads.filter((l) => l.case_id === caseId);
  return NextResponse.json(caseLeads);
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const caseId = params.id;
  try {
    const { leadId, status } = await request.json();
    
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
}
