import PostHog from 'posthog-react-native';
import { PlaybackSpeed } from '../types';

let _ph: PostHog | null = null;
let _enabled = false;

export function initAnalytics(): void {
  _enabled = true;
  if (_ph) return;
  _ph = new PostHog('phc_pfhVVxL3YwTbMNDDrUTCY7A7rxGcYCisydh5j9unYNxe', {
    host: 'https://us.i.posthog.com',
    captureAppLifecycleEvents: false,
  });
}

export function disableAnalytics(): void {
  _enabled = false;
}

const ph = () => (_enabled ? _ph : null);

export const Analytics = {
  appOpened: () =>
    ph()?.capture('app_opened'),

  videoImported: (p: { duration: number; source: 'photos' | 'files'; videos_in_library: number }) =>
    ph()?.capture('video_imported', p),

  setupCompleted: (p: { mirror: boolean; countdown: boolean; speed: PlaybackSpeed; time_on_setup: number }) =>
    ph()?.capture('setup_completed', p),

  setupDismissed: (p: { videos_in_library: number; time_on_setup: number }) =>
    ph()?.capture('setup_dismissed', p),

  videoPlaybackStarted: (p: { speed: PlaybackSpeed; mirror_on: boolean; countdown_on: boolean; is_first_session: boolean }) =>
    ph()?.capture('video_playback_started', p),

  playerSessionEnd: (p: {
    duration_watched: number;
    loop_count: number;
    speed: PlaybackSpeed;
    mirror_on: boolean;
    countdown_on: boolean;
    completion_rate: number;
    exit_type: 'back' | 'background' | 'crash';
    gesture_seek_count: number;
    scrub_count: number;
    pause_count: number;
  }) => ph()?.capture('player_session_end', p),

  speedChanged: (p: { from: PlaybackSpeed; to: PlaybackSpeed; time_into_session: number }) =>
    ph()?.capture('speed_changed', p),

  gestureSeek: (p: { direction: 'backward' | 'forward' }) =>
    ph()?.capture('gesture_seek', p),

  progressBarScrubbed: (p: { position: number }) =>
    ph()?.capture('progress_bar_scrubbed', p),
};
