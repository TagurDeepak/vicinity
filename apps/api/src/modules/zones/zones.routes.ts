import { Router } from 'express';
import { z } from 'zod';
import { MemberRole, ZoneType } from '@vicinity/shared';
import { asyncHandler } from '../../lib/async-handler';
import { requireAuth, requireWorkspaceRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as service from './zones.service';
import { seedDefaultZones } from '../workspaces/workspaces.service';

// mergeParams lets us read :workspaceId from the parent mount path.
export const zonesRouter = Router({ mergeParams: true });

const rectSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
});

const createSchema = z.object({
  name: z.string().min(1).max(80),
  type: z.nativeEnum(ZoneType).default(ZoneType.Open),
  geometry: rectSchema,
  isPrivate: z.boolean().optional(),
  audioIsolated: z.boolean().optional(),
});

const updateSchema = createSchema.partial();

zonesRouter.use(requireAuth);

zonesRouter.get(
  '/',
  requireWorkspaceRole(MemberRole.Guest),
  asyncHandler(async (req, res) => {
    res.json(await service.list(req.params.workspaceId));
  }),
);

zonesRouter.post(
  '/',
  requireWorkspaceRole(MemberRole.Admin),
  validate(createSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(await service.create(req.params.workspaceId, req.body));
  }),
);

zonesRouter.post(
  '/preset',
  requireWorkspaceRole(MemberRole.Admin),
  asyncHandler(async (req, res) => {
    res.json(await seedDefaultZones(req.params.workspaceId));
  }),
);

zonesRouter.patch(
  '/:zoneId',
  requireWorkspaceRole(MemberRole.Admin),
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    res.json(await service.update(req.params.workspaceId, req.params.zoneId, req.body));
  }),
);

zonesRouter.delete(
  '/:zoneId',
  requireWorkspaceRole(MemberRole.Admin),
  asyncHandler(async (req, res) => {
    await service.remove(req.params.workspaceId, req.params.zoneId);
    res.status(204).end();
  }),
);
