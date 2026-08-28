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
        size: 384, // Dimensions for multilingual-e5-small embeddings
        distance: 'Cosine'
      }
    });
    console.log(`Created Qdrant collection: ${collectionName}`);
  }
}

export async function searchEvidence(collectionName: string, queryVector: number[], allowedCaseIds: string[], limit: number = 5) {
  if (!allowedCaseIds || allowedCaseIds.length === 0) {
    throw new Error('UNAUTHORIZED: Case filtering is mandatory for evidence retrieval.');
  }
  
  const client = getQdrantClient();
  const results = await client.search(collectionName, {
    vector: queryVector,
    limit,
    filter: {
      must: [
        {
          key: 'case_id',
          match: { any: allowedCaseIds }
        }
      ]
    },
    with_payload: true,
  });
  return results;
}
