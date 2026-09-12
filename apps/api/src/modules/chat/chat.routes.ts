import { Router } from 'express';
import { z } from 'zod';
import type { ChatMessage } from '@vicinity/shared';
import { asyncHandler } from '../../lib/async-handler';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { broadcastChatCleared, broadcastChatMessage } from '../../realtime/broadcast';
import * as service from './chat.service';

export const chatRouter = Router();
chatRouter.use(requireAuth);

const historyQuery = z.object({
  before: z.string().datetime().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
});

const sendSchema = z.object({
  body: z.string().min(1).max(4000),
  metadata: z.record(z.unknown()).optional(),
});

chatRouter.get(
  '/channels/:channelId/messages',
  validate(historyQuery, 'query'),
  asyncHandler(async (req, res) => {
    const messages = await service.listMessages(req.user!.id, req.params.channelId, {
      before: req.query.before as string | undefined,
      limit: Number(req.query.limit),
    });
    res.json(messages);
  }),
);

chatRouter.post(
  '/channels/:channelId/messages',
  validate(sendSchema),
  asyncHandler(async (req, res) => {
    const message = await service.postMessage(
      req.user!.id,
      req.params.channelId,
      req.body.body,
      req.body.metadata,
    );
    // Persist first, then fan out to live subscribers.
    broadcastChatMessage(message.channelId, serialize(message));
    res.status(201).json(message);
  }),
);

chatRouter.delete(
  '/channels/:channelId/messages',
  asyncHandler(async (req, res) => {
    await service.clearChannelMessages(req.user!.id, req.params.channelId);
    broadcastChatCleared(req.params.channelId);
    res.status(204).end();
  }),
);

// Create (or fetch) a DM channel with another workspace member.
const dmSchema = z.object({ targetUserId: z.string().uuid() });

chatRouter.get(
  '/workspaces/:workspaceId/channels',
  asyncHandler(async (req, res) => {
    const channels = await service.listWorkspaceChannels(req.user!.id, req.params.workspaceId);
    res.json(channels);
  }),
);

chatRouter.post(
  '/workspaces/:workspaceId/dm',
  validate(dmSchema),
  asyncHandler(async (req, res) => {
    const channel = await service.getOrCreateDm(
      req.params.workspaceId,
      req.user!.id,
      req.body.targetUserId,
    );
    res.status(201).json(channel);
  }),
);

function serialize(m: {
  id: string;
  channelId: string;
  senderId: string;
  body: string;
  createdAt: Date;
  metadata: unknown;
}): ChatMessage {
  return {
    id: m.id,
    channelId: m.channelId,
    senderId: m.senderId,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
    metadata: (m.metadata as Record<string, unknown>) ?? {},
  };
}
