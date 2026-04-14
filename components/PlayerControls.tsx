import React from 'react';
import { View, StyleSheet, Pressable, Text } from 'react-native';
import { usePlayerStore } from '../store/playerStore';
import { PlaybackSpeed } from '../types';
import { Colors } from '../constants/theme';

const SPEEDS: PlaybackSpeed[] = [0.7, 0.8, 0.9, 1.0];

export function PlayerControls() {
  const {
    speed, setSpeed,
    isMirror, toggleMirror,
    isCountdownEnabled, toggleCountdown,
  } = usePlayerStore();

  return (
    <View style={styles.container}>
      {/* Speed row */}
      <View style={styles.segmented}>
        {SPEEDS.map((s) => (
          <Pressable
            key={s}
            style={[styles.pill, speed === s && styles.pillActiveSpeed]}
            onPress={() => setSpeed(s)}
          >
            <Text style={[styles.pillText, speed === s && styles.pillTextActiveSpeed]}>
              {s === 1.0 ? '1x' : `${s}x`}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Mirror + Countdown row */}
      <View style={styles.segmented}>
        <Pressable
          style={[styles.pill, isMirror && styles.pillActiveSpeed]}
          onPress={toggleMirror}
        >
          <Text style={[styles.pillText, isMirror && styles.pillTextActiveSpeed]}>镜像</Text>
        </Pressable>

        <Pressable
          style={[styles.pill, isCountdownEnabled && styles.pillActiveSpeed]}
          onPress={toggleCountdown}
        >
          <Text style={[styles.pillText, isCountdownEnabled && styles.pillTextActiveSpeed]}>倒计时</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: Colors.bgCard,
    borderRadius: 8,
    padding: 3,
    gap: 3,
  },
  pill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: 'transparent',
  },
  pillActiveSpeed: {
    backgroundColor: Colors.brandPrimary,
  },
  pillText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  pillTextActiveSpeed: {
    color: '#fff',
    fontWeight: '600',
  },
});
