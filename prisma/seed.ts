/**
 * Seed script — idempotent demo data for local development.
 * Run with: npm run prisma:seed
 *
 * Creates two users, a workspace owned by the first, a few zones, the default
 * workspace chat channel, and a couple of messages. Safe to run repeatedly.
 */
import { config as loadEnv } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

// Load DATABASE_URL from the root .env (this runs outside the Prisma CLI).
loadEnv();

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash('password123', 12);

  const ada = await prisma.user.upsert({
    where: { email: 'ada@example.com' },
    update: {},
    create: { email: 'ada@example.com', displayName: 'Ada Lovelace', passwordHash },
  });

  const grace = await prisma.user.upsert({
    where: { email: 'grace@example.com' },
    update: {},
    create: { email: 'grace@example.com', displayName: 'Grace Hopper', passwordHash },
  });

  // Workspace (stable slug so re-runs are idempotent).
  const workspace = await prisma.workspace.upsert({
    where: { slug: 'demo-hq' },
    update: {},
    create: {
      name: 'Demo HQ',
      slug: 'demo-hq',
      ownerId: ada.id,
      memberships: {
        create: [
          { userId: ada.id, role: 'owner' },
          { userId: grace.id, role: 'member' },
        ],
      },
    },
  });

  // Zones (skip if the workspace already has some).
  const existingZones = await prisma.zone.count({ where: { workspaceId: workspace.id } });
  if (existingZones === 0) {
    await prisma.zone.createMany({
      data: [
        { workspaceId: workspace.id, name: 'Commons', type: 'lounge', geometry: { x: 80, y: 80, w: 420, h: 300 } },
        { workspaceId: workspace.id, name: 'Focus Row', type: 'focus', geometry: { x: 560, y: 80, w: 360, h: 240 }, audioIsolated: true },
        { workspaceId: workspace.id, name: 'Meeting Room', type: 'meeting', geometry: { x: 980, y: 80, w: 380, h: 300 }, isPrivate: true, audioIsolated: true },
      ],
    });
  }

  // Default workspace channel + welcome messages.
  let channel = await prisma.channel.findFirst({
    where: { workspaceId: workspace.id, scope: 'workspace' },
  });
  if (!channel) {
    channel = await prisma.channel.create({
      data: { workspaceId: workspace.id, scope: 'workspace' },
    });
  }

  const messageCount = await prisma.message.count({ where: { channelId: channel.id } });
  if (messageCount === 0) {
    await prisma.message.createMany({
      data: [
        { channelId: channel.id, senderId: ada.id, body: 'Welcome to Demo HQ! 👋' },
        { channelId: channel.id, senderId: grace.id, body: 'Walk over to the Commons to say hi.' },
      ],
    });
  }

  // eslint-disable-next-line no-console
  console.log('Seed complete. Login with ada@example.com / password123');
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
