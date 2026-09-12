import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/async-handler';
import { rateLimit } from '../../middleware/rate-limit';
import { validate } from '../../middleware/validate';
import * as authService from './auth.service';

export const authRouter = Router();

// Throttle credential endpoints to blunt brute-force / credential-stuffing.
authRouter.use(rateLimit({ name: 'auth', max: 20, windowSeconds: 60 }));

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  displayName: z.string().min(1).max(80),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

authRouter.post(
  '/signup',
  validate(signupSchema),
  asyncHandler(async (req, res) => {
    const { email, password, displayName } = req.body;
    const result = await authService.signup(email, password, displayName);
    res.status(201).json(result);
  }),
);

authRouter.post(
  '/login',
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    res.json(result);
  }),
);

authRouter.post(
  '/refresh',
  validate(refreshSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.refresh(req.body.refreshToken);
    res.json(result);
  }),
);
