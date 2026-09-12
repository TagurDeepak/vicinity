import { Prisma } from '@prisma/client';
import { ZoneType } from '@vicinity/shared';
import { AppError } from '../../lib/app-error';
import { prisma } from '../../lib/prisma';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export async function list(workspaceId: string) {
  return prisma.zone.findMany({ where: { workspaceId }, orderBy: { createdAt: 'asc' } });
}

export async function create(
  workspaceId: string,
  data: {
    name: string;
    type: ZoneType;
    geometry: Rect;
    isPrivate?: boolean;
    audioIsolated?: boolean;
  },
) {
  return prisma.zone.create({
    data: { workspaceId, ...data, geometry: data.geometry as unknown as Prisma.InputJsonValue },
  });
}

export async function update(
  workspaceId: string,
  zoneId: string,
  data: Partial<{
    name: string;
    type: ZoneType;
    geometry: Rect;
    isPrivate: boolean;
    audioIsolated: boolean;
  }>,
) {
  const zone = await prisma.zone.findUnique({ where: { id: zoneId } });
  if (!zone || zone.workspaceId !== workspaceId) throw AppError.notFound('Zone not found');
  return prisma.zone.update({
    where: { id: zoneId },
    data: { ...data, geometry: data.geometry as unknown as Prisma.InputJsonValue | undefined },
  });
}

export async function remove(workspaceId: string, zoneId: string) {
  const zone = await prisma.zone.findUnique({ where: { id: zoneId } });
  if (!zone || zone.workspaceId !== workspaceId) throw AppError.notFound('Zone not found');
  await prisma.zone.delete({ where: { id: zoneId } });
}
