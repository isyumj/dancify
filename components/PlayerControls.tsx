import React from 'react';
import { View, StyleSheet, Pressable, Text, Switch } from 'react-native';
import { useTranslation } from 'react-i18next';
import { usePlayerStore } from '../store/playerStore';
import { PlaybackSpeed } from '../types';
import { Colors } from '../constants/theme';

const SPEEDS: PlaybackSpeed[] = [0.7, 0.8, 0.9, 1.0];

export function PlayerControls() {
  const { t } = useTranslation();
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

      <View style={styles.switchGroup}>
        {/* Mirror row */}
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel} numberOfLines={1}>{t('setup.mirror')}</Text>
          <Switch
            value={isMirror}
            onValueChange={toggleMirror}
            trackColor={{ false: '#333', true: Colors.brandPrimary }}
            thumbColor="#fff"
          />
        </View>

        {/* Countdown row */}
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel} numberOfLines={1}>{t('setup.countdown')}</Text>
          <Switch
            value={isCountdownEnabled}
            onValueChange={toggleCountdown}
            trackColor={{ false: '#333', true: Colors.brandPrimary }}
            thumbColor="#fff"
          />
        </View>
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
    backgroundColor: '#1e1e1e',
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

  switchGroup: {
    gap: 4,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  switchLabel: {
    color: '#ccc',
    fontSize: 15,
  },
});
