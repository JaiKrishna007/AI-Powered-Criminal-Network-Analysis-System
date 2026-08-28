import { NextResponse } from 'next/server';
import { pgPool } from '@/src/db';
import { Neo4jGraphService } from '@/lib/graph/neo4j';
import { QdrantVectorStore } from '@/lib/vector';
import { EmbeddingGenerator } from '@/lib/ai/embeddings/generator';
import { SemanticSearchEngine } from '@/lib/vector/semantic_search';
import { IntentPlanner } from '@/lib/ai/rag/intent';
import { AllowlistedToolExecutor } from '@/lib/ai/rag/tools';
import { HybridRetrievalEngine } from '@/lib/ai/rag/hybrid_retrieval';
import { OllamaLLMProvider } from '@/lib/ai/llm/provider';
import { CopilotOrchestrator } from '@/lib/ai/rag/copilot';
import { CONFIG } from '@/lib/config';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const caseId = params.id;
  return NextResponse.json([]);
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

    // 1. Initialize RAG Vector Search components (Ollama/Qdrant)
    const embeddingGenerator = new EmbeddingGenerator(CONFIG.EMBEDDING_MODEL_NAME, 384);
    const vectorStore = new QdrantVectorStore(
      process.env.QDRANT_URL || CONFIG.QDRANT_URL,
      CONFIG.QDRANT_COLLECTION,
      384
    );
    const semanticSearch = new SemanticSearchEngine(vectorStore, embeddingGenerator);

    // 2. Fetch live data from PostgreSQL & Neo4j database to build allowable RAG tools context
    const evRes = await pgPool.query('SELECT * FROM evidence WHERE case_id = $1;', [caseId]);
    const evidenceList = evRes.rows.map((ev: any) => ({
      id: ev.id,
      case_id: ev.case_id,
      file_name: ev.file_name || ev.source_ref,
      mime_type: ev.mime_type || 'application/octet-stream',
      sha256_hash: ev.sha256,
      created_at: ev.created_at || new Date().toISOString(),
      content: ev.content || ''
    }));

    const entitiesList: any[] = [];
    const relationshipsList: any[] = [];

    const neo4jService = new Neo4jGraphService();
    if (neo4jService.isConnected()) {
      try {
        const nodeRecords = await neo4jService.executeCypher(
          `MATCH (n) WHERE n.case_id = $caseId RETURN n;`,
          { caseId }
        );
        nodeRecords.forEach((record: any) => {
          const node = record.get('n');
          entitiesList.push({
            id: node.properties.id,
            type: node.labels[0].toUpperCase(),
            case_id: caseId,
            name: node.properties.canonical_name || node.properties.name || node.properties.id,
            classification: node.properties.classification || 'UNCLASSIFIED',
            created_at: node.properties.created_at || new Date().toISOString()
          });
        });

        const relRecords = await neo4jService.executeCypher(
          `MATCH (s)-[r]->(t) WHERE r.case_id = $caseId RETURN r;`,
          { caseId }
        );
        relRecords.forEach((record: any) => {
          const rel = record.get('r');
          relationshipsList.push({
            id: rel.properties.id,
            source: rel.properties.source || rel.startNodeElementId || rel.start || '',
            target: rel.properties.target || rel.endNodeElementId || rel.end || '',
            type: rel.type,
            case_id: caseId,
            evidence_ids: rel.properties.evidence_ids || [],
            event_time: rel.properties.event_time || rel.properties.timestamp,
            properties: rel.properties
          });
        });
      } catch (err) {
        console.error('[Copilot Context Loader] Neo4j load failed:', err);
      }
    }

    // 3. Build RAG tools context and executor
    const intentPlanner = new IntentPlanner();
    const toolExecutor = new AllowlistedToolExecutor(semanticSearch, {
      entities: entitiesList as any,
      relationships: relationshipsList as any,
      evidence: evidenceList as any
    });

    const hybridEngine = new HybridRetrievalEngine(intentPlanner, toolExecutor);

    // 4. Initialize Local LLM Provider
    const llmProvider = new OllamaLLMProvider(
      process.env.OLLAMA_BASE_URL || CONFIG.OLLAMA_BASE_URL,
      CONFIG.OLLAMA_MODEL
    );

    // 5. Ask Copilot Orchestrator
    const orchestrator = new CopilotOrchestrator(hybridEngine, llmProvider);
    
    // Auth context wrapper
    const authScope = {
      user_id: 'USR-201',
      authorized_case_ids: [caseId],
      security_clearance: 'SECRET' as const
    };

    const response = await orchestrator.ask(message, caseId, authScope);
    
    // Convert to frontend shape
    return NextResponse.json({
      id: `MSG-${Date.now()}-A`,
      role: 'assistant',
      content: response.answer,
      timestamp: new Date().toISOString(),
      evidence_ids: response.evidence_ids,
      limitations: response.limitations,
      graph_request: response.graph_request
    });
  } catch (error: any) {
    return NextResponse.json({
      error: 'COPILOT_FAILED',
      message: error.message
    }, { status: 500 });
  }
}
