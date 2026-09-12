import { Prisma } from '@prisma/client';
import { ChannelScope } from '@vicinity/shared';
import { AppError } from '../../lib/app-error';
import { prisma } from '../../lib/prisma';

/** Throws unless `userId` may read/write the given channel. */
export async function assertChannelAccess(userId: string, channelId: string) {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    include: { members: { where: { userId }, select: { userId: true } } },
  });
  if (!channel) throw AppError.notFound('Channel not found');

  if (channel.scope === ChannelScope.Dm) {
    if (channel.members.length === 0) throw AppError.forbidden('Not a participant of this DM');
  } else {
    const membership = await prisma.membership.findUnique({
      where: { workspaceId_userId: { workspaceId: channel.workspaceId, userId } },
    });
    if (!membership) throw AppError.forbidden('Not a member of this workspace');
  }
  return channel;
}

export async function listMessages(
  userId: string,
  channelId: string,
  opts: { before?: string; limit: number },
) {
  await assertChannelAccess(userId, channelId);
  const messages = await prisma.message.findMany({
    where: {
      channelId,
      ...(opts.before ? { createdAt: { lt: new Date(opts.before) } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: opts.limit,
  });
  // Return in chronological order for rendering convenience.
  return messages.reverse();
}

export async function postMessage(
  userId: string,
  channelId: string,
  body: string,
  metadata: Record<string, unknown> = {},
) {
  await assertChannelAccess(userId, channelId);
  return prisma.message.create({
    data: { channelId, senderId: userId, body, metadata: metadata as Prisma.InputJsonValue },
  });
}

/** Lists the workspace- and zone-scoped channels a member can read. */
export async function listWorkspaceChannels(userId: string, workspaceId: string) {
  const membership = await prisma.membership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
  if (!membership) throw AppError.forbidden('Not a member of this workspace');
  return prisma.channel.findMany({
    where: { workspaceId, scope: { in: [ChannelScope.Workspace, ChannelScope.Zone] } },
    orderBy: { createdAt: 'asc' },
  });
}

/** Finds or creates a 1:1 DM channel between two workspace members. */
export async function getOrCreateDm(workspaceId: string, userA: string, userB: string) {
  if (userA === userB) throw AppError.badRequest('Cannot DM yourself');

  const existing = await prisma.channel.findFirst({
    where: {
      workspaceId,
      scope: ChannelScope.Dm,
      AND: [
        { members: { some: { userId: userA } } },
        { members: { some: { userId: userB } } },
      ],
    },
  });
  if (existing) return existing;

  return prisma.channel.create({
    data: {
      workspaceId,
      scope: ChannelScope.Dm,
      members: { create: [{ userId: userA }, { userId: userB }] },
    },
  });
}
