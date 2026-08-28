import app from './app';
import { db } from './db';

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await db.connect();
    console.log('Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`Backend Developer 2 service running on port ${PORT} [PS26189-CONTRACT-v1]`);
    });
  } catch (error) {
    console.error('Failed to connect to database', error);
    process.exit(1);
  }
}

start();
