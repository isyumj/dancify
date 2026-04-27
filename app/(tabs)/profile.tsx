import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors } from '../../constants/theme';

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

  const loadStorage = useCallback(async () => {
    try {
      const [vb, cb] = await Promise.all([
        dirSize(FileSystem.documentDirectory + 'videos/'),
        dirSize(FileSystem.cacheDirectory ?? ''),
      ]);
      setVideosBytes(vb);
      setCacheBytes(cb);
    } catch (e) {
      console.error('storage load error', e);
    }
  }, []);

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
        </View>

        {/* ── About ── */}
        <Text style={styles.groupLabel}>{t('profile.about.title')}</Text>
        <View style={styles.card}>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => Alert.alert(t('profile.about.privacy'), t('common.comingSoon'))}
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
            onPress={() => Alert.alert(t('profile.about.feedback'), t('common.comingSoon'))}
          >
            <View style={[styles.iconBox, { backgroundColor: Colors.bgCard }]}>
              <Ionicons name="chatbubble-ellipses-outline" size={15} color="#fff" />
            </View>
            <Text style={styles.rowLabel}>{t('profile.about.feedback')}</Text>
            <Ionicons name="chevron-forward" size={16} color="#444" />
          </Pressable>
        </View>

        <Text style={styles.version}>Dancify  v1.0.0</Text>
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

  version: {
    color: '#333',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 36,
  },
});
