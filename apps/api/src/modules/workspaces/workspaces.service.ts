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

/** Creates a workspace, makes the creator the owner, and seeds a default channel + zone. */
export async function createWorkspace(ownerId: string, name: string) {
  return prisma.$transaction(async (tx) => {
    const workspace = await tx.workspace.create({
      data: { name, slug: slugify(name), ownerId },
    });
    await tx.membership.create({
      data: { workspaceId: workspace.id, userId: ownerId, role: MemberRole.Owner },
    });
    await tx.channel.create({
      data: { workspaceId: workspace.id, scope: ChannelScope.Workspace },
    });
    await tx.zone.create({
      data: {
        workspaceId: workspace.id,
        name: 'Commons',
        type: 'lounge',
        geometry: { x: 100, y: 100, w: 400, h: 300 },
      },
    });
    return workspace;
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
  if (invite.acceptedAt) throw AppError.conflict('Invite already used');
  if (invite.expiresAt < new Date()) throw AppError.badRequest('Invite has expired');

  return prisma.$transaction(async (tx) => {
    await tx.membership.upsert({
      where: { workspaceId_userId: { workspaceId: invite.workspaceId, userId } },
      create: { workspaceId: invite.workspaceId, userId, role: invite.role },
      update: {},
    });
    await tx.invite.update({ where: { token }, data: { acceptedAt: new Date() } });
    return tx.workspace.findUniqueOrThrow({ where: { id: invite.workspaceId } });
  });
}
