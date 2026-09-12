import { ChannelScope, MemberRole, UserStatus, ZoneType } from './enums';

/** A 2D point on the office floor (world coordinates, not pixels). */
export interface Vec2 {
  x: number;
  y: number;
}

/** Axis-aligned rectangle used for zone geometry. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  status: UserStatus;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  createdAt: string;
}

export interface Membership {
  workspaceId: string;
  userId: string;
  role: MemberRole;
  joinedAt: string;
}

export interface Zone {
  id: string;
  workspaceId: string;
  name: string;
  type: ZoneType;
  geometry: Rect;
  isPrivate: boolean;
  audioIsolated: boolean;
}

export interface ChatMessage {
  id: string;
  channelId: string;
  senderId: string;
  body: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface Channel {
  id: string;
  workspaceId: string;
  scope: ChannelScope;
  zoneId: string | null;
}

/** Live, ephemeral presence state (stored in Redis, never persisted). */
export interface PresenceState {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  status: UserStatus;
  position: Vec2;
  zoneId: string | null;
}
