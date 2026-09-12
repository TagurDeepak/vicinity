# Vicinity — Documentation Index

Vicinity is an original spatial collaboration platform (virtual office). This is
the entry point to all engineering documentation.

## Start here

- [README](./README.md) — product overview, quick start, scripts
- [Architecture](./docs/ARCHITECTURE.md) — components, data/real-time/WebRTC flows, scaling
- [Roadmap](./docs/ROADMAP.md) — MVP vs V1/V2/Enterprise, known limitations

## Contracts

- [REST API](./docs/API.md) — endpoints, payloads, error model
- [WebSocket Events](./docs/WEBSOCKET_EVENTS.md) — realtime + signaling contract
- Shared types: `packages/shared/src` (single source of truth)

## Quality & operations

- [Security](./docs/SECURITY.md) — auth, authz, secrets, threat model
- [Privacy](./docs/PRIVACY.md) — data map, retention, review checklist
- [Accessibility](./docs/ACCESSIBILITY.md) — WCAG targets, implemented + todo
- [Testing](./docs/TESTING.md) — strategy, manual cases, CI
- [Deployment](./docs/DEPLOYMENT.md) — local, cloud, Azure-ready mapping

## Repository map

```
vicinity/
├── apps/web        # Next.js frontend (UI, canvas, WebRTC client)
├── apps/api        # Express + Socket.IO backend (REST, gateway, signaling)
├── packages/shared # Shared types + WS/REST contracts
├── packages/ui     # Original design-system components
├── packages/config # Shared presets
├── prisma/         # schema, migrations, seed
├── docs/           # this documentation set
├── infra/          # Dockerfiles, CI, deployment
└── scripts/        # dev helpers
```

## Originality note

Vicinity is inspired by the *category* of spatial-video offices but is an
independent implementation with its own name, design system, code, and assets.
It does not copy any competitor's UI, branding, layouts, or proprietary design.
