import { useRef, useCallback } from 'react';
import { useAudioPlayer } from 'expo-audio';

const COUNTDOWN_DURATION_MS = 3000;

export function useCountdown() {
  const player = useAudioPlayer(null);
  const loadedRef = useRef(false);
  const isPlayingRef = useRef(false);

  const playCountdown = useCallback(
    (onTick?: (n: number | null) => void): Promise<void> => {
      return new Promise((resolve) => {
        onTick?.(3);
        setTimeout(() => onTick?.(2), 1000);
        setTimeout(() => onTick?.(1), 2000);
        setTimeout(() => {
          onTick?.(null);
          isPlayingRef.current = false;
          resolve();
        }, COUNTDOWN_DURATION_MS);

        try {
          if (!loadedRef.current) {
            player.replace(require('../assets/sounds/countdown.m4a'));
            loadedRef.current = true;
          }
          isPlayingRef.current = true;
          player.seekTo(0);
          player.play();
        } catch {
          // Audio failed — visual countdown still runs
        }
      });
    },
    [player]
  );

  const stopCountdown = useCallback(() => {
    if (!isPlayingRef.current) return;
    try { player.pause(); } catch { /* ignore */ }
    isPlayingRef.current = false;
  }, [player]);

  return { playCountdown, stopCountdown };
}
