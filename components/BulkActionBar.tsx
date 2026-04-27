import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

interface Props {
  visible: boolean;
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDelete: () => void;
}

export function BulkActionBar({
  visible,
  selectedCount,
  totalCount,
  onSelectAll,
  onDelete,
}: Props) {
  const { t } = useTranslation();
  const slideAnim = useRef(new Animated.Value(100)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : 100,
      useNativeDriver: true,
      bounciness: 0,
      speed: 20,
    }).start();
  }, [visible]);

  const allSelected = totalCount > 0 && selectedCount === totalCount;
  const canDelete = selectedCount > 0;

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateY: slideAnim }], paddingBottom: insets.bottom || 16 }]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <View style={styles.bar}>
        <Text style={styles.countText}>
          {selectedCount > 0 ? t('library.bulkSelectedCount', { count: selectedCount }) : t('library.bulkSelectHint')}
        </Text>

        <View style={styles.actions}>
          <Pressable
            onPress={onDelete}
            disabled={!canDelete}
            hitSlop={8}
            style={[styles.deleteBtn, !canDelete && styles.deleteBtnDisabled]}
          >
            <Feather name="trash-2" size={18} color={canDelete ? '#f87171' : '#555'} />
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1a1a1a',
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 4,
  },
  countText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    minWidth: 48,
    justifyContent: 'flex-end',
  },
  selectAllText: {
    color: '#2563eb',
    fontSize: 15,
  },
  deleteBtn: {
    padding: 2,
  },
  deleteBtnDisabled: {
    opacity: 0.4,
  },
});
