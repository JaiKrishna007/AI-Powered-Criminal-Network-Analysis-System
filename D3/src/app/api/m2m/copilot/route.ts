import { NextResponse } from 'next/server';
import { extractAndVerifyAuthContext } from '@/lib/auth/auth_verifier';
import { generateCopilotResponse } from '@/lib/ai/ollama';
import { SYSTEM_PROMPT_D3, formatCopilotPrompt } from '@/lib/ai/prompts';
import { GraphContextClient } from '@/lib/graph/client';
import { getQdrantClient } from '@/lib/db/qdrant';
import { generateEmbedding } from '@/lib/ai/ollama';

export async function POST(request: Request) {
  try {
    // 1. Verify M2M AuthContext headers
    let authContext;
    try {
      const headersObject: Record<string, string> = {};
      request.headers.forEach((value, key) => {
        headersObject[key.toLowerCase()] = value;
      });
      authContext = extractAndVerifyAuthContext(headersObject);
    } catch (e: any) {
      console.error("M2M Auth Error:", e.message);
      if (e.message.startsWith('UNAUTHORIZED')) {
        return NextResponse.json({ error: 'UNAUTHORIZED', message: e.message }, { status: 401 });
      }
      return NextResponse.json({ error: 'FORBIDDEN', message: e.message }, { status: 403 });
    }

    const { query, focusEntityId } = await request.json();
    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // Capture the signature to pass to D4
    const signature = request.headers.get('x-authorization-signature') || '';

    // 2. Fetch Graph Context from D4
    let graphContext = "";
    if (focusEntityId) {
      try {
        const subgraph = await GraphContextClient.getFocusedGraph(authContext, signature, focusEntityId, 1);
        graphContext = JSON.stringify(subgraph);
      } catch (e: any) {
        console.warn("Failed to retrieve graph context from D4:", e.message);
        graphContext = "No specific entity focused or graph context unavailable.";
      }
    } else {
      graphContext = "No specific entity focused. Graph contains 0 relevant nodes.";
    }

    // 3. Vector Retrieval (Qdrant)
    let evidenceContext = "No relevant text chunks retrieved.";
    const grounding: string[] = [];
    try {
      const qdrant = getQdrantClient();
      const queryEmbedding = await generateEmbedding(query, 'nomic-embed-text');
      
      const searchResults = await qdrant.search('evidence', {
        vector: queryEmbedding,
        limit: 5,
        filter: {
          must: [
            {
              key: 'case_id',
              match: { value: authContext.case_id }
            }
          ]
        },
        with_payload: true,
      });

      if (searchResults.length > 0) {
        evidenceContext = searchResults.map(res => {
          const p = res.payload as any;
          if (p.source_ref && !grounding.includes(p.source_ref)) {
            grounding.push(p.source_ref); // Preserve EVD-xxx provenance
          }
          return `[Source: ${p.source_ref}, Chunk: ${p.chunk_ref}]\n${p.text}`;
        }).join('\n\n');
      }
    } catch (e) {
      console.warn("Qdrant retrieval failed or collection missing:", e);
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
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
