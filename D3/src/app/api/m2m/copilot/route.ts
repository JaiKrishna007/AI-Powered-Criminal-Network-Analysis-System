import { NextResponse } from 'next/server';
import { extractAndVerifyAuthContext } from '@/lib/auth/auth_verifier';
import { generateCopilotResponse } from '@/lib/ai/ollama';
import { SYSTEM_PROMPT_D3, formatCopilotPrompt } from '@/lib/ai/prompts';
import { GraphContextClient } from '@/lib/graph/client';
import { getQdrantClient } from '@/lib/db/qdrant';
import { generateEmbedding } from '@/lib/ai/ollama';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('x-authorization-context');
    const signature = request.headers.get('x-authorization-signature') || '';

    if (!authHeader || !signature) {
      return NextResponse.json({ error: 'Missing M2M authorization headers' }, { status: 401 });
    }

    let authContext;
    try {
      // In D3, verifyAuthContext takes the base64 string and signature
      const { verifyAuthContext } = require('@/lib/auth/auth_verifier');
      const isValid = verifyAuthContext(authHeader, signature);
      if (!isValid) throw new Error("Invalid signature");
      authContext = JSON.parse(Buffer.from(authHeader, 'base64').toString('utf8'));
    } catch (e: any) {
      console.error("M2M Auth Error:", e.message);
      return NextResponse.json({ error: 'UNAUTHORIZED', message: e.message }, { status: 401 });
    }

    const { query, focusEntityId } = await request.json();
    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // 2. Query Routing & Intent Detection (Issue #8)
    const lowerQuery = query.toLowerCase();
    const isTemporal = lowerQuery.includes('when') || lowerQuery.includes('before') || lowerQuery.includes('after') || lowerQuery.includes('changed');
    const isGraph = lowerQuery.includes('bridge') || lowerQuery.includes('connection') || lowerQuery.includes('connects') || lowerQuery.includes('relationship') || focusEntityId;
    
    let graphContextParts: string[] = [];
    
    if (focusEntityId) {
      if (isGraph) {
        try {
          const subgraph = await GraphContextClient.getFocusedGraph(authHeader, signature, focusEntityId, 1);
          if (!subgraph || Object.keys(subgraph).length === 0) {
            graphContextParts.push("Graph Context: NO_GRAPH_RESULTS");
          } else {
            graphContextParts.push("Graph Context: " + JSON.stringify(subgraph));
          }
        } catch (e: any) {
          console.error("Failed to retrieve graph context from D4:", e.message);
          return NextResponse.json({ error: 'GRAPH_SERVICE_UNAVAILABLE', details: e.message }, { status: 503 });
        }
      }
      
      if (isTemporal) {
        try {
          // Actual D4 temporal client operation (Issue #7)
          const temporalGraph = await GraphContextClient.getTemporalGraph(authHeader, signature, query, focusEntityId);
          if (!temporalGraph || Object.keys(temporalGraph).length === 0) {
            graphContextParts.push("Temporal Context: NO_GRAPH_RESULTS");
          } else {
            graphContextParts.push("Temporal Context: " + JSON.stringify(temporalGraph));
          }
        } catch (e: any) {
          console.error("Failed to retrieve temporal context from D4:", e.message);
          return NextResponse.json({ error: 'GRAPH_SERVICE_UNAVAILABLE', details: e.message }, { status: 503 });
        }
      }
    } else if (isGraph || isTemporal) {
      graphContextParts.push("Graph/Temporal intent detected, but no specific focusEntityId was provided by D2 to anchor the search.");
    }

    const graphContext = graphContextParts.length > 0 ? graphContextParts.join('\n\n') : "Pure semantic query. Graph routing bypassed.";

    // 3. Vector Retrieval (Qdrant)
    let evidenceContext = "NO_RESULTS";
    const grounding: string[] = [];
    try {
      const { searchEvidence } = require('@/lib/db/qdrant');
      const queryEmbedding = await generateEmbedding(query, 'multilingual-e5-small');
      
      const allowedCaseIds = authContext.allowed_case_ids || [authContext.case_id];
      const searchResults = await searchEvidence('evidence', queryEmbedding, allowedCaseIds, 5);

      if (searchResults && searchResults.length > 0) {
        evidenceContext = searchResults.map((res: any) => {
          const p = res.payload as any;
          if (p.source_ref && !grounding.includes(p.source_ref)) {
            grounding.push(p.source_ref); // Preserve EVD-xxx provenance
          }
          return `[Source: ${p.source_ref}, Chunk: ${p.chunk_ref}]\n${p.text}`;
        }).join('\n\n');
      }
    } catch (e: any) {
      console.error("Qdrant retrieval failed:", e.message);
      return NextResponse.json({ error: 'VECTOR_STORE_UNAVAILABLE', details: e.message }, { status: 503 });
    }

    // 4. Generate AI Response
    const prompt = formatCopilotPrompt(query, evidenceContext, graphContext);
    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPT_D3 },
      { role: 'user' as const, content: prompt }
    ];

    const aiResponse = await generateCopilotResponse(messages);

    // 5. Return expected M2M Response Contract to D2
    return NextResponse.json({ 
      status: 'success',
      response: aiResponse,
      grounding: grounding
    }, { status: 200 });

  } catch (error: any) {
    console.error(`M2M Copilot Error:`, error);
    if (error.name === 'MODEL_UNAVAILABLE' || error.message?.includes('MODEL_UNAVAILABLE')) {
      return NextResponse.json({ error: 'MODEL_UNAVAILABLE', details: error.message }, { status: 503 });
    }
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
