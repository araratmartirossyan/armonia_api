import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { AppDataSource } from './data-source';
import { swaggerSpec } from './config/swagger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(helmet());
app.use(express.json());

// Swagger documentation
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(undefined, {
    swaggerOptions: {
      url: '/api-docs.json',
    },
  }),
);

// Swagger JSON endpoint for download
app.get('/api-docs.json', (req, res) => {
  const forwardedProto = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0]?.trim();
  const forwardedHost = (req.headers['x-forwarded-host'] as string | undefined)?.split(',')[0]?.trim();
  const proto = forwardedProto || req.protocol;
  const host = forwardedHost || req.get('host');
  const baseUrl = host ? `${proto}://${host}` : `http://localhost:${PORT}`;

  res.setHeader('Content-Type', 'application/json');
  res.send({
    ...swaggerSpec,
    servers: [{ url: baseUrl }],
  });
});

import authRoutes from './routes/authRoutes';
import ragRoutes from './routes/ragRoutes';
import licenseRoutes from './routes/licenseRoutes';
import kbRoutes from './routes/kbRoutes';
import userRoutes from './routes/userRoutes';
import configRoutes from './routes/configRoutes';

app.use('/auth', authRoutes);
app.use('/rag', ragRoutes);
app.use('/licenses', licenseRoutes);
app.use('/knowledge-bases', kbRoutes);
app.use('/users', userRoutes);
app.use('/config', configRoutes);

app.get('/', (req, res) => {
  res.send('RAG Backend is running');
});

AppDataSource.initialize()
  .then(() => {
    // Data source initialized
    const server = app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      // Server started
    });
    // Allow long-running uploads/ingestion (default ~5m). Set generously; adjust via env if needed.
    server.requestTimeout = 15 * 60 * 1000; // 15 minutes
    server.headersTimeout = 15 * 60 * 1000;
    server.keepAliveTimeout = 60 * 1000;
  })
  .catch((err) => {
    console.error('Error during Data Source initialization', err);
  });
