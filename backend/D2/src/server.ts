import app from './app';
import { db } from './db';
import { startIngestionWorker } from './workers/ingestion.queue';
import { startReportWorker } from './workers/report.queue';
import { ExtractionService } from './services/extraction.service';
import { DefaultExtractionWorker } from './workers/extraction_worker.adapter';

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await db.connect();
    console.log('Connected to MongoDB');
    
    ExtractionService.registerWorker(new DefaultExtractionWorker());

    if (process.env.NODE_ENV !== 'test') {
      startIngestionWorker();
      startReportWorker();
      console.log('Started BullMQ Ingestion & Report Workers');
    }

    app.listen(PORT, () => {
      console.log(`Backend Developer 2 service running on port ${PORT} [PS26189-CONTRACT-v1]`);
    });
  } catch (error) {
    console.error('Failed to connect to database', error);
    process.exit(1);
  }
}

start();
