import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
} from 'react-native';
import { useTranslation } from 'react-i18next';

interface Props {
  visible: boolean;
  title: string;
  message?: string;
  closeText?: string;
  onClose: () => void;
  confirmText?: string;
  onConfirm?: () => void;
}

export function AlertDialog({ visible, title, message, closeText, onClose, confirmText, onConfirm }: Props) {
  const { t } = useTranslation();
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    if (visible) {
      opacity.setValue(0);
      scale.setValue(0.92);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, bounciness: 4, speed: 18, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 0.92, duration: 160, useNativeDriver: true }),
    ]).start(onClose);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={dismiss}>
      <Animated.View style={[styles.backdrop, { opacity }]}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={dismiss} />
        <Animated.View style={[styles.dialog, { opacity, transform: [{ scale }] }]}>
          <Pressable onPress={() => {}}>
            <Text style={styles.title}>{title}</Text>
            {message ? <Text style={styles.message}>{message}</Text> : null}
            <View style={styles.divider} />
            {confirmText && onConfirm ? (
              <View style={styles.twoBtn}>
                <Pressable style={styles.halfBtn} onPress={dismiss}>
                  <Text style={styles.cancelBtnText} numberOfLines={1}>{closeText ?? t('common.cancel')}</Text>
                </Pressable>
                <View style={styles.vDivider} />
                <Pressable style={styles.halfBtn} onPress={() => { dismiss(); onConfirm(); }}>
                  <Text style={styles.btnText} numberOfLines={1}>{confirmText}</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.btn} onPress={dismiss}>
                <Text style={styles.btnText} numberOfLines={1}>{closeText ?? t('common.ok')}</Text>
              </Pressable>
            )}
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  dialog: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 0,
    width: '100%',
  },
  title: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 10,
  },
  message: {
    color: '#aaa',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  divider: {
    height: 1,
    backgroundColor: '#2a2a2a',
    marginHorizontal: -20,
  },
  btn: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  twoBtn: {
    flexDirection: 'row',
  },
  halfBtn: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  vDivider: {
    width: 1,
    backgroundColor: '#2a2a2a',
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelBtnText: {
    color: '#888',
    fontSize: 16,
  },
});
