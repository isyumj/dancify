import { create } from 'zustand';

export interface PendingImport {
  tempId: string;
  filename: string;
  duration: number;
  thumbnailUri: string | null;
  /**
   * Compression progress 0–1.
   *
   * FileSystem.copyAsync has no progress signal, so this stays at 0 and the UI
   * shows an indeterminate ActivityIndicator — the correct pattern for unknown
   * duration. When you add a real compressor (ffmpeg-kit, react-native-compressor)
   * call `useImportStore.getState().setProgress(tempId, value)` inside its progress
   * callback. Those libraries route callbacks to JS via the bridge, which is safe:
   * Zustand's `set()` dispatches to the JS thread (= @MainActor in Swift terms) and
   * React batches the re-render on the UI thread automatically.
   *
   * Example with react-native-compressor:
   *   await VideoCompressor.compress(asset.uri, options, (progress) => {
   *     useImportStore.getState().setProgress(tempId, progress); // safe from any thread
   *   });
   */
  progress: number;
}

interface ImportStore {
  pending: PendingImport[];
  /** IDs of videos just imported that haven't had first-open setup yet. */
  newVideoIds: Set<number>;

  add: (item: PendingImport) => void;
  /** Call from a compressor's progress callback to drive the UI progress value. */
  setProgress: (tempId: string, progress: number) => void;
  remove: (tempId: string) => void;
  markNew: (id: number) => void;
  /** Returns true (and removes the ID) if this video is pending first-open setup. */
  consumeNew: (id: number) => boolean;
}

export const useImportStore = create<ImportStore>((set, get) => ({
  pending: [],
  newVideoIds: new Set(),

  add: (item) => set((s) => ({ pending: [...s.pending, item] })),

  setProgress: (tempId, progress) =>
    set((s) => ({
      pending: s.pending.map((p) => (p.tempId === tempId ? { ...p, progress } : p)),
    })),

  remove: (tempId) =>
    set((s) => ({ pending: s.pending.filter((p) => p.tempId !== tempId) })),

  markNew: (id) =>
    set((s) => ({ newVideoIds: new Set([...s.newVideoIds, id]) })),

  consumeNew: (id) => {
    const { newVideoIds } = get();
    if (!newVideoIds.has(id)) return false;
    const next = new Set(newVideoIds);
    next.delete(id);
    set({ newVideoIds: next });
    return true;
  },
}));
