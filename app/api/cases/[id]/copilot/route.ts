import { NextResponse } from 'next/server';
import { mockDB } from '@/lib/client-contracts/mockData';
import { CopilotMessage } from '@/lib/client-contracts/contracts';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const caseId = params.id;
  const history = mockDB.copilotSessions[caseId] || [];
  return NextResponse.json(history);
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const caseId = params.id;
  try {
    const { message } = await request.json();
    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Initialize session if missing
    if (!mockDB.copilotSessions[caseId]) {
      mockDB.copilotSessions[caseId] = [];
    }

    // Save user message
    const userMsg: CopilotMessage = {
      id: `MSG-${Date.now()}-U`,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };
    mockDB.copilotSessions[caseId].push(userMsg);

    // Orchestrate response based on query keywords (Intents - AI-07)
    let answer = '';
    let evidence_ids: string[] = [];
    let limitations: string[] = [];
    let graph_request: CopilotMessage['graph_request'] = undefined;

    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('rohan') && (lowerMessage.includes('account') || lowerMessage.includes('bank') || lowerMessage.includes('hdfc') || lowerMessage.includes('a-402'))) {
      answer = `Based on corporate registers and financial ledgers, **Rohan Mehta** is the registered owner of **HDFC Bank Account A-402** (Full account: HDFC-48991029402) [DIR-101]. \n\nOur financial records show Rohan Mehta transferred **INR 500,000** from this account to Vikram Malhotra's ICICI account (A-908) on August 12, 2026, marked as 'Consultancy' [TXN-8819].`;
      evidence_ids = ['DIR-101', 'TXN-8819'];
      limitations = ['Remarks in transaction logs ("Consultancy") are self-declared and require external verification.'];
      graph_request = {
        seed_nodes: ['P001', 'BA001', 'P002'],
        hops: 1
      };
    } else if (lowerMessage.includes('connect') || lowerMessage.includes('path') || (lowerMessage.includes('rohan') && lowerMessage.includes('david'))) {
      answer = `A 3-hop connection path has been identified between primary suspect **Rohan Mehta** and offshore entity **David Miller**:
      
1. **Communication**: Rohan Mehta called number **+91 98765 43210** (PH001) [CDR-101].
2. **Intermediate**: PH001 placed a late-night call to **Mohd. Rizwan** (P004) [CDR-102].
3. **Bridge Action**: Mohd. Rizwan transferred **INR 1,200,000** to Swiss Credit Account BA003 [TXN-9021], which is registered to shell company Delta Logistics Inc., whose primary beneficiary is **David Miller** [DIR-103].`;
      
      evidence_ids = ['CDR-101', 'CDR-102', 'TXN-9021', 'DIR-103'];
      limitations = [
        'Phone number +91 98765 43210 is a proxy burner and subscriber registration details are unverified.',
        'Offshore corporate records for Delta Logistics Inc. are based on offshore intelligence databases and require official judicial subpoena.'
      ];
      graph_request = {
        seed_nodes: ['P001', 'PH001', 'P004', 'P005'],
        hops: 2,
        highlight_edges: ['REL-001', 'REL-002', 'REL-008', 'REL-009']
      };
    } else if (lowerMessage.includes('rizwan') || lowerMessage.includes('bridge') || lowerMessage.includes('connector')) {
      answer = `**Mohd. Rizwan** (P004) is flagged by graph analytics as a **Potential Bridge Entity** with a high betweenness centrality index [INS-001]. He connects:
      
- **The Suspect Cluster**: Receives calls from Rohan's contact PH001 [CDR-102] and has been spotted meeting Vikram Malhotra at Hotel Regal in Pune [SURV-103].
- **The Offshore Cluster**: Transferred INR 1.2M to Swiss Account BA003 [TXN-9021] owned by David Miller.`;
      
      evidence_ids = ['CDR-102', 'SURV-103', 'TXN-9021'];
      limitations = ['Physical meeting logs at Hotel Regal are CCTV timestamps and do not confirm spoken agreements.'];
      graph_request = {
        seed_nodes: ['P004'],
        hops: 2
      };
    } else if (lowerMessage.includes('dubai') || lowerMessage.includes('arrest') || lowerMessage.includes('guilty')) {
      // FE-T06 & AI-T02 ref: Safe uncertainty / insufficient evidence Refusal state
      answer = `**INSUFFICIENT EVIDENCE**: The authorized investigation file for Case 1042 does not contain any evidence regarding travels to Dubai, arrest logs, or statements of guilt. \n\nPlease consult authorized case materials or upload supplementary border logs.`;
      evidence_ids = [];
      limitations = ['Search query was bounded to authorized case documents only.'];
    } else {
      answer = `Based on hybrid search in **Case 1042**, I found records connecting Rohan Mehta to Vikram Malhotra via a transaction of INR 500,000 [TXN-8819] and a communication proxy [CDR-101]. Mohd. Rizwan acts as a bridge to David Miller's Swiss account [TXN-9021, DIR-103]. \n\nWould you like me to map the financial path or show the temporal communication spikes?`;
      evidence_ids = ['TXN-8819', 'TXN-9021', 'CDR-101'];
      limitations = ['Analysis restricted to active Case 1042 workspace.'];
    }

    const assistantMsg: CopilotMessage = {
      id: `MSG-${Date.now()}-A`,
      role: 'assistant',
      content: answer,
      timestamp: new Date().toISOString(),
      evidence_ids,
      limitations,
      graph_request
    };
    mockDB.copilotSessions[caseId].push(assistantMsg);

    return NextResponse.json(assistantMsg);
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
