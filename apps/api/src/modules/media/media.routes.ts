import { Router } from 'express';
import { env } from '../../config/env';
import { requireAuth } from '../../middleware/auth';

export const mediaRouter = Router();

/**
 * Returns the ICE server configuration the browser needs to establish WebRTC
 * connections. TURN credentials (if configured) are returned here rather than
 * baked into the client bundle.
 *
 * TODO(media): when an SFU is introduced, add `POST /media/token` that mints a
 * short-lived, room-scoped LiveKit/mediasoup token.
 */
mediaRouter.get('/ice', requireAuth, (_req, res) => {
  const iceServers: Array<{ urls: string | string[]; username?: string; credential?: string }> = [
    { urls: env.STUN_URLS },
  ];
  if (env.TURN_URL) {
    iceServers.push({
      urls: env.TURN_URL,
      username: env.TURN_USERNAME,
      credential: env.TURN_CREDENTIAL,
    });
  }
  res.json({ iceServers });
});
