import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { generateEmbedding } from '../lib/ai/ollama';
import { getQdrantClient, initQdrantCollection } from '../lib/db/qdrant';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { verifyAuthContext } from '../lib/auth/auth_verifier';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null
});

console.log('Ingestion Worker starting...');

const worker = new Worker('ingestion', async (job: Job) => {
  // 5. Align BullMQ payload
  const { jobId, caseId, normalizedType, evidenceId, storageUri, hmac_protocol } = job.data;
  console.log(`Processing job ${jobId} for evidence ${evidenceId} (${normalizedType})`);

  if (!caseId) {
    throw new Error('Missing caseId for D3 Qdrant authorization.');
  }

  // 6. Secure BullMQ authorization
  if (!hmac_protocol || !hmac_protocol.payload || !hmac_protocol.signature) {
    throw new Error('Unauthorized: Missing explicit hmac_protocol in BullMQ job.');
  }

  if (hmac_protocol.expires_at && Date.now() > hmac_protocol.expires_at) {
    throw new Error('Forbidden: AuthContext payload expired in BullMQ job.');
  }

  const isValid = verifyAuthContext(hmac_protocol.payload, hmac_protocol.signature);
  if (!isValid) {
    throw new Error('Forbidden: Invalid AuthContext signature in BullMQ job.');
  }

  // Validate that the context actually authorizes the caseId
  const contextJson = Buffer.from(hmac_protocol.payload, 'base64').toString('utf8');
  const parsedAuth = JSON.parse(contextJson);
  if (parsedAuth.case_id !== caseId && !(parsedAuth.allowed_case_ids || []).includes(caseId)) {
    throw new Error('Forbidden: AuthContext does not authorize this caseId.');
  }

  try {
    await initQdrantCollection('evidence');
    const qdrant = getQdrantClient();

    // 1. Read actual document content based on storageUri (Issue #5)
    let extractedText = "";
    try {
      const fs = require('fs/promises');
      // For MVP, we assume the file contains extractable text or is a txt/csv/json file. 
      // A production implementation would dispatch to pdf-parse or tesseract based on normalizedType.
      extractedText = await fs.readFile(storageUri, 'utf8');
    } catch (e: any) {
      console.warn(`Failed to read actual file at ${storageUri}:`, e.message);
      throw new Error(`Failed to read evidence artifact: ${e.message}`);
    }
    
    // 2. Deterministic chunking (Simple split for MVP)
    const chunks = extractedText.match(/[\s\S]{1,1000}(?!\S)/g) || [extractedText];

    // 3. Embedding & Upsert
    const points = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunkText = chunks[i];
      if (!chunkText.trim()) continue;

      // Target approved architecture embedding model (Issue #4)
      const embedding = await generateEmbedding(chunkText, 'multilingual-e5-small');
      
      const chunkHash = crypto.createHash('sha256').update(chunkText).digest('hex');
      const pointId = uuidv4();

      points.push({
        id: pointId,
        vector: embedding,
        payload: {
          vector_id: pointId,
          case_id: caseId,
          source_ref: evidenceId,
          chunk_ref: `chunk_${i}`,
          model_version: 'multilingual-e5-small-v1',
          text_hash: chunkHash,
          text: chunkText
        }
      });
    }

    await qdrant.upsert('evidence', {
      wait: true,
      points: points
    });

    console.log(`Job ${jobId} completed successfully. Upserted ${points.length} vectors to Qdrant.`);
  } catch (error: any) {
    console.error(`Job ${jobId} failed:`, error);
    throw error;
  }
}, { connection });

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} has failed with ${err.message}`);
});

process.on('SIGINT', async () => {
  await worker.close();
  process.exit(0);
});
