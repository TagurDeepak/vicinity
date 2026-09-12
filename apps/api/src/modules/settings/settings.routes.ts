import { Router } from 'express';
import { z } from 'zod';
import { MemberRole } from '@vicinity/shared';
import { asyncHandler } from '../../lib/async-handler';
import { requireAuth, requireWorkspaceRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as service from './settings.service';

export const settingsRouter = Router({ mergeParams: true });
settingsRouter.use(requireAuth);

settingsRouter.get(
  '/',
  requireWorkspaceRole(MemberRole.Member),
  asyncHandler(async (req, res) => {
    res.json(await service.getSettings(req.params.workspaceId));
  }),
);

settingsRouter.put(
  '/',
  requireWorkspaceRole(MemberRole.Admin),
  validate(z.record(z.unknown())),
  asyncHandler(async (req, res) => {
    res.json(await service.updateSettings(req.params.workspaceId, req.body));
  }),
);
