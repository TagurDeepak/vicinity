import bcrypt from 'bcryptjs';
import { AppError } from '../../lib/app-error';
import { prisma } from '../../lib/prisma';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from './tokens';

export interface AuthResult {
  user: { id: string; email: string; displayName: string; avatarUrl: string | null };
  accessToken: string;
  refreshToken: string;
}

const SALT_ROUNDS = 12;

export async function signup(
  email: string,
  password: string,
  displayName: string,
): Promise<AuthResult> {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw AppError.conflict('An account with this email already exists');

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: { email, passwordHash, displayName },
  });
  return issueTokens(user.id, user.email, user.displayName, user.avatarUrl);
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const user = await prisma.user.findUnique({ where: { email } });
  // Constant-ish response: always run bcrypt to reduce user-enumeration timing.
  const hash = user?.passwordHash ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinv';
  const ok = await bcrypt.compare(password, hash);
  if (!user || !user.passwordHash || !ok) {
    throw AppError.unauthorized('Invalid email or password');
  }
  return issueTokens(user.id, user.email, user.displayName, user.avatarUrl);
}

export async function refresh(refreshToken: string): Promise<AuthResult> {
  let userId: string;
  try {
    userId = verifyRefreshToken(refreshToken).sub;
  } catch {
    throw AppError.unauthorized('Invalid refresh token');
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw AppError.unauthorized('User no longer exists');
  return issueTokens(user.id, user.email, user.displayName, user.avatarUrl);
}

function issueTokens(
  id: string,
  email: string,
  displayName: string,
  avatarUrl: string | null,
): AuthResult {
  return {
    user: { id, email, displayName, avatarUrl },
    accessToken: signAccessToken({ sub: id, email }),
    refreshToken: signRefreshToken(id),
  };
}
