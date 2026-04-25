import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Animated,
  View,
  StyleSheet,
  Text,
  Alert,
  Pressable,
  TouchableOpacity,
  Modal,
  StatusBar,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { getVideo, insertVideo, updateVideoDuration, updateVideoThumbnail, getSetting, setSetting } from '../db/database';
import { getThumbnailAsync } from 'expo-video-thumbnails';
import * as FileSystem from 'expo-file-system/legacy';
import { Video } from '../types';
import { usePlayerStore, loadVideoSettings, saveVideoSettings } from '../store/playerStore';
import { usePlayback } from '../hooks/usePlayback';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { PlayerControls } from '../components/PlayerControls';
import { SetupSheet } from '../components/SetupSheet';
import { Colors } from '../constants/theme';

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function PlayerScreen() {
  const { videoId, tempPath, filename: filenameParam, duration: durationParam, isNew } =
    useLocalSearchParams<{
      videoId?: string;
      tempPath?: string;
      filename?: string;
      duration?: string;
      /** Set by the library when opening a newly background-imported video for the first time. */
      isNew?: string;
    }>();

  const isNewImport = !!tempPath;
  const insets = useSafeAreaInsets();

  const [video, setVideo] = useState<Video | null>(null);
  // Show setup sheet for legacy tempPath imports OR first open of background imports
  const [setupVisible, setSetupVisible] = useState(isNewImport || isNew === 'true');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fsBarWidthRef = useRef(1);
  const fsDragging = useRef(false);
  const fsFillAnim = useRef(new Animated.Value(0)).current;
  const smBarWidthRef = useRef(1);
  const smDragging = useRef(false);
  const smFillAnim = useRef(new Animated.Value(0)).current;
  const [countdownNum, setCountdownNum] = useState<number | null>(null);

  const { t } = useTranslation();
  const isMirror = usePlayerStore((s) => s.isMirror);
  const setCurrentVideoId = usePlayerStore((s) => s.setCurrentVideoId);

  // One-time hint flags (null = not yet checked from storage)
  const [coachMarkAllowed, setCoachMarkAllowed] = useState<boolean | null>(null);
  const [fsOnboardingAllowed, setFsOnboardingAllowed] = useState<boolean | null>(null);

  // Coach mark (one-time onboarding hint)
  const [showCoachMark, setShowCoachMark] = useState(false);
  const coachMarkOpacity = useRef(new Animated.Value(0)).current;
  const coachMarkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Play icon overlay animation
  const [showPlayIcon, setShowPlayIcon] = useState(false);
  const playIconScale = useRef(new Animated.Value(1)).current;
  const playIconOpacity = useRef(new Animated.Value(0)).current;

  // Fullscreen onboarding overlay (double-tap seek hint)
  const [showFsOnboarding, setShowFsOnboarding] = useState(false);
  const fsOnboardingOpacity = useRef(new Animated.Value(0)).current;
  const rippleLeftScale = useRef(new Animated.Value(0.3)).current;
  const rippleLeftOpacity = useRef(new Animated.Value(0)).current;
  const rippleRightScale = useRef(new Animated.Value(0.3)).current;
  const rippleRightOpacity = useRef(new Animated.Value(0)).current;
  const fsOnboardingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fsOnboardingStaggerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rippleAnimLeftRef = useRef<Animated.CompositeAnimation | null>(null);
  const rippleAnimRightRef = useRef<Animated.CompositeAnimation | null>(null);

  // Double-tap seek (fullscreen)
  const lastTapTimeRef = useRef<number>(0);
  const fsTapWidthRef = useRef<number>(1);
  const fsSingleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seekIndicatorOpacity = useRef(new Animated.Value(0)).current;
  const [seekFeedback, setSeekFeedback] = useState<'left' | 'right' | null>(null);

  // Double-tap seek (small screen)
  const smLastTapTimeRef = useRef<number>(0);
  const smTapWidthRef = useRef<number>(1);
  const smSingleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const smSeekIndicatorOpacity = useRef(new Animated.Value(0)).current;
  const [smSeekFeedback, setSmSeekFeedback] = useState<'left' | 'right' | null>(null);

  useEffect(() => {
    if (tempPath && filenameParam) {
      const dur = parseFloat(durationParam ?? '0');
      setVideo({
        id: 0,
        filename: filenameParam,
        duration: dur,
        localPath: tempPath,
        createdAt: new Date().toISOString(),
      });
      if (dur > 0) setDuration(dur);
    } else if (videoId) {
      const vidId = parseInt(videoId, 10);
      getVideo(vidId).then((v) => {
        if (!v) {
          Alert.alert(t('player.error'), t('player.videoNotFound'), [{ text: t('player.back'), onPress: () => router.back() }]);
          return;
        }
        setVideo(v);
        if (v.duration > 0) setDuration(v.duration);
        setCurrentVideoId(v.id);
        loadVideoSettings(v.id);
      });
    }
  }, [videoId, tempPath, filenameParam, durationParam]);

  const player = useVideoPlayer(video?.localPath ?? null, (p) => {
    p.loop = false;
    p.play();
  });

  const dismissFsOnboarding = useCallback(() => {
    if (fsOnboardingTimerRef.current) {
      clearTimeout(fsOnboardingTimerRef.current);
      fsOnboardingTimerRef.current = null;
    }
    if (fsOnboardingStaggerRef.current) {
      clearTimeout(fsOnboardingStaggerRef.current);
      fsOnboardingStaggerRef.current = null;
    }
    rippleAnimLeftRef.current?.stop();
    rippleAnimRightRef.current?.stop();
    Animated.timing(fsOnboardingOpacity, { toValue: 0, duration: 300, useNativeDriver: true })
      .start(() => setShowFsOnboarding(false));
  }, [fsOnboardingOpacity]);

  const dismissCoachMark = useCallback(() => {
    if (!showCoachMark) return;
    if (coachMarkTimerRef.current) {
      clearTimeout(coachMarkTimerRef.current);
      coachMarkTimerRef.current = null;
    }
    Animated.timing(coachMarkOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
      setShowCoachMark(false);
    });
  }, [showCoachMark, coachMarkOpacity]);

  // On mount: read both "has seen" flags from persistent storage
  useEffect(() => {
    (async () => {
      const [cm, fs] = await Promise.all([
        getSetting('hasSeenCoachMark'),
        getSetting('hasSeenFsOnboarding'),
      ]);
      if (!cm) {
        setSetting('hasSeenCoachMark', '1').catch(() => {});
        setCoachMarkAllowed(true);
      } else {
        setCoachMarkAllowed(false);
      }
      setFsOnboardingAllowed(!fs);
    })();
  }, []);

  useEffect(() => {
    if (!isFullscreen || fsOnboardingAllowed !== true) return;

    // Mark as seen so it won't show again
    setSetting('hasSeenFsOnboarding', '1').catch(() => {});
    setFsOnboardingAllowed(false);

    setShowFsOnboarding(true);
    fsOnboardingOpacity.setValue(1);

    const leftAnim = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(rippleLeftScale, { toValue: 0.3, duration: 0, useNativeDriver: true }),
          Animated.timing(rippleLeftScale, { toValue: 1.8, duration: 1500, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(rippleLeftOpacity, { toValue: 0.8, duration: 0, useNativeDriver: true }),
          Animated.timing(rippleLeftOpacity, { toValue: 0, duration: 1500, useNativeDriver: true }),
        ]),
      ])
    );
    const rightAnim = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(rippleRightScale, { toValue: 0.3, duration: 0, useNativeDriver: true }),
          Animated.timing(rippleRightScale, { toValue: 1.8, duration: 1500, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(rippleRightOpacity, { toValue: 0.8, duration: 0, useNativeDriver: true }),
          Animated.timing(rippleRightOpacity, { toValue: 0, duration: 1500, useNativeDriver: true }),
        ]),
      ])
    );
    rippleAnimLeftRef.current = leftAnim;
    rippleAnimRightRef.current = rightAnim;

    leftAnim.start();
    rightAnim.start();

    fsOnboardingTimerRef.current = setTimeout(() => {
      fsOnboardingTimerRef.current = null;
      Animated.timing(fsOnboardingOpacity, { toValue: 0, duration: 400, useNativeDriver: true })
        .start(() => {
          setShowFsOnboarding(false);
          leftAnim.stop();
          rightAnim.stop();
        });
    }, 3000);

    return () => {
      if (fsOnboardingTimerRef.current) {
        clearTimeout(fsOnboardingTimerRef.current);
        fsOnboardingTimerRef.current = null;
      }
      if (fsOnboardingStaggerRef.current) {
        clearTimeout(fsOnboardingStaggerRef.current);
        fsOnboardingStaggerRef.current = null;
      }
      leftAnim.stop();
      rightAnim.stop();
    };
  }, [isFullscreen, fsOnboardingAllowed]);

  useEffect(() => {
    if (coachMarkAllowed !== true) return;
    setShowCoachMark(true);
    Animated.timing(coachMarkOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start(() => {
      coachMarkTimerRef.current = setTimeout(() => {
        Animated.timing(coachMarkOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
          setShowCoachMark(false);
        });
      }, 3000);
    });
  }, [coachMarkAllowed]);

  useEffect(() => {
    if (!player) return;
    const id = setInterval(() => {
      setCurrentTime(player.currentTime ?? 0);
      const d = player.duration ?? 0;
      if (d > 0 && d !== duration) {
        setDuration(d);
        if (video && video.id > 0 && video.duration === 0) {
          updateVideoDuration(video.id, d).catch(console.error);
        }
      }
      setIsPlaying(player.playing);
    }, 250);
    return () => clearInterval(id);
  }, [player, duration, video]);

  usePlayback(player, duration, setCountdownNum);

  // Keep screen awake while playing; restore auto-lock when paused or unmounted
  useEffect(() => {
    if (isPlaying) {
      activateKeepAwakeAsync();
    } else {
      deactivateKeepAwake();
    }
    return () => { deactivateKeepAwake(); };
  }, [isPlaying]);

  // Keep progress fills in sync with video when not dragging
  useEffect(() => {
    if (duration > 0) {
      const ratio = currentTime / duration;
      if (!fsDragging.current) fsFillAnim.setValue(ratio);
      if (!smDragging.current) smFillAnim.setValue(ratio);
    }
  }, [currentTime, duration, fsFillAnim, smFillAnim]);

  const handleSeek = useCallback(
    (time: number) => {
      if (!player) return;
      player.seekBy(time - (player.currentTime ?? 0));
    },
    [player]
  );

  const handleFsSeek = useCallback(
    (ratio: number) => {
      if (!player || duration === 0) return;
      player.seekBy(ratio * duration - (player.currentTime ?? 0));
    },
    [player, duration]
  );

  const handleVideoTap = useCallback(() => {
    if (!player) return;
    if (player.playing) {
      player.pause();
      playIconScale.setValue(0.7);
      playIconOpacity.setValue(0);
      setShowPlayIcon(true);
      Animated.parallel([
        Animated.spring(playIconScale, { toValue: 1, useNativeDriver: true, friction: 6 }),
        Animated.timing(playIconOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    } else {
      player.play();
      Animated.parallel([
        Animated.timing(playIconScale, { toValue: 1.6, duration: 350, useNativeDriver: true }),
        Animated.timing(playIconOpacity, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]).start(() => setShowPlayIcon(false));
    }
  }, [player, playIconScale, playIconOpacity]);

  const handleSetupDone = async () => {
    if (isNewImport && video && video.id === 0) {
      // Legacy tempPath flow: video not yet in DB — insert now
      const id = await insertVideo(video.filename, duration || video.duration, video.localPath);
      setVideo({ ...video, id });
      setCurrentVideoId(id);
      await saveVideoSettings(id);
      // Generate thumbnail in background — don't block setup completion
      getThumbnailAsync(video.localPath, { time: 0 })
        .then((result: { uri: string }) => updateVideoThumbnail(id, result.uri))
        .catch(() => {});
    } else if (video && video.id > 0) {
      // Background import flow (isNew) or re-opened video:
      // video is already in DB, just save the user's chosen settings
      setCurrentVideoId(video.id);
      await saveVideoSettings(video.id);
    }
    setSetupVisible(false);
  };

  const handleSmTap = useCallback((locationX: number) => {
    if (showCoachMark) dismissCoachMark();
    const now = Date.now();
    if (now - smLastTapTimeRef.current < 300) {
      if (smSingleTapTimerRef.current) {
        clearTimeout(smSingleTapTimerRef.current);
        smSingleTapTimerRef.current = null;
      }
      const w = smTapWidthRef.current;
      const isLeft = locationX < w * 2 / 5;
      const isRight = locationX > w * 3 / 5;
      if (isLeft || isRight) {
        player?.seekBy(isLeft ? -5 : 5);
        smSeekIndicatorOpacity.setValue(0);
        setSmSeekFeedback(isLeft ? 'left' : 'right');
        Animated.sequence([
          Animated.timing(smSeekIndicatorOpacity, { toValue: 1, duration: 80, useNativeDriver: true }),
          Animated.timing(smSeekIndicatorOpacity, { toValue: 0, duration: 620, useNativeDriver: true }),
        ]).start(({ finished }) => { if (finished) setSmSeekFeedback(null); });
      }
      smLastTapTimeRef.current = 0;
    } else {
      smLastTapTimeRef.current = now;
      smSingleTapTimerRef.current = setTimeout(() => {
        smSingleTapTimerRef.current = null;
        handleVideoTap();
      }, 300);
    }
  }, [player, smSeekIndicatorOpacity, handleVideoTap, showCoachMark, dismissCoachMark]);

  const handleFsTap = useCallback((locationX: number) => {
    const now = Date.now();
    if (now - lastTapTimeRef.current < 300) {
      // Double tap — seek
      if (fsSingleTapTimerRef.current) {
        clearTimeout(fsSingleTapTimerRef.current);
        fsSingleTapTimerRef.current = null;
      }
      const w = fsTapWidthRef.current;
      const isLeft = locationX < w * 2 / 5;
      const isRight = locationX > w * 3 / 5;
      if (isLeft || isRight) {
        player?.seekBy(isLeft ? -5 : 5);
        seekIndicatorOpacity.setValue(0);
        setSeekFeedback(isLeft ? 'left' : 'right');
        Animated.sequence([
          Animated.timing(seekIndicatorOpacity, { toValue: 1, duration: 80, useNativeDriver: true }),
          Animated.timing(seekIndicatorOpacity, { toValue: 0, duration: 620, useNativeDriver: true }),
        ]).start(({ finished }) => { if (finished) setSeekFeedback(null); });
      }
      lastTapTimeRef.current = 0;
    } else {
      lastTapTimeRef.current = now;
      // Single tap — toggle play/pause after confirming no second tap
      fsSingleTapTimerRef.current = setTimeout(() => {
        fsSingleTapTimerRef.current = null;
        handleVideoTap();
      }, 300);
    }
  }, [player, seekIndicatorOpacity, handleVideoTap]);

  const handleSetupCancel = async () => {
    if (tempPath) {
      try { await FileSystem.deleteAsync(tempPath, { idempotent: true }); } catch {}
    }
    router.back();
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />

      {/* 自定义顶部栏 */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          {video ? video.filename.replace(/\.[^.]+$/, '') : t('player.title')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* 视频 */}
      <View style={styles.videoWrapper}>
        {video ? (
          // Keep VideoView always mounted to avoid iOS audio session interruption
          // when the native AVPlayerLayer is destroyed. Use opacity:0 + pointerEvents
          // to hide it while the fullscreen Modal is shown instead of unmounting it.
          <VideoView
            player={player}
            style={[styles.video, isMirror && styles.mirrored, isFullscreen && styles.hidden]}
            nativeControls={false}
            contentFit="contain"
            pointerEvents="none"
          />
        ) : (
          <View style={styles.videoPlaceholder}>
            <Text style={{ color: '#666' }}>{t('player.loading')}</Text>
          </View>
        )}
        {showPlayIcon && (
          <Animated.View
            style={[styles.playIconOverlay, { opacity: playIconOpacity, transform: [{ scale: playIconScale }] }]}
            pointerEvents="none"
          >
            <Ionicons name="play" size={72} color="rgba(255,255,255,0.92)" />
          </Animated.View>
        )}
        {countdownNum !== null && (
          <View style={styles.countdownOverlay}>
            <Text style={styles.countdownText}>{countdownNum}</Text>
          </View>
        )}
        {!isFullscreen && (
          <Pressable
            style={StyleSheet.absoluteFill}
            onLayout={(e) => { smTapWidthRef.current = e.nativeEvent.layout.width; }}
            onPress={(e) => handleSmTap(e.nativeEvent.locationX)}
          />
        )}
        {/* 小屏双击 seek 提示 */}
        {smSeekFeedback && (
          <Animated.View
            style={[
              styles.fsSeekIndicator,
              smSeekFeedback === 'left' ? styles.fsSeekLeft : styles.fsSeekRight,
              { opacity: smSeekIndicatorOpacity },
            ]}
            pointerEvents="none"
          >
            <Ionicons
              name={smSeekFeedback === 'left' ? 'play-back' : 'play-forward'}
              size={26}
              color="#fff"
            />
            <Text style={styles.fsSeekText}>
              {smSeekFeedback === 'left' ? t('player.seekBack') : t('player.seekForward')}
            </Text>
          </Animated.View>
        )}
        {/* 新手引导提示 */}
        {showCoachMark && (
          <Animated.View style={[styles.coachMark, { opacity: coachMarkOpacity }]} pointerEvents="none">
            <MaterialCommunityIcons name="play-pause" size={48} color="rgba(255,255,255,0.9)" />
            <Text style={styles.coachMarkText}>{t('player.coachMark')}</Text>
          </Animated.View>
        )}
      </View>

      {/* 控制栏 + 进度条 + 操作区（统一底色） */}
      <View style={styles.bottomArea}>
      {/* 控制栏 */}
      <View style={styles.controlRow}>
        <Text style={styles.timeLabel}>{fmt(currentTime)} / {fmt(duration)}</Text>
        <TouchableOpacity onPress={() => setIsFullscreen(true)} activeOpacity={0.7} style={styles.fsBtn}>
          <Ionicons name="expand" size={20} color="#aaa" />
        </TouchableOpacity>
      </View>

      {/* 小屏进度条 */}
      <View
        style={styles.smProgressTouchArea}
        onLayout={(e) => { smBarWidthRef.current = e.nativeEvent.layout.width; }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => {
          smDragging.current = true;
          const ratio = Math.max(0, Math.min(1, e.nativeEvent.locationX / smBarWidthRef.current));
          smFillAnim.setValue(ratio);
        }}
        onResponderMove={(e) => {
          const ratio = Math.max(0, Math.min(1, e.nativeEvent.locationX / smBarWidthRef.current));
          smFillAnim.setValue(ratio);
        }}
        onResponderRelease={(e) => {
          const ratio = Math.max(0, Math.min(1, e.nativeEvent.locationX / smBarWidthRef.current));
          smDragging.current = false;
          if (player && duration > 0) {
            player.seekBy(ratio * duration - (player.currentTime ?? 0));
          }
        }}
        onResponderTerminate={() => { smDragging.current = false; }}
        onResponderTerminationRequest={() => false}
      >
        <View style={styles.smProgressTrack}>
          <Animated.View
            style={[
              styles.smProgressFill,
              {
                width: smFillAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
          <Animated.View
            style={[
              styles.smProgressThumb,
              {
                left: smFillAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>
      </View>

      <PlayerControls />
      </View>

      <SetupSheet
        visible={setupVisible}
        onDone={handleSetupDone}
        onCancel={isNewImport ? handleSetupCancel : undefined}
      />


      {/* 全屏 Modal */}
      <Modal
        visible={isFullscreen}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setIsFullscreen(false)}
      >
        <StatusBar hidden />
        <View style={styles.fsContainer}>
          {video && (
            <VideoView
              player={player}
              style={[styles.fsVideo, isMirror && styles.mirrored]}
              nativeControls={false}
              contentFit="contain"
            />
          )}

          {/* 播放图标浮层（全屏复用） */}
          {showPlayIcon && (
            <Animated.View
              style={[styles.playIconOverlay, { opacity: playIconOpacity, transform: [{ scale: playIconScale }] }]}
              pointerEvents="none"
            >
              <Ionicons name="play" size={72} color="rgba(255,255,255,0.92)" />
            </Animated.View>
          )}

          {/* 单击暂停/播放 + 双击快退/快进手势层 */}
          <Pressable
            style={styles.fsTapOverlay}
            onLayout={(e) => { fsTapWidthRef.current = e.nativeEvent.layout.width; }}
            onPress={(e) => handleFsTap(e.nativeEvent.locationX)}
          />

          {/* 双击 seek 提示 */}
          {seekFeedback && (
            <Animated.View
              style={[
                styles.fsSeekIndicator,
                seekFeedback === 'left' ? styles.fsSeekLeft : styles.fsSeekRight,
                { opacity: seekIndicatorOpacity },
              ]}
            >
              <Ionicons
                name={seekFeedback === 'left' ? 'play-back' : 'play-forward'}
                size={26}
                color="#fff"
              />
              <Text style={styles.fsSeekText}>
                {seekFeedback === 'left' ? t('player.seekBack') : t('player.seekForward')}
              </Text>
            </Animated.View>
          )}

          {countdownNum !== null && (
            <View style={styles.countdownOverlay}>
              <Text style={styles.countdownText}>{countdownNum}</Text>
            </View>
          )}

          {/* 全屏双击 Onboarding Overlay */}
          {showFsOnboarding && (
            <Pressable style={StyleSheet.absoluteFill} onPress={dismissFsOnboarding}>
              <Animated.View style={[styles.fsOnboardingOverlay, { opacity: fsOnboardingOpacity }]}>
                <View style={[styles.fsOnboardingHint, styles.fsOnboardingHintLeft]}>
                  <View style={styles.rippleContainer}>
                    <Animated.View
                      style={[styles.rippleCircle, {
                        transform: [{ scale: rippleLeftScale }],
                        opacity: rippleLeftOpacity,
                      }]}
                    />
                  </View>
                  <Text style={styles.fsOnboardingValue}>{t('player.seekBack')}</Text>
                </View>
                <View style={[styles.fsOnboardingHint, styles.fsOnboardingHintRight]}>
                  <View style={styles.rippleContainer}>
                    <Animated.View
                      style={[styles.rippleCircle, {
                        transform: [{ scale: rippleRightScale }],
                        opacity: rippleRightOpacity,
                      }]}
                    />
                  </View>
                  <Text style={styles.fsOnboardingValue}>{t('player.seekForward')}</Text>
                </View>
              </Animated.View>
            </Pressable>
          )}

          {/* 全屏底部控制栏 */}
          <View style={[styles.fsControls, { paddingBottom: insets.bottom + 12 }]}>
            <Text style={styles.fsTime}>{fmt(currentTime)}</Text>

            {/* 进度条 */}
            <View
              style={styles.fsProgressTouchArea}
              onLayout={(e) => { fsBarWidthRef.current = e.nativeEvent.layout.width; }}
              onStartShouldSetResponder={() => true}
              onMoveShouldSetResponder={() => true}
              onResponderGrant={(e) => {
                fsDragging.current = true;
                const ratio = Math.max(0, Math.min(1, e.nativeEvent.locationX / fsBarWidthRef.current));
                fsFillAnim.setValue(ratio);
              }}
              onResponderMove={(e) => {
                const ratio = Math.max(0, Math.min(1, e.nativeEvent.locationX / fsBarWidthRef.current));
                fsFillAnim.setValue(ratio);
              }}
              onResponderRelease={(e) => {
                const ratio = Math.max(0, Math.min(1, e.nativeEvent.locationX / fsBarWidthRef.current));
                fsDragging.current = false;
                handleFsSeek(ratio);
              }}
              onResponderTerminate={() => { fsDragging.current = false; }}
              onResponderTerminationRequest={() => false}
            >
              <View style={styles.fsProgressTrack}>
                <Animated.View
                  style={[
                    styles.fsProgressFill,
                    {
                      width: fsFillAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
              </View>
            </View>

            <Text style={styles.fsTime}>{fmt(duration)}</Text>

            <TouchableOpacity onPress={() => setIsFullscreen(false)} activeOpacity={0.7}>
              <Ionicons name="contract" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  bottomArea: { flex: 1, backgroundColor: '#000' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  headerSpacer: { width: 36 },

  videoWrapper: {
    width: '100%',
    height: '50%',
    backgroundColor: '#000',
  },
  video: { width: '100%', height: '100%' },
  hidden: { opacity: 0 },
  mirrored: { transform: [{ scaleX: -1 }] },
  videoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIconOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  countdownText: {
    color: '#fff',
    fontSize: 96,
    fontWeight: '700',
  },

  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
  },
  timeLabel: {
    color: '#aaa',
    fontSize: 13,
    flex: 1,
  },
  fsBtn: {
    flex: 1,
    alignItems: 'flex-end',
    padding: 4,
  },

  // 全屏
  fsContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  fsVideo: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  fsControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    gap: 10,
  },
  fsPlayBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fsTime: {
    color: '#fff',
    fontSize: 12,
    minWidth: 38,
    textAlign: 'center',
  },
  fsProgressTouchArea: {
    flex: 1,
    height: 44,
    justifyContent: 'center',
  },
  fsProgressTrack: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    overflow: 'visible',
  },
  fsProgressFill: {
    height: '100%',
    backgroundColor: Colors.brandPrimary,
    borderRadius: 2,
  },

  // 小屏进度条
  smProgressTouchArea: {
    height: 52,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  smProgressTrack: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    overflow: 'visible',
  },
  smProgressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  smProgressThumb: {
    position: 'absolute',
    top: '50%',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#fff',
    marginTop: -7,
    marginLeft: -7,
  },

  fsTapOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  fsSeekIndicator: {
    position: 'absolute',
    top: '40%',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 40,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  fsSeekLeft: { left: '10%' },
  fsSeekRight: { right: '10%' },
  fsSeekText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },

  fsOnboardingOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  fsOnboardingHint: {
    position: 'absolute',
    top: '40%',
    alignItems: 'center',
    gap: 6,
  },
  fsOnboardingHintLeft: {
    left: '10%',
  },
  fsOnboardingHintRight: {
    right: '10%',
  },
  rippleContainer: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rippleCircle: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  fsOnboardingValue: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },

  coachMark: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  coachMarkText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 17,
    fontWeight: '600',
  },
});
