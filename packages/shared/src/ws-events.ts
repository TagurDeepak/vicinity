import { ChatMessage, PresenceState, Vec2, Zone } from './models';
import { UserStatus } from './enums';

/**
 * Strongly-typed Socket.IO event contract shared by client and server.
 *
 * Convention:
 *  - `ClientToServerEvents` are emitted by the browser.
 *  - `ServerToClientEvents` are emitted by the API/realtime service.
 * Event names are namespaced with `:` (e.g. `presence:move`).
 */

// ---- WebRTC signaling payloads ----
export interface RtcOffer {
  fromUserId: string;
  toUserId: string;
  sdp: string;
}
export interface RtcAnswer {
  fromUserId: string;
  toUserId: string;
  sdp: string;
}
/**
 * Minimal ICE candidate shape (mirrors the browser's `RTCIceCandidateInit`)
 * declared locally so this contract does not depend on the DOM lib and can be
 * imported by the Node backend as well as the browser client.
 */
export interface IceCandidateInit {
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
}

export interface RtcIceCandidate {
  fromUserId: string;
  toUserId: string;
  candidate: IceCandidateInit;
}

export type ConversationMode = 'mesh' | 'sfu';

export interface ProximityGroup {
  groupId: string;
  members: string[];
  mode: ConversationMode;
  /** Present when mode === 'sfu'; the media room to join. */
  roomName?: string;
}

// ---- Client -> Server ----
export interface ClientToServerEvents {
  'presence:join': (payload: { workspaceId: string }) => void;
  'presence:move': (payload: { position: Vec2 }) => void;
  'presence:status': (payload: { status: UserStatus }) => void;
  'zone:enter': (payload: { zoneId: string }) => void;
  'zone:leave': (payload?: { zoneId?: string }) => void;
  'chat:subscribe': (payload: { channelId: string }) => void;
  'chat:send': (payload: { channelId: string; body: string }) => void;

  // Room locking & knocking
  'room:lock': (payload: { zoneId: string }) => void;
  'room:unlock': (payload: { zoneId: string }) => void;
  'room:knock': (payload: { zoneId: string }) => void;
  'room:let-in': (payload: { zoneId: string; targetUserId: string }) => void;

  // WebRTC signaling (relayed peer-to-peer via the server)
  'rtc:offer': (payload: RtcOffer) => void;
  'rtc:answer': (payload: RtcAnswer) => void;
  'rtc:ice-candidate': (payload: RtcIceCandidate) => void;
  'rtc:call-start': (payload: { toUserId: string }) => void;
  'rtc:call-end': (payload: { toUserId: string }) => void;
  'rtc:screen-share-start': (payload: { groupId: string }) => void;
  'rtc:screen-share-stop': (payload: { groupId: string }) => void;
}

export interface LockedRoomState {
  zoneId: string;
  locked: boolean;
  lockedBy?: string;
  lockedByName?: string;
}

export interface KnockPayload {
  fromUserId: string;
  fromName: string;
  zoneId: string;
}

// ---- Server -> Client ----
export interface ServerToClientEvents {
  'presence:snapshot': (payload: { users: PresenceState[] }) => void;
  'presence:joined': (payload: PresenceState) => void;
  'presence:moved': (payload: { userId: string; position: Vec2 }) => void;
  'presence:status': (payload: { userId: string; status: UserStatus }) => void;
  'presence:zone': (payload: { userId: string; zoneId: string | null }) => void;
  'presence:left': (payload: { userId: string }) => void;

  'proximity:group': (payload: ProximityGroup) => void;
  'proximity:update': (payload: { groupId: string; members: string[] }) => void;

  'zone:updated': (payload: { zone: Zone }) => void;
  'chat:message': (payload: { channelId: string; message: ChatMessage }) => void;

  // Room locking & knocking
  'room:locked-list': (payload: Array<{ zoneId: string; lockedBy: string; lockedByName: string }>) => void;
  'room:lock-state': (payload: LockedRoomState) => void;
  'room:knocked': (payload: KnockPayload) => void;
  'room:let-in-granted': (payload: { zoneId: string; grantedBy: string }) => void;

  'rtc:offer': (payload: RtcOffer) => void;
  'rtc:answer': (payload: RtcAnswer) => void;
  'rtc:ice-candidate': (payload: RtcIceCandidate) => void;
  'rtc:call-start': (payload: { fromUserId: string }) => void;
  'rtc:call-end': (payload: { fromUserId: string }) => void;
  'rtc:screen-share-start': (payload: { fromUserId: string; groupId: string }) => void;
  'rtc:screen-share-stop': (payload: { fromUserId: string; groupId: string }) => void;

  'error': (payload: { code: string; message: string }) => void;
}
