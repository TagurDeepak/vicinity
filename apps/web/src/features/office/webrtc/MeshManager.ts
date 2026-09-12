import type { IceCandidateInit } from '@vicinity/shared';
import type { VicinitySocket } from '@/lib/ws';

interface PeerEntry {
  pc: RTCPeerConnection;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
}

interface MeshCallbacks {
  onRemoteStream: (userId: string, stream: MediaStream) => void;
  onRemoteLeft: (userId: string) => void;
}

/**
 * Manages a full-mesh of RTCPeerConnections for a proximity group using the
 * "perfect negotiation" pattern, which cleanly handles glare (simultaneous
 * offers) and re-negotiation when tracks are added/removed (e.g. camera on).
 *
 * The server only relays SDP/ICE — it never sees media. For groups larger than
 * MESH_MAX_PARTICIPANTS an SFU should be used instead (see docs/ARCHITECTURE.md).
 */
export class MeshManager {
  private peers = new Map<string, PeerEntry>();
  private localStream: MediaStream | null = null;

  constructor(
    private readonly socket: VicinitySocket,
    private readonly selfId: string,
    private readonly iceServers: RTCIceServer[],
    private readonly cb: MeshCallbacks,
  ) {}

  setLocalStream(stream: MediaStream | null): void {
    this.localStream = stream;
    // Attach current tracks to every existing peer.
    for (const { pc } of this.peers.values()) {
      const senders = pc.getSenders();
      stream?.getTracks().forEach((track) => {
        const existing = senders.find((s) => s.track?.kind === track.kind);
        if (existing) void existing.replaceTrack(track);
        else pc.addTrack(track, stream);
      });
    }
  }

  /** Replaces (or removes) the outgoing video track across all peers. */
  async setVideoTrack(track: MediaStreamTrack | null): Promise<void> {
    for (const { pc } of this.peers.values()) {
      const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
      if (sender) await sender.replaceTrack(track);
      else if (track && this.localStream) pc.addTrack(track, this.localStream);
    }
  }

  /** Reconciles the peer set to match the current group membership. */
  syncGroup(memberIds: string[]): void {
    const others = new Set(memberIds.filter((id) => id !== this.selfId));
    // Remove peers no longer in the group.
    for (const id of [...this.peers.keys()]) {
      if (!others.has(id)) this.closePeer(id);
    }
    // Add new peers.
    for (const id of others) {
      if (!this.peers.has(id)) this.createPeer(id);
    }
  }

  async handleOffer(fromUserId: string, sdp: string): Promise<void> {
    const entry = this.peers.get(fromUserId) ?? this.createPeer(fromUserId);
    const { pc } = entry;
    const offer = { type: 'offer' as const, sdp };
    const collision = entry.makingOffer || pc.signalingState !== 'stable';
    entry.ignoreOffer = !entry.polite && collision;
    if (entry.ignoreOffer) return;

    await pc.setRemoteDescription(offer);
    await pc.setLocalDescription();
    this.socket.emit('rtc:answer', {
      fromUserId: this.selfId,
      toUserId: fromUserId,
      sdp: pc.localDescription?.sdp ?? '',
    });
  }

  async handleAnswer(fromUserId: string, sdp: string): Promise<void> {
    const entry = this.peers.get(fromUserId);
    if (!entry) return;
    if (entry.pc.signalingState === 'have-local-offer') {
      await entry.pc.setRemoteDescription({ type: 'answer', sdp });
    }
  }

  async handleIce(fromUserId: string, candidate: IceCandidateInit): Promise<void> {
    const entry = this.peers.get(fromUserId);
    if (!entry) return;
    try {
      await entry.pc.addIceCandidate(candidate);
    } catch (err) {
      if (!entry.ignoreOffer) throw err;
    }
  }

  close(): void {
    for (const id of [...this.peers.keys()]) this.closePeer(id);
  }

  // --- internals ---

  private createPeer(peerId: string): PeerEntry {
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    // Larger id is "polite" and yields on glare; deterministic across both ends.
    const entry: PeerEntry = { pc, polite: this.selfId > peerId, makingOffer: false, ignoreOffer: false };
    this.peers.set(peerId, entry);

    // Add local tracks so onnegotiationneeded fires and starts the handshake.
    this.localStream?.getTracks().forEach((track) => pc.addTrack(track, this.localStream!));

    pc.onnegotiationneeded = async () => {
      try {
        entry.makingOffer = true;
        await pc.setLocalDescription();
        this.socket.emit('rtc:offer', {
          fromUserId: this.selfId,
          toUserId: peerId,
          sdp: pc.localDescription?.sdp ?? '',
        });
      } catch {
        /* negotiation will be retried on next change */
      } finally {
        entry.makingOffer = false;
      }
    };

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        this.socket.emit('rtc:ice-candidate', {
          fromUserId: this.selfId,
          toUserId: peerId,
          candidate: candidate.toJSON(),
        });
      }
    };

    pc.ontrack = ({ streams }) => {
      const stream = streams[0];
      if (stream) this.cb.onRemoteStream(peerId, stream);
    };

    pc.onconnectionstatechange = () => {
      if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
        // Let syncGroup/leave handle cleanup; avoid tearing down on transient blips.
      }
    };

    return entry;
  }

  private closePeer(peerId: string): void {
    const entry = this.peers.get(peerId);
    if (!entry) return;
    entry.pc.onnegotiationneeded = null;
    entry.pc.onicecandidate = null;
    entry.pc.ontrack = null;
    entry.pc.close();
    this.peers.delete(peerId);
    this.cb.onRemoteLeft(peerId);
  }
}
