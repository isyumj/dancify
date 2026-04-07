import React from 'react';
import { View, StyleSheet, Pressable, Text } from 'react-native';
import { usePlayerStore } from '../store/playerStore';
import { PlaybackSpeed } from '../types';

const SPEEDS: PlaybackSpeed[] = [0.7, 0.8, 0.9, 1.0];

interface Props {
  currentTime: number;
  onSaveSegment: () => void;
}

export function PlayerControls({ currentTime, onSaveSegment }: Props) {
  const {
    speed, setSpeed,
    isMirror, toggleMirror,
    loopStart, loopEnd,
    setLoopStart, setLoopEnd, clearLoop,
    isCountdownEnabled, toggleCountdown,
  } = usePlayerStore();

  const handleABPress = () => {
    if (loopStart === null) {
      setLoopStart(currentTime);
    } else if (loopEnd === null) {
      if (currentTime > loopStart) {
        setLoopEnd(currentTime);
      } else {
        // Tapped before A — reset A
        setLoopStart(currentTime);
      }
    } else {
      clearLoop();
    }
  };

  const abLabel = loopStart === null ? '打 A 点' : loopEnd === null ? '打 B 点' : '清除 A-B';

  return (
    <View style={styles.container}>
      {/* Speed row */}
      <View style={styles.row}>
        <Text style={styles.label}>速度</Text>
        <View style={styles.segmented}>
          {SPEEDS.map((s) => (
            <Pressable
              key={s}
              style={[styles.pill, speed === s && styles.pillActive]}
              onPress={() => setSpeed(s)}
            >
              <Text style={[styles.pillText, speed === s && styles.pillTextActive]}>
                {s === 1.0 ? '1x' : `${s}x`}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Mirror + Countdown row */}
      <View style={styles.row}>
        <Pressable
          style={[styles.toggleBtn, isMirror && styles.toggleBtnActive]}
          onPress={toggleMirror}
        >
          <Text style={[styles.toggleText, isMirror && styles.toggleTextActive]}>
            镜像
          </Text>
        </Pressable>

        <Pressable
          style={[styles.toggleBtn, isCountdownEnabled && styles.toggleBtnActive]}
          onPress={toggleCountdown}
        >
          <Text style={[styles.toggleText, isCountdownEnabled && styles.toggleTextActive]}>
            倒计时
          </Text>
        </Pressable>
      </View>

      {/* A-B loop + Save row */}
      <View style={styles.row}>
        <Pressable style={styles.actionBtn} onPress={handleABPress}>
          <Text style={styles.actionText}>{abLabel}</Text>
        </Pressable>

        {loopStart !== null && loopEnd !== null && (
          <Pressable style={[styles.actionBtn, styles.saveBtn]} onPress={onSaveSegment}>
            <Text style={styles.actionText}>保存片段</Text>
          </Pressable>
        )}
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  label: {
    color: '#aaa',
    fontSize: 13,
    width: 32,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: '#1e1e1e',
    borderRadius: 8,
    padding: 3,
    gap: 3,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 6,
  },
  pillActive: {
    backgroundColor: '#2563eb',
  },
  pillText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  pillTextActive: {
    color: '#fff',
  },
  toggleBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  toggleBtnActive: {
    borderColor: '#2563eb',
    backgroundColor: 'rgba(37,99,235,0.15)',
  },
  toggleText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: '#63b3ed',
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#1e1e1e',
    alignItems: 'center',
  },
  saveBtn: {
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  actionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
