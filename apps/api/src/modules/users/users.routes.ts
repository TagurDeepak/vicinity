import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/async-handler';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as usersService from './users.service';

export const usersRouter = Router();

const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(80).optional(),
  avatarUrl: z.string().url().nullable().optional(),
});

usersRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await usersService.getById(req.user!.id);
    res.json(user);
  }),
);

usersRouter.patch(
  '/me',
  requireAuth,
  validate(updateProfileSchema),
  asyncHandler(async (req, res) => {
    const user = await usersService.updateProfile(req.user!.id, req.body);
    res.json(user);
  }),
);
