import { QdrantClient } from '@qdrant/js-client-rest';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';

async function getEmbeddingDimension(modelName: string): Promise<number | null> {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelName,
        prompt: "This is a test document for embedding dimension check."
      })
    });
    
    if (!response.ok) {
      console.error(`Failed to get embeddings for ${modelName}: ${response.statusText}`);
      return null;
    }
    
    const data = await response.json();
    return data.embedding ? data.embedding.length : null;
  } catch (error) {
    console.error(`Error connecting to Ollama for ${modelName}:`, error);
    return null;
  }
}

async function checkQdrantCollection(collectionName: string) {
  const client = new QdrantClient({ url: QDRANT_URL });
  try {
    const collection = await client.getCollection(collectionName);
    return collection.config.params.vectors.size;
  } catch (error: any) {
    console.error(`Error fetching Qdrant collection ${collectionName}:`, error.message);
    return null;
  }
}

async function main() {
  console.log("--- D3 RAG DIAGNOSTIC CHECK ---");
  
  const MODEL_NAME = 'multilingual-e5-small';
  console.log(`\nChecking '${MODEL_NAME}' model...`);
  const actualDim = await getEmbeddingDimension(MODEL_NAME);
  console.log(`Actual Embedding Dimension: ${actualDim || 'Failed (Not pulled yet?)'}`);
  
  const COLLECTION_NAME = "evidence";
  console.log(`\nChecking Qdrant Collection '${COLLECTION_NAME}'...`);
  const qdrantDim = await checkQdrantCollection(COLLECTION_NAME);
  console.log(`Qdrant Collection Dimension: ${qdrantDim || 'Not found/Error'}`);
  
  if (actualDim && qdrantDim) {
    if (actualDim === qdrantDim) {
      console.log("\nStatus: MATCH");
    } else {
      console.log("\nStatus: MISMATCH");
    }
  } else {
    console.log("\nStatus: MISMATCH (Incomplete Data)");
  }
}

main();
