import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors } from '../constants/theme';

// 部署 Google Apps Script 后替换这里
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwD5FfqXYQCy3S_ma5OIhtTmHQl0JKfYfOl0wfusrcnu4atruTmfzec6qDq-Y5pS_Kmrw/exec';

export default function FeedbackScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!text.trim()) {
      Alert.alert(t('profile.about.feedbackEmpty'));
      return;
    }
    setSubmitting(true);
    try {
      const params = new URLSearchParams({
        message: text.trim(),
        lang: i18n.language,
        time: new Date().toISOString(),
      });
      await fetch(`${APPS_SCRIPT_URL}?${params.toString()}`);
      Alert.alert(t('profile.about.feedbackSuccess'), '', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert(t('profile.about.feedbackError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.container, { paddingTop: insets.top }]}>
          <View style={styles.header}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [styles.headerBtn, { opacity: pressed ? 0.5 : 1 }]}
            >
              <Ionicons name="chevron-back" size={28} color="#fff" />
            </Pressable>
            <Text style={styles.headerTitle}>{t('profile.about.feedbackTitle')}</Text>
            <View style={styles.headerBtn} />
          </View>

          <ScrollView
            contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
            keyboardShouldPersistTaps="handled"
          >
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={setText}
              placeholder={t('profile.about.feedbackPlaceholder')}
              placeholderTextColor={Colors.textSecondary}
              multiline
              textAlignVertical="top"
            />

            <Pressable
              style={({ pressed }) => [styles.submitBtn, pressed && { opacity: 0.8 }, submitting && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.submitText}>{t('profile.about.feedbackSubmit')}</Text>
              }
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgMain,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  headerBtn: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 16,
  },
  input: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    minHeight: 200,
    lineHeight: 24,
  },
  submitBtn: {
    backgroundColor: Colors.brandPrimary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
