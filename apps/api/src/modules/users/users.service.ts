import { AppError } from '../../lib/app-error';
import { prisma } from '../../lib/prisma';

const publicUserSelect = {
  id: true,
  email: true,
  displayName: true,
  avatarUrl: true,
  createdAt: true,
} as const;

export async function getById(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: publicUserSelect });
  if (!user) throw AppError.notFound('User not found');
  return user;
}

export async function updateProfile(
  userId: string,
  data: { displayName?: string; avatarUrl?: string | null },
) {
  return prisma.user.update({
    where: { id: userId },
    data,
    select: publicUserSelect,
  });
}
