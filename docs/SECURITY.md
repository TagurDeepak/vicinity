# Security

This document describes Vicinity's security model and the controls implemented
today, plus hardening required before production use.

## Authentication

- **MVP (local mode)**: email + password. Passwords hashed with **bcrypt**
  (cost 12). Login runs bcrypt even for unknown emails to reduce user-enumeration
  timing signals.
- **Tokens**: short-lived **access JWT** (default 15 min) + longer **refresh
  JWT**. Signed with `JWT_SECRET` (HS256). Refresh tokens are typed (`type:
  'refresh'`) so an access token cannot be replayed as a refresh token.
- **Entra ID-ready**: `AUTH_MODE=entra` reserves configuration for Microsoft
  Entra ID (OIDC). The token-verification seam is centralized in
  `apps/api/src/modules/auth/tokens.ts`.

### Production hardening
- Move tokens to **httpOnly, Secure, SameSite** cookies (mitigates XSS token
  theft) and add CSRF protection for cookie-based flows.
- Add refresh-token **rotation + revocation** (store a hashed jti in Redis/DB).
- Rotate `JWT_SECRET`; support asymmetric (RS256) keys for multi-service verify.

## Authorization

- Every workspace/zone/member/settings mutation passes a **membership + role
  guard** (`requireWorkspaceRole`) evaluated **server-side** against the DB.
- Role hierarchy: `guest < member < admin < owner`.
- Chat access is checked per channel (`assertChannelAccess`): workspace/zone
  channels require membership; DM channels require participation.
- WebSocket: `presence:join` verifies membership; `chat:subscribe` verifies
  channel access before joining a room.

## Transport & data protection

- Serve everything over **HTTPS/WSS** in production (TLS terminated at the LB).
- WebRTC media is encrypted end-to-end by design (**DTLS-SRTP**).
- Use **TURN over TLS** for NAT traversal in restrictive networks.
- Encrypt data at rest via managed Postgres/Redis/Blob encryption.

## Secrets handling

- All secrets come from environment variables validated at boot
  (`apps/api/src/config/env.ts`); the process **exits** on misconfiguration.
- `.env` is git-ignored; only `.env.example` is committed.
- No secret is exposed to the browser bundle. TURN credentials are served at
  runtime via `GET /media/ice`, never inlined.
- Use a managed secret store (Azure Key Vault) in production.

## Input validation

- All request bodies/queries are validated with **Zod** schemas
  (`validate` middleware) and the parsed result replaces the raw input.
- Prisma parameterizes all queries → protects against SQL injection.
- JSON body size is capped (`express.json({ limit: '1mb' })`).

## Rate limiting & abuse prevention

- Redis fixed-window limiter (`rateLimit` middleware); credential endpoints are
  limited to 20 requests/min/IP. Fails open if Redis is unavailable.
- **To add**: per-user limits on `chat:send`, `presence:move`, and invite
  creation; connection-count caps per user; profanity/spam moderation hooks.

## HTTP hardening

- **Helmet** sets secure headers; **CORS** is restricted to `CORS_ORIGINS`.
- `trust proxy` is enabled so client IPs are correct behind a load balancer.
- Add a strict **Content-Security-Policy** and escape all user-generated chat
  content on render (React escapes by default; avoid `dangerouslySetInnerHTML`).

## Threat model (STRIDE summary)

| Threat                     | Mitigation                                             |
| -------------------------- | ------------------------------------------------------ |
| Spoofing identity          | JWT auth; `rtc:*` `fromUserId` stamped server-side     |
| Tampering with data        | Server-side role guards; Zod validation; Prisma        |
| Repudiation                | Structured request logging (extend with audit log)     |
| Information disclosure      | AuthZ on every resource; secrets never in client       |
| Denial of service          | Rate limiting; body size caps; move-event throttling   |
| Elevation of privilege      | Role hierarchy checks; owner role protected            |

## Reporting

Security issues should be reported privately to the maintainers, not via public
issues. (Add a real contact/security.txt before release.)
