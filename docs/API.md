# REST API

Base URL: `/api/v1` · Auth: `Authorization: Bearer <accessToken>` unless noted.

## Conventions

- Request/response bodies are JSON.
- Errors use a consistent envelope:

```json
{ "error": { "code": "FORBIDDEN", "message": "Not a member of this workspace", "details": null } }
```

- Common status codes: `400` validation, `401` unauthenticated, `403` forbidden,
  `404` not found, `409` conflict, `429` rate limited, `500` internal.

## Auth

### `POST /auth/signup`

```json
// request
{ "email": "ada@example.com", "password": "hunter2!", "displayName": "Ada" }
// 201 response
{
  "user": { "id": "…", "email": "ada@example.com", "displayName": "Ada", "avatarUrl": null },
  "accessToken": "eyJ…",
  "refreshToken": "eyJ…"
}
```

### `POST /auth/login`

```json
{ "email": "ada@example.com", "password": "hunter2!" }
```

Returns the same shape as signup. Credential routes are rate-limited (20/min/IP).

### `POST /auth/refresh`

```json
{ "refreshToken": "eyJ…" }
```

## Users

| Method | Path         | Description                    |
| ------ | ------------ | ------------------------------ |
| GET    | `/users/me`  | Current user profile           |
| PATCH  | `/users/me`  | Update `displayName`/`avatarUrl` |

```json
// PATCH /users/me
{ "displayName": "Ada L.", "avatarUrl": "https://…/a.png" }
```

## Workspaces

| Method | Path                         | Min role | Description                  |
| ------ | ---------------------------- | -------- | ---------------------------- |
| POST   | `/workspaces`                | —        | Create (creator = owner)     |
| GET    | `/workspaces`                | —        | List caller's workspaces     |
| GET    | `/workspaces/:workspaceId`   | guest    | Get one                      |
| PATCH  | `/workspaces/:workspaceId`   | admin    | Update `name`/`layout`       |
| DELETE | `/workspaces/:workspaceId`   | owner    | Delete                       |

```json
// POST /workspaces
{ "name": "Acme HQ" }
```

### Members

| Method | Path                                         | Min role | Description        |
| ------ | -------------------------------------------- | -------- | ------------------ |
| GET    | `/workspaces/:workspaceId/members`           | guest    | List members       |
| PATCH  | `/workspaces/:workspaceId/members/:userId`   | admin    | Change role        |
| DELETE | `/workspaces/:workspaceId/members/:userId`   | admin    | Remove member      |

```json
// PATCH …/members/:userId
{ "role": "admin" }
```

### Invites

| Method | Path                                 | Min role | Description        |
| ------ | ------------------------------------ | -------- | ------------------ |
| POST   | `/workspaces/:workspaceId/invites`   | admin    | Create invite      |
| POST   | `/invites/accept`                    | (auth)   | Accept via token   |

```json
// POST …/invites  ->  { "email": "grace@example.com", "role": "member" }
// POST /invites/accept  ->  { "token": "…" }
```

## Zones

| Method | Path                                       | Min role | Description   |
| ------ | ------------------------------------------ | -------- | ------------- |
| GET    | `/workspaces/:workspaceId/zones`           | guest    | List zones    |
| POST   | `/workspaces/:workspaceId/zones`           | admin    | Create zone   |
| PATCH  | `/workspaces/:workspaceId/zones/:zoneId`   | admin    | Update zone   |
| DELETE | `/workspaces/:workspaceId/zones/:zoneId`   | admin    | Delete zone   |

```json
// POST …/zones
{
  "name": "Focus Room A",
  "type": "focus",
  "geometry": { "x": 600, "y": 200, "w": 300, "h": 200 },
  "isPrivate": true,
  "audioIsolated": true
}
```

## Chat

| Method | Path                                       | Description                   |
| ------ | ------------------------------------------ | ----------------------------- |
| GET    | `/workspaces/:workspaceId/channels`        | List workspace/zone channels  |
| GET    | `/channels/:channelId/messages`            | History (`?before=&limit=`)   |
| POST   | `/channels/:channelId/messages`            | Send (persists + broadcasts)  |
| POST   | `/workspaces/:workspaceId/dm`              | Get/create DM channel         |

```json
// POST /channels/:channelId/messages
{ "body": "Standup in 5!", "metadata": {} }

// POST …/dm
{ "targetUserId": "uuid" }
```

`GET /channels/:channelId/messages?limit=50` returns messages in chronological
order; pass `before=<ISO timestamp>` to paginate backwards.

## Media

| Method | Path           | Description                                  |
| ------ | -------------- | -------------------------------------------- |
| GET    | `/media/ice`   | ICE server config (STUN/TURN) for WebRTC     |

```json
// GET /media/ice
{ "iceServers": [{ "urls": ["stun:stun.l.google.com:19302"] }] }
```

> Future: `POST /media/token` mints a short-lived, room-scoped SFU token.

## Health (unversioned)

| Method | Path        | Description                          |
| ------ | ----------- | ------------------------------------ |
| GET    | `/healthz`  | Liveness (`{ status, uptime }`)      |
| GET    | `/readyz`   | Readiness (checks DB + Redis)        |
