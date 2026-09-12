import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { ChannelScope, MemberRole } from '@vicinity/shared';
import { AppError } from '../../lib/app-error';
import { prisma } from '../../lib/prisma';

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const suffix = crypto.randomBytes(3).toString('hex');
  return `${base || 'workspace'}-${suffix}`;
}

export const DEFAULT_OFFICE_ZONES = [
  {
    name: 'Commons Lounge',
    type: 'lounge' as const,
    geometry: { x: 80, y: 100, w: 460, h: 360 },
    audioIsolated: false,
  },
  {
    name: 'Focus Pod 1',
    type: 'focus' as const,
    geometry: { x: 80, y: 520, w: 220, h: 200 },
    audioIsolated: true,
  },
  {
    name: 'Focus Pod 2',
    type: 'focus' as const,
    geometry: { x: 320, y: 520, w: 220, h: 200 },
    audioIsolated: true,
  },
  {
    name: 'Private Office',
    type: 'private' as const,
    geometry: { x: 80, y: 760, w: 460, h: 180 },
    audioIsolated: true,
  },
  {
    name: 'Meeting Room Alpha',
    type: 'meeting' as const,
    geometry: { x: 600, y: 100, w: 460, h: 360 },
    audioIsolated: true,
  },
  {
    name: 'Meeting Room Beta',
    type: 'meeting' as const,
    geometry: { x: 600, y: 520, w: 460, h: 420 },
    audioIsolated: true,
  },
  {
    name: 'The Boardroom',
    type: 'meeting' as const,
    geometry: { x: 1120, y: 100, w: 420, h: 460 },
    audioIsolated: true,
  },
  {
    name: 'Breakout Cafe',
    type: 'open' as const,
    geometry: { x: 1120, y: 620, w: 420, h: 320 },
    audioIsolated: false,
  },
];

export const CAMPUS_GARDEN_ZONES = [
  {
    name: 'Grand Fountain Plaza',
    type: 'open' as const,
    geometry: { x: 590, y: 375, w: 420, h: 350 },
    audioIsolated: false,
  },
  {
    name: 'Coworking North-West',
    type: 'open' as const,
    geometry: { x: 140, y: 40, w: 380, h: 260 },
    audioIsolated: false,
  },
  {
    name: 'Focus Pod NW',
    type: 'focus' as const,
    geometry: { x: 540, y: 110, w: 130, h: 150 },
    audioIsolated: true,
  },
  {
    name: 'Meeting Room Alpha',
    type: 'meeting' as const,
    geometry: { x: 140, y: 340, w: 260, h: 180 },
    audioIsolated: true,
  },
  {
    name: 'Coworking North-East',
    type: 'open' as const,
    geometry: { x: 1080, y: 40, w: 380, h: 260 },
    audioIsolated: false,
  },
  {
    name: 'Focus Pod NE',
    type: 'focus' as const,
    geometry: { x: 930, y: 110, w: 130, h: 150 },
    audioIsolated: true,
  },
  {
    name: 'Meeting Room Beta',
    type: 'meeting' as const,
    geometry: { x: 1200, y: 340, w: 260, h: 180 },
    audioIsolated: true,
  },
  {
    name: 'Meeting Room Gamma',
    type: 'meeting' as const,
    geometry: { x: 140, y: 580, w: 260, h: 180 },
    audioIsolated: true,
  },
  {
    name: 'Coworking South-West',
    type: 'open' as const,
    geometry: { x: 140, y: 800, w: 380, h: 260 },
    audioIsolated: false,
  },
  {
    name: 'Focus Pod SW',
    type: 'focus' as const,
    geometry: { x: 540, y: 840, w: 130, h: 150 },
    audioIsolated: true,
  },
  {
    name: 'Meeting Room Delta',
    type: 'meeting' as const,
    geometry: { x: 1200, y: 580, w: 260, h: 180 },
    audioIsolated: true,
  },
  {
    name: 'Coworking South-East',
    type: 'open' as const,
    geometry: { x: 1080, y: 800, w: 380, h: 260 },
    audioIsolated: false,
  },
  {
    name: 'Focus Pod SE',
    type: 'focus' as const,
    geometry: { x: 930, y: 840, w: 130, h: 150 },
    audioIsolated: true,
  },
];

/** Creates a workspace, makes the creator the owner, and seeds channels + standard office rooms. */
export async function createWorkspace(
  ownerId: string,
  name: string,
  preset: 'standard' | 'campus-garden' = 'standard',
) {
  const targetZones = preset === 'campus-garden' ? CAMPUS_GARDEN_ZONES : DEFAULT_OFFICE_ZONES;
  return prisma.$transaction(async (tx) => {
    const workspace = await tx.workspace.create({
      data: { name, slug: slugify(name), ownerId, layout: { theme: preset } },
    });
    await tx.membership.create({
      data: { workspaceId: workspace.id, userId: ownerId, role: MemberRole.Owner },
    });
    await tx.channel.create({
      data: { workspaceId: workspace.id, scope: ChannelScope.Workspace },
    });
    for (const z of targetZones) {
      await tx.zone.create({
        data: {
          workspaceId: workspace.id,
          name: z.name,
          type: z.type,
          geometry: z.geometry,
          audioIsolated: z.audioIsolated,
        },
      });
    }
    return workspace;
  });
}

/** Clears and populates the requested office layout preset on an existing workspace. */
export async function seedDefaultZones(
  workspaceId: string,
  preset: 'standard' | 'campus-garden' = 'standard',
) {
  const targetZones = preset === 'campus-garden' ? CAMPUS_GARDEN_ZONES : DEFAULT_OFFICE_ZONES;
  return prisma.$transaction(async (tx) => {
    await tx.zone.deleteMany({ where: { workspaceId } });
    for (const z of targetZones) {
      await tx.zone.create({
        data: {
          workspaceId,
          name: z.name,
          type: z.type,
          geometry: z.geometry,
          audioIsolated: z.audioIsolated,
        },
      });
    }
    await tx.workspace.update({
      where: { id: workspaceId },
      data: { layout: { theme: preset } },
    });
    return tx.zone.findMany({ where: { workspaceId }, orderBy: { createdAt: 'asc' } });
  });
}

export async function listForUser(userId: string) {
  const memberships = await prisma.membership.findMany({
    where: { userId },
    include: { workspace: true },
    orderBy: { joinedAt: 'desc' },
  });
  return memberships.map((m) => ({ ...m.workspace, role: m.role }));
}

export async function getById(workspaceId: string) {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) throw AppError.notFound('Workspace not found');
  return workspace;
}

export async function update(
  workspaceId: string,
  data: { name?: string; layout?: Record<string, unknown> },
) {
  const prismaData: Prisma.WorkspaceUpdateInput = {
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.layout !== undefined ? { layout: data.layout as Prisma.InputJsonValue } : {}),
  };
  return prisma.workspace.update({ where: { id: workspaceId }, data: prismaData });
}

export async function remove(workspaceId: string) {
  await prisma.workspace.delete({ where: { id: workspaceId } });
}

export async function listMembers(workspaceId: string) {
  const members = await prisma.membership.findMany({
    where: { workspaceId },
    include: { user: { select: { id: true, displayName: true, email: true, avatarUrl: true } } },
  });
  return members.map((m) => ({ ...m.user, role: m.role, joinedAt: m.joinedAt }));
}

export async function updateMemberRole(workspaceId: string, userId: string, role: MemberRole) {
  const membership = await prisma.membership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
  if (!membership) throw AppError.notFound('Member not found');
  if (membership.role === MemberRole.Owner) {
    throw AppError.badRequest('Cannot change the role of the workspace owner');
  }
  return prisma.membership.update({
    where: { workspaceId_userId: { workspaceId, userId } },
    data: { role },
  });
}

export async function removeMember(workspaceId: string, userId: string) {
  const membership = await prisma.membership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
  if (!membership) throw AppError.notFound('Member not found');
  if (membership.role === MemberRole.Owner) {
    throw AppError.badRequest('Cannot remove the workspace owner');
  }
  await prisma.membership.delete({ where: { workspaceId_userId: { workspaceId, userId } } });
}

// ---- Invitations ----

export async function createInvite(workspaceId: string, email: string, role: MemberRole) {
  const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  return prisma.invite.create({
    data: { workspaceId, email, role, token, expiresAt },
  });
}

export async function acceptInvite(userId: string, token: string) {
  const invite = await prisma.invite.findUnique({ where: { token } });
  if (!invite) throw AppError.notFound('Invite not found');
  if (invite.expiresAt < new Date()) throw AppError.badRequest('Invite has expired');

  return prisma.$transaction(async (tx) => {
    await tx.membership.upsert({
      where: { workspaceId_userId: { workspaceId: invite.workspaceId, userId } },
      create: { workspaceId: invite.workspaceId, userId, role: invite.role },
      update: {},
    });
    if (!invite.acceptedAt) {
      await tx.invite.update({ where: { token }, data: { acceptedAt: new Date() } });
    }
    return tx.workspace.findUniqueOrThrow({ where: { id: invite.workspaceId } });
  });
}
