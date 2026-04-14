import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';
const LANG_KEY = 'pref_language';

type Language = 'zh-Hans' | 'en';
const OPTIONS: { key: Language; label: string }[] = [
  { key: 'zh-Hans', label: '简体中文' },
  { key: 'en', label: 'English' },
];

export default function LanguageModal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [language, setLanguage] = useState<Language>('zh-Hans');

  useEffect(() => {
    AsyncStorage.getItem(LANG_KEY).then((v) => {
      if (v) setLanguage(v as Language);
    });
  }, []);

  const handleSelect = async (lang: Language) => {
    await AsyncStorage.setItem(LANG_KEY, lang);
    setLanguage(lang);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* 自定义 Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.headerBtn, { opacity: pressed ? 0.5 : 1 }]}
          >
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </Pressable>
          <Text style={styles.headerTitle}>语言设置</Text>
          <View style={styles.headerBtn} />
        </View>
        <View style={styles.card}>
          {OPTIONS.map((opt, i) => (
            <React.Fragment key={opt.key}>
              {i > 0 && <View style={styles.divider} />}
              <Pressable
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                onPress={() => handleSelect(opt.key)}
              >
                <Text style={[styles.label, language === opt.key && styles.labelActive]}>
                  {opt.label}
                </Text>
                {language === opt.key && (
                  <Ionicons name="checkmark" size={20} color={Colors.brandPrimary} />
                )}
              </Pressable>
            </React.Fragment>
          ))}
        </View>
      </View>
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
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginTop: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    minHeight: 60,
  },
  rowPressed: { opacity: 0.5 },
  label: { flex: 1, color: Colors.textSecondary, fontSize: 16 },
  labelActive: { color: '#fff', fontWeight: '600' },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#2a2a2a',
  },
});
