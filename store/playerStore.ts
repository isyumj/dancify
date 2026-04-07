import { create } from 'zustand';
import { getSetting, setSetting } from '../db/database';
import { PlaybackSpeed } from '../types';

interface SavedSettings {
  speed: PlaybackSpeed;
  isMirror: boolean;
  isCountdownEnabled: boolean;
}

function videoSettingsKey(videoId: number) {
  return `videoSettings_${videoId}`;
}

async function persistSettings(videoId: number | null, settings: SavedSettings) {
  if (!videoId) return;
  try {
    await setSetting(videoSettingsKey(videoId), JSON.stringify(settings));
  } catch (e) {
    console.warn('[Settings] Save failed:', e);
  }
}

export async function saveVideoSettings(videoId: number) {
  const { speed, isMirror, isCountdownEnabled } = usePlayerStore.getState();
  await persistSettings(videoId, { speed, isMirror, isCountdownEnabled });
}

export async function loadVideoSettings(videoId: number) {
  try {
    const raw = await getSetting(videoSettingsKey(videoId));
    if (!raw) return;
    const saved: SavedSettings = JSON.parse(raw);
    usePlayerStore.setState({
      currentVideoId: videoId,
      speed: saved.speed ?? 1.0,
      isMirror: saved.isMirror ?? false,
      isCountdownEnabled: saved.isCountdownEnabled ?? false,
    });
  } catch (e) {
    console.warn('[Settings] Load failed:', e);
  }
}

interface PlayerState {
  currentVideoId: number | null;
  speed: PlaybackSpeed;
  isMirror: boolean;
  loopStart: number | null;
  loopEnd: number | null;
  isCountdownEnabled: boolean;
  setCurrentVideoId: (id: number | null) => void;
  setSpeed: (speed: PlaybackSpeed) => void;
  toggleMirror: () => void;
  setLoopStart: (t: number | null) => void;
  setLoopEnd: (t: number | null) => void;
  clearLoop: () => void;
  toggleCountdown: () => void;
  reset: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentVideoId: null,
  speed: 1.0,
  isMirror: false,
  loopStart: null,
  loopEnd: null,
  isCountdownEnabled: false,

  setCurrentVideoId: (id) => set({ currentVideoId: id }),
  setSpeed: (speed) => {
    set({ speed });
    const { currentVideoId, isMirror, isCountdownEnabled } = get();
    persistSettings(currentVideoId, { speed, isMirror, isCountdownEnabled });
  },
  toggleMirror: () => {
    set((s) => {
      const isMirror = !s.isMirror;
      persistSettings(s.currentVideoId, { speed: s.speed, isMirror, isCountdownEnabled: s.isCountdownEnabled });
      return { isMirror };
    });
  },
  toggleCountdown: () => {
    set((s) => {
      const isCountdownEnabled = !s.isCountdownEnabled;
      persistSettings(s.currentVideoId, { speed: s.speed, isMirror: s.isMirror, isCountdownEnabled });
      return { isCountdownEnabled };
    });
  },

  setLoopStart: (loopStart) => set({ loopStart }),
  setLoopEnd: (loopEnd) => set({ loopEnd }),
  clearLoop: () => set({ loopStart: null, loopEnd: null }),
  reset: () =>
    set({
      currentVideoId: null,
      speed: 1.0,
      isMirror: false,
      loopStart: null,
      loopEnd: null,
      isCountdownEnabled: false,
    }),
}));
