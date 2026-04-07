import { useEffect, useRef, useCallback } from 'react';
import { VideoPlayer } from 'expo-video';
import { usePlayerStore } from '../store/playerStore';
import { useCountdown } from './useCountdown';

/**
 * Wires the Zustand player state (speed, loop, countdown) to an
 * expo-video VideoPlayer instance.
 *
 * @param player  The VideoPlayer ref returned by useVideoPlayer()
 * @param duration  Video duration in seconds (0 until metadata loads)
 * @param onCountdownTick  Optional callback for visual 3-2-1 overlay
 */
export function usePlayback(
  player: VideoPlayer | null,
  duration: number,
  onCountdownTick?: (n: number | null) => void,
) {
  const { speed, loopStart, loopEnd, isCountdownEnabled } = usePlayerStore();
  const { playCountdown } = useCountdown();

  const loopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCountingDownRef = useRef(false);

  // Apply speed whenever it changes
  useEffect(() => {
    if (!player) return;
    player.playbackRate = speed;
  }, [player, speed]);

  const clearLoopTimer = useCallback(() => {
    if (loopTimerRef.current !== null) {
      clearTimeout(loopTimerRef.current);
      loopTimerRef.current = null;
    }
  }, []);

  /**
   * Seek back to start position (with optional countdown) and resume play.
   * Used for both A-B loop and full-video loop.
   */
  const restartLoop = useCallback(async (seekTarget: number) => {
    if (!player) return;
    if (isCountingDownRef.current) return;
    isCountingDownRef.current = true;  // guard set before any async work

    player.pause();
    // Seek to target immediately so ticks fired during countdown see the new position
    player.seekBy(seekTarget - (player.currentTime ?? 0));
    // Re-pause after seekBy: on iOS, AVPlayer can auto-resume after a seek.
    player.pause();

    if (isCountdownEnabled) {
      player.volume = 0;
      await playCountdown(onCountdownTick);
      // Re-pause after countdown: on iOS, setAudioModeAsync (called inside
      // playCountdown to reactivate the audio session) can trigger AVPlayer to
      // auto-resume if it was previously interrupted by the fullscreen Modal.
      player.pause();
      player.volume = 1;
    }

    player.play();
    isCountingDownRef.current = false;  // clear only after play
  }, [player, isCountdownEnabled, playCountdown, onCountdownTick]);

  // A-B loop polling
  useEffect(() => {
    if (!player || loopStart === null || loopEnd === null) {
      clearLoopTimer();
      return;
    }

    const TICK_MS = 200;
    let consecutiveAtEnd = 0;

    const tick = async () => {
      if (!player) return;
      const current = player.currentTime ?? 0;
      if (current >= loopEnd!) {
        consecutiveAtEnd++;
        if (consecutiveAtEnd >= 2) {
          consecutiveAtEnd = 0;
          await restartLoop(loopStart!);
        }
      } else {
        consecutiveAtEnd = 0;
      }
      loopTimerRef.current = setTimeout(tick, TICK_MS);
    };

    loopTimerRef.current = setTimeout(tick, TICK_MS);
    return clearLoopTimer;
  }, [player, loopStart, loopEnd, restartLoop, clearLoopTimer]);

  // Full-video loop polling (when no A-B points set)
  useEffect(() => {
    if (!player || loopStart !== null || loopEnd !== null || duration <= 0) {
      return;
    }

    const TICK_MS = 200;
    const END_THRESHOLD = 0.6; // seconds before end to trigger restart
    let consecutiveNearEnd = 0;

    let timerId: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      if (!player) return;
      const current = player.currentTime ?? 0;
      if (current >= duration - END_THRESHOLD) {
        consecutiveNearEnd++;
        if (consecutiveNearEnd >= 2) {
          consecutiveNearEnd = 0;
          await restartLoop(0);
        }
      } else {
        consecutiveNearEnd = 0;
      }
      timerId = setTimeout(tick, TICK_MS);
    };

    timerId = setTimeout(tick, TICK_MS);
    return () => {
      if (timerId !== null) clearTimeout(timerId);
    };
  }, [player, loopStart, loopEnd, duration, restartLoop]);

  return { restartLoop };
}
