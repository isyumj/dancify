import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Pressable,
  Switch,
} from 'react-native';
import { usePlayerStore } from '../store/playerStore';
import { PlaybackSpeed } from '../types';

const SPEEDS: PlaybackSpeed[] = [0.5, 0.7, 0.8, 0.9, 1.0];

interface Props {
  visible: boolean;
  onDone: () => void;
  onCancel?: () => void;
}

export function SetupSheet({ visible, onDone, onCancel }: Props) {
  const { speed, setSpeed, isMirror, toggleMirror } = usePlayerStore();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDone}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.titleRow}>
            {onCancel ? (
              <Pressable onPress={onCancel} hitSlop={12}>
                <Text style={styles.cancelText}>←</Text>
              </Pressable>
            ) : (
              <View style={styles.titleSpacer} />
            )}
            <Text style={styles.title}>初始设置</Text>
            <View style={styles.titleSpacer} />
          </View>

          {/* Mirror */}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>镜像模式</Text>
            <Switch
              value={isMirror}
              onValueChange={toggleMirror}
              trackColor={{ false: '#333', true: '#2563eb' }}
              thumbColor="#fff"
            />
          </View>

          {/* Speed */}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>播放速度</Text>
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

          <Pressable style={styles.doneBtn} onPress={onDone}>
            <Text style={styles.doneBtnText}>开始练习</Text>
          </Pressable>
        </View>
      </View>
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
    color: '#888',
    fontSize: 14,
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
    backgroundColor: '#2563eb',
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
    backgroundColor: '#2563eb',
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
