import { create } from 'zustand';
import { PlaybackSpeed } from '../types';

interface PlayerState {
  speed: PlaybackSpeed;
  isMirror: boolean;
  loopStart: number | null;
  loopEnd: number | null;
  isCountdownEnabled: boolean;
  setSpeed: (speed: PlaybackSpeed) => void;
  toggleMirror: () => void;
  setLoopStart: (t: number | null) => void;
  setLoopEnd: (t: number | null) => void;
  clearLoop: () => void;
  toggleCountdown: () => void;
  reset: () => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  speed: 1.0,
  isMirror: false,
  loopStart: null,
  loopEnd: null,
  isCountdownEnabled: false,

  setSpeed: (speed) => set({ speed }),
  toggleMirror: () => set((s) => ({ isMirror: !s.isMirror })),
  setLoopStart: (loopStart) => set({ loopStart }),
  setLoopEnd: (loopEnd) => set({ loopEnd }),
  clearLoop: () => set({ loopStart: null, loopEnd: null }),
  toggleCountdown: () => set((s) => ({ isCountdownEnabled: !s.isCountdownEnabled })),
  reset: () =>
    set({
      speed: 1.0,
      isMirror: false,
      loopStart: null,
      loopEnd: null,
      isCountdownEnabled: false,
    }),
}));
