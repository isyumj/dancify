import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { Colors } from '../constants/theme';

interface Props {
  onAccept: () => void;
  onDecline: () => void;
}

export default function PrivacyConsentScreen({ onAccept, onDecline }: Props) {
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.iconWrap}>
          <Ionicons name="shield-checkmark" size={52} color={Colors.brandPrimary} />
        </View>

        <Text style={styles.appName}>ReDance</Text>
        <Text style={styles.title}>{t('privacy.title')}</Text>
        <Text style={styles.body}>{t('privacy.body')}</Text>

        <Pressable
          onPress={() =>
            WebBrowser.openBrowserAsync(`https://isyumj.github.io/redance-app/privacy.html?lang=${i18n.language}`)
          }
        >
          <Text style={styles.link}>{t('privacy.policyLink')}</Text>
        </Pressable>
      </ScrollView>

      <View style={styles.buttons}>
        <Pressable
          style={({ pressed }) => [styles.acceptBtn, pressed && styles.pressed]}
          onPress={onAccept}
        >
          <Text style={styles.acceptText}>{t('privacy.accept')}</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.declineBtn, pressed && styles.pressed]}
          onPress={onDecline}
        >
          <Text style={styles.declineText}>{t('privacy.decline')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgMain,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 60,
    paddingBottom: 24,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 22,
    backgroundColor: 'rgba(145, 99, 243, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  appName: {
    color: Colors.textPrimary,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
  },
  body: {
    color: '#AEAEB2',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 20,
  },
  link: {
    color: Colors.brandPrimary,
    fontSize: 14,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  buttons: {
    paddingHorizontal: 24,
    paddingBottom: 12,
    gap: 12,
  },
  acceptBtn: {
    backgroundColor: Colors.brandPrimary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  acceptText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  declineBtn: {
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  declineText: {
    color: Colors.textSecondary,
    fontSize: 15,
  },
  pressed: { opacity: 0.6 },
});
