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
  
  // 1. Check Mistral (Generation Model) embedding dimension
  console.log("\nChecking 'mistral' model...");
  const mistralDim = await getEmbeddingDimension('mistral');
  console.log(`Mistral Embedding Dimension: ${mistralDim || 'Failed (Not pulled yet?)'}`);

  // 2. Check Nomic-Embed-Text (Dedicated Embedding Model) dimension
  console.log("\nChecking 'nomic-embed-text' model...");
  const nomicDim = await getEmbeddingDimension('nomic-embed-text');
  console.log(`Nomic-Embed-Text Embedding Dimension: ${nomicDim || 'Failed (Not pulled yet?)'}`);
  
  // 3. Check Qdrant Config
  const COLLECTION_NAME = "evidence"; // Assume standard name if not passed
  console.log(`\nChecking Qdrant Collection '${COLLECTION_NAME}'...`);
  const qdrantDim = await checkQdrantCollection(COLLECTION_NAME);
  console.log(`Qdrant Collection Dimension: ${qdrantDim || 'Not found/Error'}`);
}

main();
