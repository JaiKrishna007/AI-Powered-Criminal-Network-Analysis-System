import { Queue, Worker } from 'bullmq';
import { db } from '../db';
import { ReportService } from '../services/report.service';
import { AuthContext } from '../services/ai_client';
import path from 'path';
import { REPORTS_DIR } from '../config/paths';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
let reportQueue: Queue | null = null;
let reportWorker: Worker | null = null;

try {
  const connection = new (require('ioredis'))(redisUrl, { maxRetriesPerRequest: null });
  reportQueue = new Queue('reportQueue', { connection });
} catch (e: any) {
  console.warn(`Redis not available for BullMQ ReportQueue: ${e.message}.`);
}

export { reportQueue };

export const startReportWorker = () => {
  if (process.env.NODE_ENV === 'test' || !reportQueue) return;

  try {
    const connection = new (require('ioredis'))(redisUrl, { maxRetriesPerRequest: null });
    reportWorker = new Worker('reportQueue', async (job) => {
      const { reportId, caseId, userContext, version, params } = job.data;
      
      // 1. Verify user still exists and is ACTIVE (Issue 10)
      const user = await db.getUser(userContext.user_id);
      if (!user || user.status !== 'ACTIVE') {
        throw new Error(`User ${userContext.user_id} is inactive or does not exist`);
      }

      // 2. Verify case access is still authorized (Issue 10)
      const { AuthMiddleware } = await import('../middleware/auth.js');
      try {
        await AuthMiddleware.authorizeCaseAccess({
          userId: user.id,
          caseId
        });
      } catch {
        throw new Error(`User ${user.id} is no longer authorized for case ${caseId}`);
      }

      const caseObj = await db.getCase(caseId);
      if (!caseObj) {
        throw new Error(`Case ${caseId} not found`);
      }

      const fileName = `${reportId}.pdf`;
      const filePath = path.join(REPORTS_DIR, fileName);

      await ReportService.compileReportDirectly(reportId, caseObj, filePath, userContext, version, params);
    }, { connection });

    reportWorker.on('failed', async (job, err) => {
      if (job) {
        const { reportId } = job.data;
        await db.updateReport(reportId, {
          status: 'FAILED',
          error: err.message || 'Report generation failed'
        });
      }
    });
  } catch (err: any) {
    console.warn(`Failed to start report worker: ${err.message}`);
  }
};
