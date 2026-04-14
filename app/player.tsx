import React, { useEffect, useRef, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { getVideo, insertVideo, updateVideoDuration } from '../db/database';
import * as FileSystem from 'expo-file-system/legacy';
import { Video } from '../types';
import { usePlayerStore, loadVideoSettings, saveVideoSettings } from '../store/playerStore';
import { usePlayback } from '../hooks/usePlayback';
import { Ionicons } from '@expo/vector-icons';
import { PlayerControls } from '../components/PlayerControls';
import { SetupSheet } from '../components/SetupSheet';
import { Colors } from '../constants/theme';

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function PlayerScreen() {
  const { videoId, tempPath, filename: filenameParam, duration: durationParam } =
    useLocalSearchParams<{
      videoId?: string;
      tempPath?: string;
      filename?: string;
      duration?: string;
    }>();

  const isNewImport = !!tempPath;
  const insets = useSafeAreaInsets();

  const [video, setVideo] = useState<Video | null>(null);
  const [setupVisible, setSetupVisible] = useState(isNewImport);
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

  const isMirror = usePlayerStore((s) => s.isMirror);
  const setCurrentVideoId = usePlayerStore((s) => s.setCurrentVideoId);

  // Coach mark (one-time onboarding hint)
  const [showCoachMark, setShowCoachMark] = useState(false);
  const coachMarkOpacity = useRef(new Animated.Value(0)).current;
  const coachMarkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Play icon overlay animation
  const [showPlayIcon, setShowPlayIcon] = useState(false);
  const playIconScale = useRef(new Animated.Value(1)).current;
  const playIconOpacity = useRef(new Animated.Value(0)).current;

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
          Alert.alert('错误', '视频不存在', [{ text: '返回', onPress: () => router.back() }]);
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

  const dismissCoachMark = useCallback(() => {
    if (!showCoachMark) return;
    if (coachMarkTimerRef.current) {
      clearTimeout(coachMarkTimerRef.current);
      coachMarkTimerRef.current = null;
    }
    Animated.timing(coachMarkOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
      setShowCoachMark(false);
      AsyncStorage.setItem('onboarding_player_seen', '1');
    });
  }, [showCoachMark, coachMarkOpacity]);

  useEffect(() => {
    AsyncStorage.getItem('onboarding_player_seen').then((val) => {
      if (val) return;
      setShowCoachMark(true);
      Animated.timing(coachMarkOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start(() => {
        coachMarkTimerRef.current = setTimeout(() => {
          Animated.timing(coachMarkOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
            setShowCoachMark(false);
            AsyncStorage.setItem('onboarding_player_seen', '1');
          });
        }, 3000);
      });
    });
  }, []);

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
      const id = await insertVideo(video.filename, duration || video.duration, video.localPath);
      setVideo({ ...video, id });
      setCurrentVideoId(id);
      await saveVideoSettings(id);
    }
    setSetupVisible(false);
  };

  const handleSmTap = useCallback((locationX: number) => {
    const now = Date.now();
    if (now - smLastTapTimeRef.current < 300) {
      if (smSingleTapTimerRef.current) {
        clearTimeout(smSingleTapTimerRef.current);
        smSingleTapTimerRef.current = null;
      }
      const isLeft = locationX < smTapWidthRef.current / 2;
      player?.seekBy(isLeft ? -5 : 5);
      setSmSeekFeedback(isLeft ? 'left' : 'right');
      smSeekIndicatorOpacity.setValue(1);
      Animated.timing(smSeekIndicatorOpacity, {
        toValue: 0,
        duration: 700,
        useNativeDriver: true,
      }).start();
      smLastTapTimeRef.current = 0;
    } else {
      smLastTapTimeRef.current = now;
      smSingleTapTimerRef.current = setTimeout(() => {
        smSingleTapTimerRef.current = null;
        handleVideoTap();
      }, 300);
    }
  }, [player, smSeekIndicatorOpacity, handleVideoTap]);

  const handleFsTap = useCallback((locationX: number) => {
    const now = Date.now();
    if (now - lastTapTimeRef.current < 300) {
      // Double tap — seek
      if (fsSingleTapTimerRef.current) {
        clearTimeout(fsSingleTapTimerRef.current);
        fsSingleTapTimerRef.current = null;
      }
      const isLeft = locationX < fsTapWidthRef.current / 2;
      player?.seekBy(isLeft ? -5 : 5);
      setSeekFeedback(isLeft ? 'left' : 'right');
      seekIndicatorOpacity.setValue(1);
      Animated.timing(seekIndicatorOpacity, {
        toValue: 0,
        duration: 700,
        useNativeDriver: true,
      }).start();
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
          {video ? video.filename.replace(/\.[^.]+$/, '') : '播放器'}
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
            <Text style={{ color: '#666' }}>加载中…</Text>
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
              {smSeekFeedback === 'left' ? '-5秒' : '+5秒'}
            </Text>
          </Animated.View>
        )}
      </View>

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

      <SetupSheet
        visible={setupVisible}
        onDone={handleSetupDone}
        onCancel={isNewImport ? handleSetupCancel : undefined}
      />

      {/* 新手引导提示 */}
      {showCoachMark && (
        <Pressable style={styles.coachMark} onPress={dismissCoachMark}>
          <Animated.View style={[styles.coachMarkBox, { opacity: coachMarkOpacity }]}>
            <Text style={styles.coachMarkText}>👆 单击画面暂停/播放，双击两侧 ±5秒</Text>
          </Animated.View>
        </Pressable>
      )}

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
                {seekFeedback === 'left' ? '-5秒' : '+5秒'}
              </Text>
            </Animated.View>
          )}

          {countdownNum !== null && (
            <View style={styles.countdownOverlay}>
              <Text style={styles.countdownText}>{countdownNum}</Text>
            </View>
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
  container: { flex: 1, backgroundColor: Colors.bgMain },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgMain,
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
    height: 36,
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

  coachMark: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coachMarkBox: {
    backgroundColor: 'rgba(0,0,0,0.82)',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    gap: 4,
  },
  coachMarkText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
  },
});
