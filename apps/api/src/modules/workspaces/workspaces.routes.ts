import { Router } from 'express';
import { z } from 'zod';
import { MemberRole } from '@vicinity/shared';
import { asyncHandler } from '../../lib/async-handler';
import { requireAuth, requireWorkspaceRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as service from './workspaces.service';

export const workspacesRouter = Router();

const createSchema = z.object({ name: z.string().min(1).max(80) });
const updateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  layout: z.record(z.unknown()).optional(),
});
const roleSchema = z.object({ role: z.nativeEnum(MemberRole) });
const inviteSchema = z.object({
  email: z.string().email(),
  role: z.nativeEnum(MemberRole).default(MemberRole.Member),
});

// All workspace routes require authentication.
workspacesRouter.use(requireAuth);

workspacesRouter.post(
  '/',
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const workspace = await service.createWorkspace(req.user!.id, req.body.name);
    res.status(201).json(workspace);
  }),
);

workspacesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await service.listForUser(req.user!.id));
  }),
);

workspacesRouter.get(
  '/:workspaceId',
  requireWorkspaceRole(MemberRole.Guest),
  asyncHandler(async (req, res) => {
    res.json(await service.getById(req.params.workspaceId));
  }),
);

workspacesRouter.patch(
  '/:workspaceId',
  requireWorkspaceRole(MemberRole.Admin),
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    res.json(await service.update(req.params.workspaceId, req.body));
  }),
);

workspacesRouter.delete(
  '/:workspaceId',
  requireWorkspaceRole(MemberRole.Owner),
  asyncHandler(async (req, res) => {
    await service.remove(req.params.workspaceId);
    res.status(204).end();
  }),
);

// ---- Members ----
workspacesRouter.get(
  '/:workspaceId/members',
  requireWorkspaceRole(MemberRole.Guest),
  asyncHandler(async (req, res) => {
    res.json(await service.listMembers(req.params.workspaceId));
  }),
);

workspacesRouter.patch(
  '/:workspaceId/members/:userId',
  requireWorkspaceRole(MemberRole.Admin),
  validate(roleSchema),
  asyncHandler(async (req, res) => {
    res.json(
      await service.updateMemberRole(req.params.workspaceId, req.params.userId, req.body.role),
    );
  }),
);

workspacesRouter.delete(
  '/:workspaceId/members/:userId',
  requireWorkspaceRole(MemberRole.Admin),
  asyncHandler(async (req, res) => {
    await service.removeMember(req.params.workspaceId, req.params.userId);
    res.status(204).end();
  }),
);

// ---- Invites ----
workspacesRouter.post(
  '/:workspaceId/invites',
  requireWorkspaceRole(MemberRole.Member),
  validate(inviteSchema),
  asyncHandler(async (req, res) => {
    const invite = await service.createInvite(
      req.params.workspaceId,
      req.body.email,
      req.body.role,
    );
    res.status(201).json(invite);
  }),
);

// Accept lives outside the :workspaceId guard (user is not yet a member).
export const invitesRouter = Router();
invitesRouter.use(requireAuth);
invitesRouter.post(
  '/accept',
  validate(z.object({ token: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const workspace = await service.acceptInvite(req.user!.id, req.body.token);
    res.json(workspace);
  }),
);
