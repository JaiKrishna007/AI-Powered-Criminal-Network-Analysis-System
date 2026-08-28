import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';
import { generateCopilotResponse } from '@/lib/ai/ollama';
import { SYSTEM_PROMPT_D3, formatCopilotPrompt } from '@/lib/ai/prompts';
import { getEntitySubgraph } from '@/lib/graph/queries';
import { getQdrantClient } from '@/lib/db/qdrant';
import { generateEmbedding } from '@/lib/ai/ollama';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { query, focusEntityId } = await request.json();
    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    let graphContext = "";
    if (focusEntityId) {
      const subgraph = await getEntitySubgraph(focusEntityId, 1);
      graphContext = JSON.stringify(subgraph);
    } else {
      // Mock graph context for prototype demo
      graphContext = "No specific entity focused. Graph contains 0 relevant nodes.";
    }

    // 2. Vector Retrieval (Qdrant)
    // Authorization: filter strictly by the case_id
    let evidenceContext = "No relevant text chunks retrieved.";
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
              match: { value: params.id }
            }
          ]
        },
        with_payload: true,
      });

      if (searchResults.length > 0) {
        evidenceContext = searchResults.map(res => {
          const p = res.payload as any;
          return `[Source: ${p.source_ref}, Chunk: ${p.chunk_ref}]\n${p.text}`;
        }).join('\n\n');
      }
    } catch (e) {
      console.warn("Qdrant retrieval failed or collection missing:", e);
    }

    const prompt = formatCopilotPrompt(query, evidenceContext, graphContext);

    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPT_D3 },
      { role: 'user' as const, content: prompt }
    ];

    const aiResponse = await generateCopilotResponse(messages);

    return NextResponse.json({ 
      response: aiResponse,
      contextUsed: {
        graphContext,
        evidenceContext
      }
    }, { status: 200 });

  } catch (error: any) {
    console.error(`Copilot Error in case ${params.id}:`, error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
