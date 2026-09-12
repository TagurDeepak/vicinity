import type { RequestHandler } from 'express';
import { MemberRole } from '@vicinity/shared';
import { AppError } from '../lib/app-error';
import { prisma } from '../lib/prisma';
import { verifyAccessToken } from '../modules/auth/tokens';

/** Requires a valid access token; attaches `req.user`. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(AppError.unauthorized());
    return;
  }
  try {
    const payload = verifyAccessToken(header.slice('Bearer '.length));
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch {
    next(AppError.unauthorized('Invalid or expired token'));
  }
};

const ROLE_RANK: Record<MemberRole, number> = {
  [MemberRole.Guest]: 0,
  [MemberRole.Member]: 1,
  [MemberRole.Admin]: 2,
  [MemberRole.Owner]: 3,
};

/**
 * Requires the authenticated user to be a member of the workspace referenced by
 * `:workspaceId` (route param) with at least `minRole`. Attaches nothing extra
 * but guarantees authorization before the handler runs.
 */
export function requireWorkspaceRole(minRole: MemberRole = MemberRole.Member): RequestHandler {
  return async (req, _res, next) => {
    try {
      if (!req.user) throw AppError.unauthorized();
      const workspaceId = req.params.workspaceId;
      if (!workspaceId) throw AppError.badRequest('Missing workspaceId');

      const membership = await prisma.membership.findUnique({
        where: { workspaceId_userId: { workspaceId, userId: req.user.id } },
      });
      if (!membership) throw AppError.forbidden('Not a member of this workspace');

      if (ROLE_RANK[membership.role as MemberRole] < ROLE_RANK[minRole]) {
        throw AppError.forbidden(`Requires ${minRole} role or higher`);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
