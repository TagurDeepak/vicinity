import type { Socket } from 'socket.io';
import type { VicinityServer } from './broadcast';
import { userRoom } from './proximity.engine';
import type { SocketUser } from './socket-auth';

/**
 * Stateless WebRTC signaling relay. The server never touches media — it only
 * forwards SDP offers/answers and ICE candidates between peers, and relays
 * call / screen-share control events. All payloads are stamped with the
 * authenticated sender id so a client cannot spoof `fromUserId`.
 *
 * TODO(media): For groups larger than MESH_MAX_PARTICIPANTS the client should
 * connect to an SFU (LiveKit/mediasoup) using a short-lived token minted by a
 * `/media/token` endpoint instead of using this mesh relay.
 */
export function registerSignaling(io: VicinityServer, socket: Socket): void {
  const me = (socket.data.user as SocketUser).id;

  socket.on('rtc:offer', ({ toUserId, sdp }) => {
    io.to(userRoom(toUserId)).emit('rtc:offer', { fromUserId: me, toUserId, sdp });
  });

  socket.on('rtc:answer', ({ toUserId, sdp }) => {
    io.to(userRoom(toUserId)).emit('rtc:answer', { fromUserId: me, toUserId, sdp });
  });

  socket.on('rtc:ice-candidate', ({ toUserId, candidate }) => {
    io.to(userRoom(toUserId)).emit('rtc:ice-candidate', { fromUserId: me, toUserId, candidate });
  });

  socket.on('rtc:call-start', ({ toUserId }) => {
    io.to(userRoom(toUserId)).emit('rtc:call-start', { fromUserId: me });
  });

  socket.on('rtc:call-end', ({ toUserId }) => {
    io.to(userRoom(toUserId)).emit('rtc:call-end', { fromUserId: me });
  });

  socket.on('rtc:screen-share-start', ({ groupId }) => {
    socket.broadcast.emit('rtc:screen-share-start', { fromUserId: me, groupId });
  });

  socket.on('rtc:screen-share-stop', ({ groupId }) => {
    socket.broadcast.emit('rtc:screen-share-stop', { fromUserId: me, groupId });
  });
}
