import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { logger } from './lib/logger';
import { errorHandler, notFoundHandler } from './middleware/error';
import { authRouter } from './modules/auth/auth.routes';
import { chatRouter } from './modules/chat/chat.routes';
import { mediaRouter } from './modules/media/media.routes';
import { settingsRouter } from './modules/settings/settings.routes';
import { usersRouter } from './modules/users/users.routes';
import { invitesRouter, workspacesRouter } from './modules/workspaces/workspaces.routes';
import { zonesRouter } from './modules/zones/zones.routes';
import { healthRouter } from './routes/health';

export function createApp(): Express {
  const app = express();

  // --- Security & parsing ---
  app.set('trust proxy', 1); // correct client IP behind a proxy/load balancer
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGINS, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(pinoHttp({ logger }));

  // --- Health (unversioned, for orchestrators) ---
  app.use(healthRouter);

  // --- Nested workspace routers ---
  workspacesRouter.use('/:workspaceId/zones', zonesRouter);
  workspacesRouter.use('/:workspaceId/settings', settingsRouter);

  // --- API v1 ---
  const api = express.Router();
  api.use('/auth', authRouter);
  api.use('/users', usersRouter);
  api.use('/workspaces', workspacesRouter);
  api.use('/invites', invitesRouter);
  api.use('/media', mediaRouter);
  api.use(chatRouter); // exposes /channels/... and /workspaces/:id/dm
  app.use('/api/v1', api);

  // --- Fallbacks ---
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
