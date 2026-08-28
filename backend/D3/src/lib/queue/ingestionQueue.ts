import { Queue } from 'bullmq';
import IORedis from 'ioredis';

// Use a singleton pattern to avoid multiple queue instances during hot reloads
const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null
});

export const ingestionQueue = new Queue('ingestion', { connection });

export async function addIngestionJob(evidenceId: string, filePath: string, sourceType: string) {
  return await ingestionQueue.add('process-evidence', {
    evidenceId,
    filePath,
    sourceType
  });
}
