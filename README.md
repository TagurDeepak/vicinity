# Vicinity

> Your team's space, wherever you are.

**Vicinity** is an original spatial-collaboration platform: a 2D virtual office where
teammates appear as avatars, move around a floor, and start conversations naturally based
on **proximity** or shared **rooms/zones** — with real-time presence, chat, and
WebRTC audio/video/screen-share.

Vicinity is an independent product. It takes high-level inspiration from the _category_ of
spatial-video offices but does **not** copy any competitor's UI, branding, assets, or code.

---

## Key features

- 🔐 Auth & profiles (local/mock auth for MVP, Microsoft Entra ID–ready design)
- 🏢 Workspaces with rooms, focus / meeting / lounge / private zones
- 🕹️ Avatar movement on a 2D canvas floor (keyboard + mouse)
- 📡 Real-time presence and live position sync
- 🎯 Proximity-based conversation grouping
- 🎙️ WebRTC signaling (offer/answer/ICE) with screen-share events
- 💬 Chat: direct, room, and workspace channels with history
- 🛠️ Admin: members, roles (owner/admin/member/guest), zone management

## Tech stack

| Layer      | Technology                                          |
| ---------- | --------------------------------------------------- |
| Frontend   | Next.js 14, React 18, TypeScript, Tailwind CSS      |
| State      | Zustand + TanStack Query                            |
| Backend    | Node.js, Express, TypeScript, Socket.IO             |
| Realtime   | Socket.IO + Redis adapter                           |
| Database   | PostgreSQL + Prisma ORM                             |
| Cache      | Redis (presence + pub/sub)                          |
| Media      | WebRTC (mesh MVP), SFU-ready (LiveKit/mediasoup)    |
| Storage    | Azure Blob / S3-compatible (design-ready)           |
| Tooling    | Turborepo, ESLint, Prettier, Jest, Playwright       |

## Monorepo layout

```
vicinity/
├── apps/web        # Next.js frontend
├── apps/api        # Express + Socket.IO backend
├── packages/shared # Shared TS types + WS/REST contracts
├── packages/ui     # Original design-system components
├── packages/config # Shared eslint/tsconfig/tailwind presets
├── prisma/         # schema, migrations, seed
├── docs/           # architecture, API, security, privacy, a11y, etc.
├── infra/          # Dockerfiles, k8s, CI
└── scripts/        # dev/setup helpers
```

## Quick start

```bash
# 1. Install
npm install

# 2. Configure env
cp .env.example .env

# 3. Start Postgres + Redis
npm run docker:up

# 4. Set up the database
npm run prisma:migrate
npm run prisma:seed

# 5. Run everything
npm run dev
# web  -> http://localhost:3000
# api  -> http://localhost:4000
```

### No Docker? Zero-install local stack

If Docker/Postgres/Redis aren't available, Vicinity ships an install-free dev
mode using an embedded Postgres (real server, userland) and an in-memory Redis:

```bash
npm install
cp .env.example .env          # then set REDIS_URL=memory and point DATABASE_URL
                              # at 127.0.0.1:5432/vicinity (see .env in repo)
npm run dev:db                # starts embedded Postgres on :5432 (keep running)
npx prisma db push            # create tables
npm run prisma:seed           # demo data
npm run dev                   # web :3000 + api :4000
```

Seeded login: **ada@example.com** / **password123**.


## Scripts

| Command                 | Description                          |
| ----------------------- | ------------------------------------ |
| `npm run dev`           | Run web + api in watch mode          |
| `npm run build`         | Build all workspaces                 |
| `npm run test`          | Run unit tests                       |
| `npm run lint`          | Lint all workspaces                  |
| `npm run docker:up`     | Start Postgres + Redis               |
| `npm run prisma:migrate`| Apply DB migrations                  |

## Documentation

Full docs live in [`docs/`](./docs): architecture, API, WebSocket events, security,
privacy, accessibility, deployment, testing, and roadmap.

## License

Proprietary — internal project. Not for redistribution.
