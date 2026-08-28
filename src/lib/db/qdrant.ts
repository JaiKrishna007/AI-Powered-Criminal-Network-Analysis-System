import { QdrantClient } from '@qdrant/js-client-rest';

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
let qdrantClient: QdrantClient;

export function getQdrantClient(): QdrantClient {
  if (!qdrantClient) {
    qdrantClient = new QdrantClient({ url: QDRANT_URL });
  }
  return qdrantClient;
}

export async function initQdrantCollection(collectionName: string) {
  const client = getQdrantClient();
  const exists = await client.collectionExists(collectionName);
  
  if (!exists.exists) {
    await client.createCollection(collectionName, {
      vectors: {
        size: 768, // Dimensions for nomic-embed-text embeddings
        distance: 'Cosine'
      }
    });
    console.log(`Created Qdrant collection: ${collectionName}`);
  }
}

export async function searchEvidence(collectionName: string, queryVector: number[], limit: number = 5) {
  const client = getQdrantClient();
  const results = await client.search(collectionName, {
    vector: queryVector,
    limit,
    with_payload: true,
  });
  return results;
}
