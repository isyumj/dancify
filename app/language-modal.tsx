import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { changeLanguage, type AppLanguage } from '../i18n';
import { Colors } from '../constants/theme';

const OPTIONS: { key: AppLanguage; labelKey: string }[] = [
  { key: 'zh', labelKey: 'language.zh' },
  { key: 'en', labelKey: 'language.en' },
];

export default function LanguageModal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();

  const handleSelect = async (lang: AppLanguage) => {
    await changeLanguage(lang);
    router.back();
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.headerBtn, { opacity: pressed ? 0.5 : 1 }]}
          >
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </Pressable>
          <Text style={styles.headerTitle}>{t('language.title')}</Text>
          <View style={styles.headerBtn} />
        </View>

        <View style={styles.card}>
          {OPTIONS.map((opt, i) => {
            const isActive = i18n.language === opt.key;
            return (
              <React.Fragment key={opt.key}>
                {i > 0 && <View style={styles.divider} />}
                <Pressable
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                  onPress={() => handleSelect(opt.key)}
                >
                  <Text style={[styles.label, isActive && styles.labelActive]}>
                    {t(opt.labelKey)}
                  </Text>
                  {isActive && (
                    <Ionicons name="checkmark" size={20} color={Colors.brandPrimary} />
                  )}
                </Pressable>
              </React.Fragment>
            );
          })}
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
