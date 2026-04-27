import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Pressable,
  Switch,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { usePlayerStore } from '../store/playerStore';
import { PlaybackSpeed } from '../types';
import { Colors } from '../constants/theme';

const SPEEDS: PlaybackSpeed[] = [0.7, 0.8, 0.9, 1.0];

interface Props {
  visible: boolean;
  onDone: () => void;
  onCancel?: () => void;
}

export function SetupSheet({ visible, onDone, onCancel }: Props) {
  const { t } = useTranslation();
  const { speed, setSpeed, isMirror, toggleMirror, isCountdownEnabled, toggleCountdown } = usePlayerStore();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDone}
    >
      <Pressable style={styles.backdrop} onPress={onDone}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.titleRow}>
            {onCancel ? (
              <Pressable onPress={onCancel} hitSlop={12}>
                <Text style={styles.cancelText}>×</Text>
              </Pressable>
            ) : (
              <View style={styles.titleSpacer} />
            )}
            <Text style={styles.title}>{t('setup.title')}</Text>
            <View style={styles.titleSpacer} />
          </View>

          {/* Speed */}
          <View style={styles.row}>
            <Text style={styles.rowLabel} numberOfLines={1}>{t('setup.speed')}</Text>
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

          {/* Mirror */}
          <View style={styles.row}>
            <Text style={styles.rowLabel} numberOfLines={1}>{t('setup.mirror')}</Text>
            <Switch
              value={isMirror}
              onValueChange={toggleMirror}
              trackColor={{ false: '#333', true: Colors.brandPrimary }}
              thumbColor="#fff"
            />
          </View>

          {/* Countdown */}
          <View style={styles.row}>
            <Text style={styles.rowLabel} numberOfLines={1}>{t('setup.countdown')}</Text>
            <Switch
              value={isCountdownEnabled}
              onValueChange={toggleCountdown}
              trackColor={{ false: '#333', true: Colors.brandPrimary }}
              thumbColor="#fff"
            />
          </View>

          <Pressable style={styles.doneBtn} onPress={onDone}>
            <Text style={styles.doneBtnText} numberOfLines={1}>{t('setup.start')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#111',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 20,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleSpacer: {
    width: 48,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    flex: 1,
  },
  cancelText: {
    color: '#aaa',
    fontSize: 28,
    width: 48,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLabel: {
    color: '#ccc',
    fontSize: 15,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: '#1e1e1e',
    borderRadius: 8,
    padding: 3,
    gap: 3,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
  },
  pillActive: {
    backgroundColor: Colors.brandPrimary,
  },
  pillText: {
    color: '#888',
    fontSize: 13,
    fontWeight: '600',
  },
  pillTextActive: {
    color: '#fff',
  },
  doneBtn: {
    backgroundColor: Colors.brandPrimary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  doneBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
