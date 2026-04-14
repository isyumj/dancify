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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';

type Language = 'zh-Hans' | 'en';
const LANG_KEY = 'pref_language';

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
  const [videosBytes, setVideosBytes] = useState(0);
  const [cacheBytes, setCacheBytes] = useState(0);
  const [language, setLanguage] = useState<Language>('zh-Hans');
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
      AsyncStorage.getItem(LANG_KEY).then((v) => {
        if (v) setLanguage(v as Language);
      });
    }, [])
  );

  const LANG_LABELS: Record<Language, string> = { 'zh-Hans': '简体中文', en: 'English' };

  const handleClearCache = () => {
    Alert.alert(
      '清除缓存',
      '将删除应用临时文件，不影响已保存的视频。确认继续？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '清除',
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
              Alert.alert('完成', '缓存已清除');
            } catch (e) {
              Alert.alert('清除失败', String(e));
            } finally {
              setClearing(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>我的</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 存储管理 ── */}
        <Text style={styles.groupLabel}>存储管理</Text>
        <View style={styles.card}>
          {/* 视频库占用（不可点击） */}
          <View style={styles.storageItem}>
            <Text style={styles.storageLabel}>视频库占用</Text>
            <Text style={styles.storageValue}>{formatBytes(videosBytes)}</Text>
          </View>

          <View style={styles.divider} />

          {/* 临时缓存 + 清除按钮 */}
          <View style={styles.storageItem}>
            <Text style={styles.storageLabel}>临时缓存</Text>
            <Text style={styles.storageValue}>{formatBytes(cacheBytes)}</Text>
            <Pressable
              style={({ pressed }) => [styles.clearBtn, pressed && styles.clearBtnPressed]}
              onPress={handleClearCache}
              disabled={clearing}
            >
              {clearing ? (
                <ActivityIndicator size="small" color="#FF453A" />
              ) : (
                <Text style={styles.clearBtnText}>清除</Text>
              )}
            </Pressable>
          </View>

          <Text style={styles.cacheHint}>清除缓存不会删除你已导入的练习视频。</Text>
        </View>

        {/* ── 偏好设置 ── */}
        <Text style={styles.groupLabel}>偏好设置</Text>
        <View style={styles.card}>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => router.push('/language-modal')}
          >
            <View style={[styles.iconBox, { backgroundColor: Colors.bgCard }]}>
              <Ionicons name="language-outline" size={15} color="#fff" />
            </View>
            <Text style={styles.rowLabel}>语言设置</Text>
            <Text style={styles.rowHint}>{LANG_LABELS[language]}</Text>
            <Ionicons name="chevron-forward" size={16} color="#444" />
          </Pressable>
        </View>

        {/* ── 关于与支持 ── */}
        <Text style={styles.groupLabel}>关于与支持</Text>
        <View style={styles.card}>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => Alert.alert('隐私政策', '即将上线，敬请期待。')}
          >
            <View style={[styles.iconBox, { backgroundColor: Colors.bgCard }]}>
              <Ionicons name="shield-checkmark-outline" size={15} color="#fff" />
            </View>
            <Text style={styles.rowLabel}>隐私政策</Text>
            <Ionicons name="chevron-forward" size={16} color="#444" />
          </Pressable>

          <View style={styles.divider} />

          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => Alert.alert('用户反馈', '即将上线，敬请期待。')}
          >
            <View style={[styles.iconBox, { backgroundColor: Colors.bgCard }]}>
              <Ionicons name="chatbubble-ellipses-outline" size={15} color="#fff" />
            </View>
            <Text style={styles.rowLabel}>用户反馈</Text>
            <Ionicons name="chevron-forward" size={16} color="#444" />
          </Pressable>
        </View>

        {/* 版本号 */}
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

  // Storage list rows
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
    backgroundColor: Colors.bgCard,
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

  // Rows (偏好 / 关于)
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
