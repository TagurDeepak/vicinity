import { create } from 'zustand';

interface MediaStore {
  localStream: MediaStream | null;
  /** Remote streams keyed by peer userId. */
  remote: Record<string, MediaStream>;
  micOn: boolean;
  camOn: boolean;
  sharing: boolean;
  connecting: boolean;

  setLocalStream: (s: MediaStream | null) => void;
  addRemote: (userId: string, stream: MediaStream) => void;
  removeRemote: (userId: string) => void;
  clearRemotes: () => void;
  setMic: (on: boolean) => void;
  setCam: (on: boolean) => void;
  setSharing: (on: boolean) => void;
  setConnecting: (v: boolean) => void;
}

/** Holds all live media state so the UI can render tiles and controls. */
export const useMediaStore = create<MediaStore>((set) => ({
  localStream: null,
  remote: {},
  micOn: true,
  camOn: false,
  sharing: false,
  connecting: false,

  setLocalStream: (localStream) => set({ localStream }),
  addRemote: (userId, stream) => set((s) => ({ remote: { ...s.remote, [userId]: stream } })),
  removeRemote: (userId) =>
    set((s) => {
      const next = { ...s.remote };
      delete next[userId];
      return { remote: next };
    }),
  clearRemotes: () => set({ remote: {} }),
  setMic: (micOn) => set({ micOn }),
  setCam: (camOn) => set({ camOn }),
  setSharing: (sharing) => set({ sharing }),
  setConnecting: (connecting) => set({ connecting }),
}));
