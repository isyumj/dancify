import React, { useCallback } from 'react';
import { View, StyleSheet, Pressable, Text } from 'react-native';
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

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const loopStartPct = duration > 0 && loopStart !== null ? (loopStart / duration) * 100 : null;
  const loopEndPct = duration > 0 && loopEnd !== null ? (loopEnd / duration) * 100 : null;

  const handlePress = useCallback(
    (event: { nativeEvent: { locationX: number } }, width: number) => {
      if (duration <= 0 || width <= 0) return;
      const ratio = event.nativeEvent.locationX / width;
      onSeek(ratio * duration);
    },
    [duration, onSeek]
  );

  return (
    <View style={styles.container}>
      {/* Track */}
      <View
        style={styles.track}
        onStartShouldSetResponder={() => true}
        onResponderGrant={(e) => {
          // @ts-ignore – layout is available at runtime
          const width = e.currentTarget?.offsetWidth ?? 300;
          handlePress(e, width);
        }}
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

        {/* Playhead */}
        <View style={[styles.playhead, { left: `${pct}%` }]} />

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
