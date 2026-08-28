import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import mongoose from 'mongoose';
import { Evidence } from '../lib/db/models/Evidence';
import { generateEmbedding } from '../lib/ai/ollama';
import { getQdrantClient, initQdrantCollection } from '../lib/db/qdrant';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://admin:adminpassword@localhost:27017/sih?authSource=admin';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null
});

console.log('Ingestion Worker starting...');

mongoose.connect(MONGODB_URI).then(() => {
  console.log('Worker connected to MongoDB');
}).catch(err => {
  console.error('Worker MongoDB connection error:', err);
});

const worker = new Worker('ingestion', async (job: Job) => {
  const { evidenceId, filePath, sourceType, caseId, classification } = job.data;
  console.log(`Processing job ${job.id} for evidence ${evidenceId} (${sourceType})`);

  if (!caseId || !classification) {
    throw new Error('Missing caseId or classification for D3 Qdrant authorization.');
  }

  try {
    await Evidence.findByIdAndUpdate(evidenceId, { status: 'PROCESSING' });

    await initQdrantCollection('evidence');
    const qdrant = getQdrantClient();

    // 1. Fake text extraction based on file path for the prototype E2E
    // In production, use pdf-parse or tesseract
    const extractedText = "This is a simulated document content. Suspect A transferred $10,000 to Suspect B on 2023-10-15 via shell company XYZ Corp. Address is 123 Main St.";
    
    // 2. Deterministic chunking (simulated 256 tokens per chunk)
    const chunks = [extractedText]; // Just one chunk for prototype simplicity

    // 3. Embedding & Upsert
    const points = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunkText = chunks[i];
      const embedding = await generateEmbedding(chunkText, 'nomic-embed-text');
      
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
          model_version: 'nomic-embed-text-v1.5',
          text_hash: chunkHash,
          classification: classification,
          text: chunkText
        }
      });
    }

    await qdrant.upsert('evidence', {
      wait: true,
      points: points
    });

    await Evidence.findByIdAndUpdate(evidenceId, { status: 'COMPLETED' });
    console.log(`Job ${job.id} completed successfully. Upserted ${points.length} vectors to Qdrant.`);
  } catch (error: any) {
    console.error(`Job ${job.id} failed:`, error);
    await Evidence.findByIdAndUpdate(evidenceId, { status: 'FAILED' });
    throw error; // Let BullMQ handle retries if configured
  }
}, { connection });

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} has failed with ${err.message}`);
});

process.on('SIGINT', async () => {
  await worker.close();
  await mongoose.disconnect();
  process.exit(0);
});
