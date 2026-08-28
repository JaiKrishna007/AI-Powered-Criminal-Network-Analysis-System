import express from 'express';
import cors from 'cors';
import evidenceRoutes from './routes/evidence.routes';
import entityRoutes from './routes/entity.routes';
import casesRoutes from './routes/cases.routes';
import adminRoutes from './routes/admin.routes';

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.use('/api/v1/evidence', evidenceRoutes);
app.use('/api/v1/entity', entityRoutes);
app.use('/api/v1/cases', casesRoutes);
app.use('/api/v1/admin', adminRoutes);

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'HEALTHY', contract: 'PS26189-CONTRACT-v1' });
});

export default app;
