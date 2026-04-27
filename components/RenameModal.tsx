import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';

interface Props {
  visible: boolean;
  currentName: string;
  onConfirm: (newName: string) => void;
  onCancel: () => void;
}

export function RenameModal({ visible, currentName, onConfirm, onCancel }: Props) {
  const { t } = useTranslation();
  const [value, setValue] = useState(currentName);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) setValue(currentName);
  }, [visible, currentName]);

  const trimmed = value.trim();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={styles.sheet}>
          <View style={styles.titleRow}>
            <Pressable onPress={onCancel} hitSlop={12}>
              <Text style={styles.cancelText}>{t('common.cancel')}</Text>
            </Pressable>
            <Text style={styles.title}>{t('library.rename')}</Text>
            <View style={styles.titleSpacer} />
          </View>

          <TextInput
            ref={inputRef}
            style={styles.input}
            value={value}
            onChangeText={setValue}
            autoFocus
            onFocus={() => setTimeout(() => inputRef.current?.setSelection(0, value.length), 0)}
            placeholderTextColor="#555"
            returnKeyType="done"
            onSubmitEditing={() => trimmed && onConfirm(trimmed)}
          />

          <Pressable
            style={[styles.confirmBtn, !trimmed && styles.confirmBtnDisabled]}
            onPress={() => trimmed && onConfirm(trimmed)}
            disabled={!trimmed}
          >
            <Text style={styles.confirmBtnText}>{t('common.save')}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
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
    gap: 16,
    paddingBottom: 36,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  titleSpacer: { width: 60 },
  cancelText: {
    color: '#888',
    fontSize: 15,
    width: 60,
  },
  input: {
    backgroundColor: '#1e1e1e',
    color: '#fff',
    fontSize: 15,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  confirmBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmBtnDisabled: {
    opacity: 0.4,
  },
  confirmBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
