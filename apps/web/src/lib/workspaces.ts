import type { Zone } from '@vicinity/shared';
import { apiFetch } from './api';

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  role: string;
  createdAt: string;
}

export interface WorkspaceMember {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  role: string;
  joinedAt: string;
}

export function listWorkspaces(): Promise<WorkspaceSummary[]> {
  return apiFetch('/workspaces');
}

export interface WorkspaceDetail {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  layout?: { theme?: 'standard' | 'campus-garden'; [key: string]: unknown };
  createdAt: string;
}

export function getWorkspace(workspaceId: string): Promise<WorkspaceDetail> {
  return apiFetch(`/workspaces/${workspaceId}`);
}

export function createWorkspace(name: string): Promise<WorkspaceSummary> {
  return apiFetch('/workspaces', { method: 'POST', body: JSON.stringify({ name }) });
}

export function listZones(workspaceId: string): Promise<Zone[]> {
  return apiFetch(`/workspaces/${workspaceId}/zones`);
}

export function applyPresetZones(
  workspaceId: string,
  preset: 'standard' | 'campus-garden' = 'standard',
): Promise<Zone[]> {
  return apiFetch(`/workspaces/${workspaceId}/zones/preset`, {
    method: 'POST',
    body: JSON.stringify({ preset }),
  });
}

export function createZone(
  workspaceId: string,
  data: {
    name: string;
    type: string;
    geometry: { x: number; y: number; w: number; h: number };
    audioIsolated?: boolean;
    isPrivate?: boolean;
  },
): Promise<Zone> {
  return apiFetch(`/workspaces/${workspaceId}/zones`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function deleteZone(workspaceId: string, zoneId: string): Promise<void> {
  return apiFetch(`/workspaces/${workspaceId}/zones/${zoneId}`, { method: 'DELETE' });
}

export function listMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  return apiFetch(`/workspaces/${workspaceId}/members`);
}

export interface InviteDto {
  id: string;
  workspaceId: string;
  email: string;
  role: string;
  token: string;
  expiresAt: string;
}

export function createInvite(
  workspaceId: string,
  email: string,
  role: string = 'member',
): Promise<InviteDto> {
  return apiFetch(`/workspaces/${workspaceId}/invites`, {
    method: 'POST',
    body: JSON.stringify({ email, role }),
  });
}

export function acceptInvite(token: string): Promise<WorkspaceDetail> {
  return apiFetch('/invites/accept', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

export interface ChatMessageDto {
  id: string;
  channelId: string;
  senderId: string;
  body: string;
  createdAt: string;
}

export interface ChannelDto {
  id: string;
  workspaceId: string;
  scope: 'workspace' | 'zone' | 'dm';
  zoneId: string | null;
}

export function listChannels(workspaceId: string): Promise<ChannelDto[]> {
  return apiFetch(`/workspaces/${workspaceId}/channels`);
}

export function getMessages(channelId: string): Promise<ChatMessageDto[]> {
  return apiFetch(`/channels/${channelId}/messages?limit=50`);
}

export function getOrCreateDm(workspaceId: string, targetUserId: string): Promise<ChannelDto> {
  return apiFetch(`/workspaces/${workspaceId}/dm`, {
    method: 'POST',
    body: JSON.stringify({ targetUserId }),
  });
}

export function clearMessages(channelId: string): Promise<void> {
  return apiFetch(`/channels/${channelId}/messages`, {
    method: 'DELETE',
  });
}
