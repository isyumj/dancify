import { create } from 'zustand';
import { getSetting, setSetting } from '../db/database';
import { PlaybackSpeed } from '../types';

const SETTINGS_KEY = 'playerSettings';

interface SavedSettings {
  speed: PlaybackSpeed;
  isMirror: boolean;
  isCountdownEnabled: boolean;
}

async function persistSettings(settings: SavedSettings) {
  try {
    await setSetting(SETTINGS_KEY, JSON.stringify(settings));
    console.log('[Settings] Saved:', settings);
  } catch (e) {
    console.warn('[Settings] Save failed:', e);
  }
}

export async function loadPlayerSettings() {
  try {
    const raw = await getSetting(SETTINGS_KEY);
    console.log('[Settings] Loaded raw:', raw);
    if (!raw) return;
    const saved: SavedSettings = JSON.parse(raw);
    usePlayerStore.setState({
      speed: saved.speed ?? 1.0,
      isMirror: saved.isMirror ?? false,
      isCountdownEnabled: saved.isCountdownEnabled ?? false,
    });
    console.log('[Settings] Applied:', saved);
  } catch (e) {
    console.warn('[Settings] Load failed:', e);
  }
}

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

export const usePlayerStore = create<PlayerState>((set, get) => ({
  speed: 1.0,
  isMirror: false,
  loopStart: null,
  loopEnd: null,
  isCountdownEnabled: false,

  setSpeed: (speed) => {
    set({ speed });
    const { isMirror, isCountdownEnabled } = get();
    persistSettings({ speed, isMirror, isCountdownEnabled });
  },
  toggleMirror: () => {
    set((s) => {
      const isMirror = !s.isMirror;
      persistSettings({ speed: s.speed, isMirror, isCountdownEnabled: s.isCountdownEnabled });
      return { isMirror };
    });
  },
  toggleCountdown: () => {
    set((s) => {
      const isCountdownEnabled = !s.isCountdownEnabled;
      persistSettings({ speed: s.speed, isMirror: s.isMirror, isCountdownEnabled });
      return { isCountdownEnabled };
    });
  },

  setLoopStart: (loopStart) => set({ loopStart }),
  setLoopEnd: (loopEnd) => set({ loopEnd }),
  clearLoop: () => set({ loopStart: null, loopEnd: null }),
  reset: () =>
    set({
      speed: 1.0,
      isMirror: false,
      loopStart: null,
      loopEnd: null,
      isCountdownEnabled: false,
    }),
}));
