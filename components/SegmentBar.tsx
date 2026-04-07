import React, { useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { runOnJS } from 'react-native-worklets';
import { Segment } from '../types';
import { usePlayerStore } from '../store/playerStore';

interface Props {
  duration: number;
  currentTime: number;
  segments: Segment[];
  onSeek: (time: number) => void;
}

export function SegmentBar({ duration, currentTime, segments, onSeek }: Props) {
  const { loopStart, loopEnd } = usePlayerStore();
  const trackWidth = useSharedValue(1);
  const thumbX = useSharedValue(0);
  const isDragging = useSharedValue(false);

  // Sync playhead with video when not dragging
  useEffect(() => {
    if (!isDragging.value && duration > 0) {
      thumbX.value = (currentTime / duration) * trackWidth.value;
    }
  }, [currentTime, duration]);

  const pan = Gesture.Pan()
    .onBegin((e) => {
      isDragging.value = true;
      thumbX.value = Math.max(0, Math.min(trackWidth.value, e.x));
    })
    .onUpdate((e) => {
      thumbX.value = Math.max(0, Math.min(trackWidth.value, e.x));
    })
    .onEnd((e) => {
      const ratio = Math.max(0, Math.min(1, e.x / trackWidth.value));
      isDragging.value = false;
      runOnJS(onSeek)(ratio * duration);
    })
    .onFinalize(() => {
      isDragging.value = false;
    });

  const thumbStyle = useAnimatedStyle(() => ({
    left: thumbX.value,
  }));

  const loopStartPct = duration > 0 && loopStart !== null ? (loopStart / duration) * 100 : null;
  const loopEndPct = duration > 0 && loopEnd !== null ? (loopEnd / duration) * 100 : null;

  return (
    <View style={styles.container}>
      <GestureDetector gesture={pan}>
        <View
          style={styles.track}
          onLayout={(e) => { trackWidth.value = e.nativeEvent.layout.width; }}
        >
          {/* Loop region */}
          {loopStartPct !== null && loopEndPct !== null && (
            <View
              style={[
                styles.loopRegion,
                { left: `${loopStartPct}%`, width: `${loopEndPct - loopStartPct}%` },
              ]}
            />
          )}

          {/* Playhead — runs on UI thread, zero lag */}
          <Animated.View style={[styles.playhead, thumbStyle]} />

          {/* Loop markers */}
          {loopStartPct !== null && (
            <View style={[styles.markerStart, { left: `${loopStartPct}%` }]}>
              <Text style={styles.markerLabel}>A</Text>
            </View>
          )}
          {loopEndPct !== null && (
            <View style={[styles.markerEnd, { left: `${loopEndPct}%` }]}>
              <Text style={styles.markerLabel}>B</Text>
            </View>
          )}

          {/* Saved segment dots */}
          {segments.map((seg) => {
            const dotPct = duration > 0 ? (seg.startTime / duration) * 100 : 0;
            return (
              <View
                key={seg.id}
                style={[styles.segmentDot, { left: `${dotPct}%` }]}
              />
            );
          })}
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  track: {
    height: 6,
    backgroundColor: '#333',
    borderRadius: 3,
    position: 'relative',
  },
  loopRegion: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(99, 179, 237, 0.35)',
    borderRadius: 3,
  },
  playhead: {
    position: 'absolute',
    top: -5,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    marginLeft: -8,
  },
  markerStart: {
    position: 'absolute',
    top: -20,
    marginLeft: -8,
    alignItems: 'center',
  },
  markerEnd: {
    position: 'absolute',
    top: -20,
    marginLeft: -8,
    alignItems: 'center',
  },
  markerLabel: {
    color: '#63b3ed',
    fontSize: 11,
    fontWeight: '700',
  },
  segmentDot: {
    position: 'absolute',
    bottom: -8,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#f6ad55',
    marginLeft: -3,
  },
});
