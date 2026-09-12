# Privacy

Privacy-by-design summary for Vicinity. This is engineering documentation, not
legal advice — have counsel review before handling real personal data.

## What data is collected

| Category            | Data                                             | Where stored          |
| ------------------- | ------------------------------------------------ | --------------------- |
| Account             | Email, display name, hashed password, avatar URL | PostgreSQL            |
| Membership          | Workspace roles, join timestamps                  | PostgreSQL            |
| Content             | Chat messages, shared links/resources             | PostgreSQL            |
| Ephemeral presence  | Avatar position, live status, current zone        | Redis (transient)     |
| Media               | Audio/video/screen streams                         | **Not stored** (P2P)  |
| Operational         | Request logs (method, path, timing)               | Log store             |

## Why it is collected

- **Account/membership**: authenticate users and enforce workspace access.
- **Content**: deliver and persist chat history for collaboration.
- **Presence**: render who is on the floor and drive proximity conversations;
  it is disposable and exists only while a user is connected.
- **Media**: peer-to-peer real-time communication; **not recorded** by default.
- **Logs**: operate, debug, and secure the service.

## Data minimization

- No tracking cookies or third-party analytics in the MVP.
- Presence data is never written to durable storage.
- Logs **redact** authorization headers, passwords, and tokens
  (`apps/api/src/lib/logger.ts`).

## Retention assumptions (configure per deployment)

| Data                | Suggested retention                         |
| ------------------- | ------------------------------------------- |
| Account             | Until account deletion                      |
| Chat messages       | Per workspace policy (e.g. 90/365 days)     |
| Presence (Redis)    | Session lifetime (safety TTL 1 hour)        |
| Request logs        | 30 days                                     |

## Personal data handling

- **Access/export**: provide a per-user export (profile + messages) — *to build*.
- **Deletion**: deleting a user cascades memberships, DM participation, and
  authored content per the Prisma schema relations. Implement a right-to-erasure
  workflow before production.
- **Media consent**: mic/camera capture only occurs after explicit browser
  permission and only when a conversation forms. If recording is added later, it
  MUST be opt-in with clear, visible consent for all participants.

## Privacy review checklist

- [ ] Data map is current and covers new features.
- [ ] Each field has a documented purpose and retention.
- [ ] PII is encrypted at rest and in transit.
- [ ] Logs contain no PII/secrets (redaction verified).
- [ ] Users can export and delete their data.
- [ ] Third-party processors (managed DB, TURN, SFU) have DPAs.
- [ ] Recording (if enabled) is opt-in with all-party consent.
- [ ] Regional data-residency requirements are met.
