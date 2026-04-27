import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  Animated,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

interface Props {
  visible: boolean;
  onSelectPhotos: () => void;
  onSelectFiles: () => void;
  onClose: () => void;
}

const DISMISS_MS = 240;

export function ImportActionSheet({ visible, onSelectPhotos, onSelectFiles, onClose }: Props) {
  const { t } = useTranslation();
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetY = useRef(new Animated.Value(400)).current;

  useEffect(() => {
    if (visible) {
      backdropOpacity.setValue(0);
      sheetY.setValue(400);
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.spring(sheetY, { toValue: 0, bounciness: 3, speed: 14, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const dismiss = (afterDismiss?: () => void) => {
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 0, duration: DISMISS_MS, useNativeDriver: true }),
      Animated.timing(sheetY, { toValue: 400, duration: DISMISS_MS, useNativeDriver: true }),
    ]).start(() => {
      onClose();
      afterDismiss?.();
    });
  };

  const pick = (handler: () => void) => {
    dismiss();
    setTimeout(handler, DISMISS_MS + 80);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={() => dismiss()}>
      {/* backdrop — fades independently */}
      <Animated.View
        style={[StyleSheet.absoluteFillObject, styles.backdropColor, { opacity: backdropOpacity }]}
      />

      {/* full-screen hit area — tap outside sheet to dismiss */}
      <View style={styles.fullScreen}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={() => dismiss()} />

        {/* sheet — slides independently */}
        <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetY }] }]}>
          {/* inner Pressable swallows touches so they don't reach the backdrop */}
          <Pressable onPress={() => {}}>
            <View style={styles.handle} />

            <Pressable style={styles.action} onPress={() => pick(onSelectPhotos)}>
              <View style={styles.iconWrap}>
                <Feather name="image" size={20} color="#ccc" />
              </View>
              <Text style={styles.actionText} numberOfLines={1}>{t('library.importFromPhotos')}</Text>
            </Pressable>

            <View style={styles.divider} />

            <Pressable style={styles.action} onPress={() => pick(onSelectFiles)}>
              <View style={styles.iconWrap}>
                <Feather name="folder" size={20} color="#ccc" />
              </View>
              <Text style={styles.actionText} numberOfLines={1}>{t('library.importFromFiles')}</Text>
            </Pressable>

            <Pressable style={styles.cancelBtn} onPress={() => dismiss()}>
              <Text style={styles.cancelText} numberOfLines={1}>{t('common.cancel')}</Text>
            </Pressable>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdropColor: {
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  fullScreen: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 36,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#444',
    alignSelf: 'center',
    marginBottom: 16,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#2a2a2a',
    marginHorizontal: 4,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  actionText: {
    color: '#ccc',
    fontSize: 16,
  },
  cancelBtn: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
  },
  cancelText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
