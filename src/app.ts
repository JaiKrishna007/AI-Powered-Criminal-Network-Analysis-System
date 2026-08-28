import express from 'express';
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

const app = express();

// 40. Audit records need correlation IDs
app.use(AuditMiddleware.correlationId);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'prototype-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 86400000 // 24 hours
  }
}));

app.use('/api/auth', authRoutes);

// Consolidated frozen API contract route
app.use('/api/cases', casesRoutes);
app.use('/api/ingestions', ingestionsRoutes);
app.use('/api/relationships', relationshipsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/evidence', evidenceRoutes);
app.use('/api/admin', adminRoutes);

// Keep v1 aliases for backwards compatibility in tests if necessary, 
// though we will migrate tests to /api/cases.
app.use('/api/v1/cases', casesRoutes);
app.use('/api/v1/admin', adminRoutes);

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'HEALTHY', contract: 'PS26189-CONTRACT-v1' });
});

export default app;
