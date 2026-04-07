import { useRef, useCallback } from 'react';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';

// Safety timeout: if didJustFinish never fires (e.g. audio session disrupted
// after fullscreen Modal unmounts), resolve anyway so the video can resume.
const MAX_COUNTDOWN_MS = 4500;

export function useCountdown() {
  const player = useAudioPlayer(null, { keepAudioSessionActive: true });
  const isPlayingRef = useRef(false);

  const playCountdown = useCallback(
    (onTick?: (n: number | null) => void): Promise<void> => {
      // eslint-disable-next-line no-async-promise-executor
      return new Promise(async (resolve) => {
        const tickTimers: ReturnType<typeof setTimeout>[] = [];
        let subscription: { remove: () => void } | null = null;
        let ticksScheduled = false;
        let resolved = false;
        let safetyTimer: ReturnType<typeof setTimeout> | null = null;
        let played = false;

        const cleanup = () => {
          tickTimers.forEach(clearTimeout);
          subscription?.remove();
          if (safetyTimer !== null) clearTimeout(safetyTimer);
        };

        const finish = (delay = 0) => {
          if (resolved) return;
          resolved = true;
          cleanup();
          isPlayingRef.current = false;
          onTick?.(null);
          setTimeout(resolve, delay);
        };

        // Schedule 3→2→1 at fixed 1-second intervals matching the tick sounds
        const scheduleTicks = () => {
          if (ticksScheduled) return;
          ticksScheduled = true;
          onTick?.(3);
          tickTimers.push(setTimeout(() => onTick?.(2), 1000));
          tickTimers.push(setTimeout(() => onTick?.(1), 2000));
        };

        // Safety net: if audio session is broken (e.g. inside fullscreen Modal),
        // didJustFinish may never fire — cap the wait so we never hang forever.
        safetyTimer = setTimeout(() => finish(0), MAX_COUNTDOWN_MS);

        subscription = player.addListener('playbackStatusUpdate', (status) => {
          if (status.isLoaded && !ticksScheduled) {
            scheduleTicks();
            // Belt-and-suspenders: call play() again once loaded in case the
            // earlier play() call was ignored by iOS while the session was
            // still being re-activated (common inside a full-screen Modal).
            if (!played) {
              played = true;
              try { player.play(); } catch { /* ignore */ }
            }
          }
          if (status.didJustFinish) {
            finish(500); // small delay matching original behavior
          }
        });

        try {
          // Re-activate the iOS audio session before loading the source.
          // A full-screen Modal with StatusBar hidden triggers an AVAudioSession
          // interruption that keepAudioSessionActive cannot override; calling
          // setAudioModeAsync forces the session back to active.
          await setAudioModeAsync({ playsInSilentMode: true });
          player.replace(require('../assets/sounds/countdown.m4a'));
          isPlayingRef.current = true;
          player.play();
        } catch {
          // Audio failed — fall back to fixed visual countdown only
          cleanup();
          scheduleTicks();
          safetyTimer = setTimeout(() => finish(0), 3000);
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
