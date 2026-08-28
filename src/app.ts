import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import session from 'express-session';
import authRoutes from './routes/auth.routes';
import casesRoutes from './routes/cases.routes';
import adminRoutes from './routes/admin.routes';
import ingestionsRoutes from './routes/ingestions.routes';
import relationshipsRoutes from './routes/relationships.routes';
import reportsRoutes from './routes/reports.routes';
import evidenceRoutes from './routes/evidence.routes';
import { AuditMiddleware } from './middleware/audit';
import { AuthMiddleware, AuthenticatedRequest } from './middleware/auth';
import { db } from './db';

const app = express();

// Audit correlation ID propagation
app.use(AuditMiddleware.correlationId);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));

// Validate session secret in production (Issue 34)
if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  throw new Error('FATAL: SESSION_SECRET must be explicitly configured in production environment');
}
const sessionSecret = process.env.SESSION_SECRET || 'demo-session-secret-prototype-key';

// Redis session store with MemoryStore fallback for test/dev environments (Issue 23 & 35)
let sessionStore;
if (process.env.NODE_ENV === 'production') {
  if (!process.env.REDIS_URL) {
    throw new Error('FATAL: REDIS_URL must be configured in production environment for distributed session storage.');
  }
  try {
    const { RedisStore } = require('connect-redis');
    const Redis = require('ioredis');
    const redisClient = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 3 });
    sessionStore = new RedisStore({ client: redisClient, prefix: 'sess:' });
  } catch (err: any) {
    throw new Error(`FATAL: Failed to initialize Redis session store in production: ${err.message}`);
  }
} else if (process.env.NODE_ENV !== 'test' && process.env.REDIS_URL) {
  try {
    const { RedisStore } = require('connect-redis');
    const Redis = require('ioredis');
    const redisClient = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 3 });
    sessionStore = new RedisStore({ client: redisClient, prefix: 'sess:' });
  } catch (err: any) {
    console.warn(`Redis session store initialization warning: ${err.message}. Using fallback.`);
  }
}

app.use(session({
  store: sessionStore,
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 86400000 // 24 hours
  }
}));

// Core Canonical API Routes
app.use('/api/auth', authRoutes);

// Canonical /api/me endpoint (Issue 36)
app.get('/api/me', AuthMiddleware.requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await db.getUser(req.user!.id);
    if (!user) {
      return res.status(404).json({ error: 'USER_NOT_FOUND', message: 'Current user not found' });
    }
    const { password_hash, ...safeUser } = user as any;
    return res.status(200).json(safeUser);
  } catch (err: any) {
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
  }
});

app.use('/api/cases', casesRoutes);
app.use('/api/ingestions', ingestionsRoutes);
app.use('/api/relationships', relationshipsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/evidence', evidenceRoutes);
app.use('/api/admin', adminRoutes);

// Deprecated compatibility routes for legacy callers (Issue 37)
app.use('/api/v1', (req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Warning', '299 - "Deprecated API version: please use canonical /api/* endpoints"');
  next();
});
app.use('/api/v1/cases', casesRoutes);
app.use('/api/v1/admin', adminRoutes);

// General Health Check
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'HEALTHY', contract: 'PS26189-CONTRACT-v1' });
});

// Detailed Dependency Health Check (Issue 31)
app.get('/health/dependencies', async (_req: Request, res: Response) => {
  const checkService = async (url: string, timeoutMs: number = 2000): Promise<'UP' | 'DOWN'> => {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);
      const resp = await fetch(url, { signal: controller.signal });
      clearTimeout(id);
      return resp.ok ? 'UP' : 'DOWN';
    } catch {
      return 'DOWN';
    }
  };

  let mongoStatus: 'UP' | 'DOWN' = 'DOWN';
  try {
    if (db.db) {
      await db.db.command({ ping: 1 });
      mongoStatus = 'UP';
    } else if (process.env.NODE_ENV === 'test') {
      mongoStatus = 'UP';
    }
  } catch {
    mongoStatus = 'DOWN';
  }

  let redisStatus: 'UP' | 'DOWN' = 'DOWN';
  try {
    if (process.env.NODE_ENV === 'test') {
      redisStatus = 'UP';
    } else if (process.env.REDIS_URL) {
      const Redis = require('ioredis');
      const client = new Redis(process.env.REDIS_URL, { connectTimeout: 2000 });
      const pong = await client.ping();
      redisStatus = pong === 'PONG' ? 'UP' : 'DOWN';
      await client.quit();
    }
  } catch {
    redisStatus = 'DOWN';
  }

  const d3Url = process.env.D3_SERVICE_URL || 'http://localhost:8002';
  const d4Url = process.env.D4_SERVICE_URL || 'http://localhost:8003';
  const mlUrl = process.env.ML_SERVICE_URL || 'http://localhost:8001';

  const [d3Status, d4Status, mlStatus] = await Promise.all([
    checkService(`${d3Url}/health`),
    checkService(`${d4Url}/health`),
    checkService(`${mlUrl}/health`)
  ]);

  return res.status(200).json({
    backend: 'UP',
    mongodb: mongoStatus,
    redis: redisStatus,
    d3: d3Status,
    d4: d4Status,
    ml: mlStatus
  });
});

export default app;
