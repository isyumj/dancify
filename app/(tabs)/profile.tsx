import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  Switch,
  Animated,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors } from '../../constants/theme';
import { getStoredConsent, storeConsent } from '../../utils/privacyGate';
import { initAnalytics, disableAnalytics } from '../../utils/analytics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { openAppStoreRatingPage } from '../../utils/ratingPrompt';

const KEY_USER_RATING = 'user_rating';

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return (bytes / 1024 ** 3).toFixed(1) + ' GB';
  return (bytes / 1024 ** 2).toFixed(1) + ' MB';
}

async function dirSize(dir: string): Promise<number> {
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) return 0;
  const files = await FileSystem.readDirectoryAsync(dir);
  let sum = 0;
  for (const f of files) {
    const fi = await FileSystem.getInfoAsync(dir + f, { size: true } as any);
    if (fi.exists && (fi as any).size) sum += (fi as any).size;
  }
  return sum;
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const [videosBytes, setVideosBytes] = useState(0);
  const [cacheBytes, setCacheBytes] = useState(0);
  const [clearing, setClearing] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);

  const loadStorage = useCallback(async () => {
    try {
      const [vb, cb, consent] = await Promise.all([
        dirSize(FileSystem.documentDirectory + 'videos/'),
        dirSize(FileSystem.cacheDirectory ?? ''),
        getStoredConsent(),
      ]);
      setVideosBytes(vb);
      setCacheBytes(cb);
      setAnalyticsEnabled(consent === 'accepted');
    } catch (e) {
      console.error('storage load error', e);
    }
  }, []);

  const handleAnalyticsToggle = async (value: boolean) => {
    setAnalyticsEnabled(value);
    if (value) {
      await storeConsent('accepted');
      initAnalytics();
    } else {
      await storeConsent('declined');
      disableAnalytics();
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadStorage();
    }, [])
  );

  const handleClearCache = () => {
    Alert.alert(
      t('profile.storage.clearCacheTitle'),
      t('profile.storage.clearCacheMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.storage.clearConfirm'),
          style: 'destructive',
          onPress: async () => {
            setClearing(true);
            try {
              const cacheDir = FileSystem.cacheDirectory;
              if (cacheDir) {
                const files = await FileSystem.readDirectoryAsync(cacheDir);
                for (const f of files) {
                  await FileSystem.deleteAsync(cacheDir + f, { idempotent: true });
                }
              }
              await loadStorage();
              Alert.alert(t('common.done'), t('profile.storage.cacheCleared'));
            } catch (e) {
              Alert.alert(t('profile.storage.clearFailed'), String(e));
            } finally {
              setClearing(false);
            }
          },
        },
      ]
    );
  };

  const [selectedRating, setSelectedRating] = useState(0);
  const [ratingDone, setRatingDone] = useState(false);
  const expansionAnim = useRef(new Animated.Value(0)).current;
  const expansionShownRef = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY_USER_RATING).then((val) => {
      if (val) setRatingDone(true);
    });
  }, []);

  const handleStarPress = useCallback((rating: number) => {
    setSelectedRating(rating);
    if (!expansionShownRef.current) {
      expansionShownRef.current = true;
      Animated.timing(expansionAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }
  }, [expansionAnim]);

  const handleRatingDismiss = useCallback(() => {
    AsyncStorage.setItem(KEY_USER_RATING, 'dismissed');
    setRatingDone(true);
  }, []);

  const handleRatingConfirmPositive = useCallback(() => {
    AsyncStorage.setItem(KEY_USER_RATING, String(selectedRating));
    setRatingDone(true);
    openAppStoreRatingPage();
  }, [selectedRating]);

  const handleRatingConfirmNegative = useCallback(() => {
    AsyncStorage.setItem(KEY_USER_RATING, String(selectedRating));
    setRatingDone(true);
    router.push('/feedback');
  }, [selectedRating, router]);

  const currentLangLabel = t(`language.${i18n.language as 'zh' | 'en'}`);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('profile.title')}</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Storage ── */}
        <Text style={styles.groupLabel}>{t('profile.storage.title')}</Text>
        <View style={styles.card}>
          <View style={styles.storageItem}>
            <Text style={styles.storageLabel}>{t('profile.storage.videoLibrary')}</Text>
            <Text style={styles.storageValue}>{formatBytes(videosBytes)}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.storageItem}>
            <Text style={styles.storageLabel}>{t('profile.storage.cache')}</Text>
            <Text style={styles.storageValue}>{formatBytes(cacheBytes)}</Text>
            <Pressable
              style={({ pressed }) => [styles.clearBtn, pressed && styles.clearBtnPressed]}
              onPress={handleClearCache}
              disabled={clearing}
            >
              {clearing ? (
                <ActivityIndicator size="small" color="#FF453A" />
              ) : (
                <Text style={styles.clearBtnText} numberOfLines={1}>{t('profile.storage.clearBtn')}</Text>
              )}
            </Pressable>
          </View>

          <Text style={styles.cacheHint}>{t('profile.storage.cacheHint')}</Text>
        </View>

        {/* ── Preferences ── */}
        <Text style={styles.groupLabel}>{t('profile.preferences.title')}</Text>
        <View style={styles.card}>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => router.push('/language-modal')}
          >
            <View style={[styles.iconBox, { backgroundColor: Colors.bgCard }]}>
              <Ionicons name="language-outline" size={15} color="#fff" />
            </View>
            <Text style={styles.rowLabel}>{t('profile.preferences.language')}</Text>
            <Text style={styles.rowHint}>{currentLangLabel}</Text>
            <Ionicons name="chevron-forward" size={16} color="#444" />
          </Pressable>

          <View style={styles.divider} />

          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: Colors.bgCard }]}>
              <Ionicons name="analytics-outline" size={15} color="#fff" />
            </View>
            <Text style={styles.rowLabel}>{t('profile.preferences.analytics')}</Text>
            <Switch
              value={analyticsEnabled}
              onValueChange={handleAnalyticsToggle}
              trackColor={{ false: '#3A3A3C', true: Colors.brandPrimary }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.analyticsInfo}>
            <Text style={styles.analyticsInfoText}>{t('privacy.body')}</Text>
            <Pressable
              onPress={() =>
                WebBrowser.openBrowserAsync(
                  `https://isyumj.github.io/redance-app/privacy.html?lang=${i18n.language}`
                )
              }
            >
              <Text style={styles.analyticsInfoLink}>{t('privacy.policyLink')}</Text>
            </Pressable>
          </View>
        </View>

        {/* ── Rating ── */}
        {!ratingDone && (
          <View style={[styles.card, { marginTop: 28 }]}>
            <View style={styles.ratingRow}>
              <Text style={styles.rowLabel}>{t('profile.about.rateTitle')}</Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Pressable key={n} onPress={() => handleStarPress(n)} hitSlop={8}>
                    <Ionicons
                      name={n <= selectedRating ? 'star' : 'star-outline'}
                      size={26}
                      color={n <= selectedRating ? '#FFD60A' : '#555'}
                    />
                  </Pressable>
                ))}
              </View>
            </View>

            {selectedRating > 0 && (
              <Animated.View
                style={{
                  opacity: expansionAnim,
                  transform: [{
                    translateY: expansionAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-6, 0],
                    }),
                  }],
                }}
              >
                <View style={styles.divider} />
                <Text style={styles.ratingExpandText}>
                  {selectedRating >= 4
                    ? t('profile.about.rateExpandPositive')
                    : t('profile.about.rateExpandNegative')}
                </Text>
                <View style={styles.ratingBtnRow}>
                  <Pressable
                    style={({ pressed }) => [styles.ratingBtn, styles.ratingBtnSecondary, pressed && { opacity: 0.6 }]}
                    onPress={handleRatingDismiss}
                  >
                    <Text style={styles.ratingBtnSecondaryText}>{t('profile.about.rateStoreLater')}</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.ratingBtn, styles.ratingBtnPrimary, pressed && { opacity: 0.8 }]}
                    onPress={selectedRating >= 4 ? handleRatingConfirmPositive : handleRatingConfirmNegative}
                  >
                    <Text style={styles.ratingBtnPrimaryText}>
                      {selectedRating >= 4
                        ? t('profile.about.rateStoreConfirm')
                        : t('profile.about.rateFeedbackConfirm')}
                    </Text>
                  </Pressable>
                </View>
              </Animated.View>
            )}
          </View>
        )}

        {/* ── About ── */}
        <Text style={styles.groupLabel}>{t('profile.about.title')}</Text>
        <View style={styles.card}>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => WebBrowser.openBrowserAsync(`https://isyumj.github.io/redance-app/privacy.html?lang=${i18n.language}`)}
          >
            <View style={[styles.iconBox, { backgroundColor: Colors.bgCard }]}>
              <Ionicons name="shield-checkmark-outline" size={15} color="#fff" />
            </View>
            <Text style={styles.rowLabel}>{t('profile.about.privacy')}</Text>
            <Ionicons name="chevron-forward" size={16} color="#444" />
          </Pressable>

          <View style={styles.divider} />

          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => WebBrowser.openBrowserAsync(`https://isyumj.github.io/redance-app/terms.html?lang=${i18n.language}`)}
          >
            <View style={[styles.iconBox, { backgroundColor: Colors.bgCard }]}>
              <Ionicons name="document-text-outline" size={15} color="#fff" />
            </View>
            <Text style={styles.rowLabel}>{t('profile.about.terms')}</Text>
            <Ionicons name="chevron-forward" size={16} color="#444" />
          </Pressable>

          <View style={styles.divider} />

          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => router.push('/feedback')}
          >
            <View style={[styles.iconBox, { backgroundColor: Colors.bgCard }]}>
              <Ionicons name="chatbubble-ellipses-outline" size={15} color="#fff" />
            </View>
            <Text style={styles.rowLabel}>{t('profile.about.feedback')}</Text>
            <Ionicons name="chevron-forward" size={16} color="#444" />
          </Pressable>
        </View>

        <Text style={styles.version}>ReDance  v1.0.0</Text>

        {__DEV__ && (
          <>
            <Text style={styles.groupLabel}>Dev</Text>
            <View style={styles.card}>
              <Pressable
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                onPress={() => router.push('/privacy-preview')}
              >
                <View style={[styles.iconBox, { backgroundColor: '#3A3A3C' }]}>
                  <Ionicons name="eye-outline" size={15} color="#fff" />
                </View>
                <Text style={styles.rowLabel}>Preview Privacy Screen</Text>
                <Ionicons name="chevron-forward" size={16} color="#444" />
              </Pressable>

              <View style={styles.divider} />

              <Pressable
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                onPress={() => {
                  AsyncStorage.removeItem(KEY_USER_RATING);
                  setSelectedRating(0);
                  setRatingDone(false);
                  expansionShownRef.current = false;
                  expansionAnim.setValue(0);
                }}
              >
                <View style={[styles.iconBox, { backgroundColor: '#3A3A3C' }]}>
                  <Ionicons name="refresh-outline" size={15} color="#fff" />
                </View>
                <Text style={styles.rowLabel}>Reset Rating Card</Text>
                <Ionicons name="chevron-forward" size={16} color="#444" />
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgMain },

  header: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  scroll: { paddingHorizontal: 16 },

  groupLabel: {
    color: '#555',
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 28,
    marginBottom: 8,
    marginLeft: 4,
  },

  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },

  storageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 36,
  },
  storageLabel: {
    flex: 1,
    color: '#e8e8e8',
    fontSize: 15,
  },
  storageValue: {
    color: '#8E8E93',
    fontSize: 14,
    marginRight: 12,
  },
  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: '#48484A',
    minWidth: 52,
    alignItems: 'center',
  },
  clearBtnPressed: { opacity: 0.5 },
  clearBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  cacheHint: {
    color: '#8E8E93',
    fontSize: 12,
    marginTop: -4,
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#2a2a2a',
    marginHorizontal: -16,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 36,
    borderRadius: 8,
  },
  rowPressed: { opacity: 0.6 },
  iconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { flex: 1, color: '#e8e8e8', fontSize: 15 },
  rowHint: { color: '#8E8E93', fontSize: 14, marginRight: 2 },

  analyticsInfo: {
    paddingTop: 2,
  },
  analyticsInfoText: {
    color: '#8E8E93',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 10,
  },
  analyticsInfoLink: {
    color: Colors.brandPrimary,
    fontSize: 13,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },

  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 36,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  ratingExpandText: {
    color: '#8E8E93',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
    marginBottom: 12,
  },
  ratingBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  ratingBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: 'center',
  },
  ratingBtnPrimary: {
    backgroundColor: Colors.brandPrimary,
  },
  ratingBtnSecondary: {
    backgroundColor: '#2C2C2E',
  },
  ratingBtnPrimaryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  ratingBtnSecondaryText: {
    color: '#8E8E93',
    fontSize: 14,
  },

  version: {
    color: '#333',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 36,
  },
});
