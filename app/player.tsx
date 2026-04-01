import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
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
import { getVideo, insertVideo, updateVideoDuration } from '../db/database';
import * as FileSystem from 'expo-file-system/legacy';
import { Video } from '../types';
import { usePlayerStore } from '../store/playerStore';
import { usePlayback } from '../hooks/usePlayback';
import { useCountdown } from '../hooks/useCountdown';
import { useSegments } from '../hooks/useSegments';
import { Ionicons } from '@expo/vector-icons';
import { PlayerControls } from '../components/PlayerControls';
import { SegmentBar } from '../components/SegmentBar';
import { SetupSheet } from '../components/SetupSheet';

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
  const [confirmedId, setConfirmedId] = useState(0);
  const [setupVisible, setSetupVisible] = useState(isNewImport);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fsBarWidth, setFsBarWidth] = useState(1);
  const [countdownNum, setCountdownNum] = useState<number | null>(null);

  const isMirror = usePlayerStore((s) => s.isMirror);
  const loopStart = usePlayerStore((s) => s.loopStart);
  const loopEnd = usePlayerStore((s) => s.loopEnd);
  const isCountdownEnabled = usePlayerStore((s) => s.isCountdownEnabled);
  const { playCountdown } = useCountdown();

  const { segments, load: loadSegments, addSegment } = useSegments(confirmedId);

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
        setConfirmedId(vidId);
        if (v.duration > 0) setDuration(v.duration);
      });
      loadSegments();
    }
  }, [videoId, tempPath, filenameParam, durationParam]);

  const player = useVideoPlayer(video?.localPath ?? '', (p) => {
    p.loop = false;
    p.play();
    setIsPlaying(true);
  });

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

  const handleSeek = useCallback(
    (time: number) => {
      if (!player) return;
      player.seekBy(time - (player.currentTime ?? 0));
    },
    [player]
  );

  const handleFsSeek = useCallback(
    (x: number) => {
      if (!player || duration === 0) return;
      const ratio = Math.max(0, Math.min(1, x / fsBarWidth));
      player.seekBy(ratio * duration - (player.currentTime ?? 0));
    },
    [player, duration, fsBarWidth]
  );

  const togglePlay = async () => {
    if (!player) return;
    if (player.playing) {
      player.pause();
    } else {
      if (isCountdownEnabled && loopStart === null) {
        player.pause();
        player.volume = 0;
        await playCountdown(setCountdownNum);
        player.volume = 1;
      }
      player.play();
    }
  };

  const handleSaveSegment = async () => {
    if (loopStart === null || loopEnd === null) return;
    await addSegment(loopStart, loopEnd);
    Alert.alert('已保存', `${fmt(loopStart)} → ${fmt(loopEnd)}`);
  };

  const handleSetupDone = async () => {
    if (isNewImport && video && video.id === 0) {
      const id = await insertVideo(video.filename, duration || video.duration, video.localPath);
      setVideo({ ...video, id });
      setConfirmedId(id);
      loadSegments();
    }
    setSetupVisible(false);
  };

  const handleSetupCancel = async () => {
    if (tempPath) {
      try { await FileSystem.deleteAsync(tempPath, { idempotent: true }); } catch {}
    }
    router.back();
  };

  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* 自定义顶部栏 */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>播放器</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* 视频 */}
      <View style={styles.videoWrapper}>
        {video ? (
          <VideoView
            player={player}
            style={[styles.video, isMirror && styles.mirrored]}
            nativeControls={false}
            contentFit="contain"
          />
        ) : (
          <View style={styles.videoPlaceholder}>
            <Text style={{ color: '#666' }}>加载中…</Text>
          </View>
        )}
        {countdownNum !== null && (
          <View style={styles.countdownOverlay}>
            <Text style={styles.countdownText}>{countdownNum}</Text>
          </View>
        )}
      </View>

      {/* 控制栏 */}
      <View style={styles.controlRow}>
        <Text style={styles.timeLabel}>{fmt(currentTime)} / {fmt(duration)}</Text>
        <Pressable style={styles.playBtn} onPress={togglePlay}>
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={22} color="#fff" />
        </Pressable>
        <TouchableOpacity onPress={() => setIsFullscreen(true)} activeOpacity={0.7} style={styles.fsBtn}>
          <Ionicons name="expand" size={20} color="#aaa" />
        </TouchableOpacity>
      </View>

      <SegmentBar
        duration={duration}
        currentTime={currentTime}
        segments={segments}
        onSeek={handleSeek}
      />

      <PlayerControls currentTime={currentTime} onSaveSegment={handleSaveSegment} />

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

          {/* 全屏底部控制栏 */}
          <View style={[styles.fsControls, { paddingBottom: insets.bottom + 12 }]}>
            <Pressable onPress={togglePlay} style={styles.fsPlayBtn}>
              <Ionicons name={isPlaying ? 'pause' : 'play'} size={24} color="#fff" />
            </Pressable>

            <Text style={styles.fsTime}>{fmt(currentTime)}</Text>

            {/* 进度条 */}
            <View
              style={styles.fsProgressTrack}
              onLayout={(e) => setFsBarWidth(e.nativeEvent.layout.width)}
            >
              <View style={[styles.fsProgressFill, { width: `${progress * 100}%` }]} />
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={(e) => handleFsSeek(e.nativeEvent.locationX)}
              />
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
  container: { flex: 1, backgroundColor: '#0a0a0a' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
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
  mirrored: { transform: [{ scaleX: -1 }] },
  videoPlaceholder: {
    flex: 1,
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
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1e1e1e',
    alignItems: 'center',
    justifyContent: 'center',
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
  fsProgressTrack: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    overflow: 'visible',
  },
  fsProgressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 2,
  },
});
