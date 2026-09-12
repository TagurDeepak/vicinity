import { Prisma } from '@prisma/client';
import { AppError } from '../../lib/app-error';
import { prisma } from '../../lib/prisma';

/**
 * Workspace settings are stored as a namespaced object inside `workspace.layout`
 * (`layout.settings`). This keeps the schema simple for the MVP while allowing a
 * dedicated table later without an API contract change.
 */
type Layout = { settings?: Record<string, unknown> } & Record<string, unknown>;

export async function getSettings(workspaceId: string) {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) throw AppError.notFound('Workspace not found');
  const layout = (workspace.layout as Layout) ?? {};
  return layout.settings ?? {};
}

export async function updateSettings(workspaceId: string, patch: Record<string, unknown>) {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) throw AppError.notFound('Workspace not found');
  const layout = (workspace.layout as Layout) ?? {};
  const nextLayout: Layout = { ...layout, settings: { ...(layout.settings ?? {}), ...patch } };
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { layout: nextLayout as Prisma.InputJsonValue },
  });
  return nextLayout.settings;
}
