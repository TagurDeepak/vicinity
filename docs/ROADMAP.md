# Roadmap

## MVP (implemented)

- Local auth (signup/login/refresh), JWT sessions, profiles
- Workspaces, memberships, roles (owner/admin/member/guest), invites
- 2D floor with avatar movement (keyboard + click), responsive canvas
- Real-time presence, live position sync, status
- Proximity engine (union-find, audio-isolated zones)
- Zones CRUD (open/focus/meeting/lounge/private)
- Chat: workspace/zone channels + DMs, history, live delivery
- WebRTC mesh: mic/camera/screen-share, perfect negotiation, distance audio
- Health checks, rate limiting, structured logging, Docker Compose, docs

## V1 — production readiness

- Cookie-based sessions (httpOnly) + refresh rotation/revocation
- Microsoft Entra ID SSO (`AUTH_MODE=entra`)
- `aria-live` presence/chat announcements + non-canvas nearby list
- Integration + E2E test suites in CI; axe accessibility checks
- Interest management (spatial-hash rooms) for large floors
- Per-user rate limits on movement/chat; abuse moderation hooks
- Observability: OpenTelemetry traces, metrics dashboards, alerting
- Object storage wired for avatars/uploads (Azure Blob)

## V2 — scale & richness

- **SFU media** (LiveKit/mediasoup) with `POST /media/token`; auto mesh→SFU
- Spatial audio panning; noise suppression
- Collaborative whiteboard (embed tldraw/Excalidraw, then native)
- Custom floor/layout builder; multi-floor workspaces; tilemaps
- Threads, reactions, message search, file attachments
- Reservable meeting rooms with capacity limits
- Calendar/Slack status sync

## Enterprise

- SCIM provisioning; SAML/OIDC; org-wide policies
- Audit logs, retention policies, legal hold, eDiscovery export
- Consent-based recording + transcription
- Data residency / regional deployments
- Admin analytics (utilization, engagement)
- SLA, DR/backup runbooks, pen-test remediation

## Known limitations today

- Mesh media only (no SFU yet) → best for small proximity groups.
- Tokens in `localStorage` (MVP) → move to httpOnly cookies for V1.
- No integration/E2E tests yet (unit + typecheck + build only).
- Single-region assumptions; no interest management for very large floors.
