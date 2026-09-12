# Testing

## Philosophy

Test the logic that is easy to get wrong and expensive to break: the proximity
engine, authorization, and realtime/media negotiation. Keep pure logic pure so
it can be tested without infrastructure.

## Test pyramid

```
        e2e (Playwright)         few, high-value user journeys
     integration (API+DB)        route + service behavior
   unit (pure functions/UI)      fast, many
```

## Unit tests

- **Proximity engine** — `apps/api/src/realtime/proximity.test.ts` (implemented):
  grouping within radius, no-group when far, SFU promotion past the mesh limit,
  and audio-isolated zone behavior. Pure and dependency-free.
- **UI components** — render `@vicinity/ui` primitives with React Testing Library
  (jsdom). Assert roles, labels, and `aria-*` attributes.

Run:

```bash
npm run test               # all workspaces
cd apps/api && npx jest     # backend only
```

## Integration tests (to add)

- Spin up Postgres + Redis via **Testcontainers**.
- Exercise REST routes through **supertest**: auth flow, workspace creation with
  seeded owner membership, role-guard rejections (403), chat access control.
- Gateway tests with a mock Redis adapter: `presence:join` membership check,
  `chat:subscribe` access check.

## E2E tests (to add — Playwright)

Priority journeys:

1. Sign up → create workspace → land on the floor.
2. Two browser contexts move avatars together → both receive `proximity:group`
   → media tiles appear.
3. Send a chat message → the other context receives it live.
4. Admin creates a zone → it renders for members.

Config lives under `tests/` (shared e2e). Use ephemeral test accounts and reset
the database between runs.

## Load & realtime testing (to add)

- **REST**: k6/Artillery for auth + workspace endpoints.
- **WebSocket**: a script simulating N moving avatars to validate broadcast
  fan-out and proximity-engine CPU cost per tick.
- **Media**: LiveKit/mediasoup load tooling once an SFU is introduced.

## Manual test cases

| # | Scenario                          | Expected                                       |
| - | --------------------------------- | ---------------------------------------------- |
| 1 | Move with WASD/arrows             | Avatar moves; others see it within ~100ms      |
| 2 | Click on the floor                | Avatar walks to the point                      |
| 3 | Walk next to another user         | Proximity ring overlaps; both marked "talking" |
| 4 | Grant mic, converse               | Audio connects; volume rises when closer       |
| 5 | Toggle camera                     | Remote sees your video (renegotiation)          |
| 6 | Share screen, then stop from OS   | Share starts, and auto-reverts on stop         |
| 7 | Enter an audio-isolated zone      | Only same-zone users are in the conversation   |
| 8 | Send chat                         | Message persists and appears live for others   |
| 9 | Non-member joins workspace socket | Rejected with FORBIDDEN                         |
| 10| Deny mic permission               | Presence + chat still work                     |

## CI

`.github/workflows/ci.yml` runs on every push/PR: install → Prisma generate →
lint → typecheck → unit test → build. See `docs/DEPLOYMENT.md` for release flow.
