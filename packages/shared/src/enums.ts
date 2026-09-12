/**
 * Shared enums used across the platform.
 * Keeping these here guarantees the frontend and backend agree on values.
 */

export enum MemberRole {
  Owner = 'owner',
  Admin = 'admin',
  Member = 'member',
  Guest = 'guest',
}

export enum UserStatus {
  Available = 'available',
  Busy = 'busy',
  InMeeting = 'in-meeting',
  Away = 'away',
}

export enum ZoneType {
  Open = 'open',
  Focus = 'focus',
  Meeting = 'meeting',
  Lounge = 'lounge',
  Private = 'private',
}

export enum ChannelScope {
  Workspace = 'workspace',
  Zone = 'zone',
  Dm = 'dm',
}
