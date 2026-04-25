import React, { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View,
  Text,
  Image,
  FlatList,
  Pressable,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  getAllVideos,
  deleteVideo,
  renameVideo,
  getFilenamesByPrefix,
} from '../../db/database';
import { Colors } from '../../constants/theme';
import { Feather } from '@expo/vector-icons';
import { Video } from '../../types';
import { usePlayerStore } from '../../store/playerStore';
import { VideoActionSheet } from '../../components/VideoActionSheet';
import { ImportActionSheet } from '../../components/ImportActionSheet';
import { RenameModal } from '../../components/RenameModal';
import { BulkActionBar } from '../../components/BulkActionBar';

const COLUMNS = 2;
const GAP = 12;
const PADDING = 14;
const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = (SCREEN_WIDTH - PADDING * 2 - GAP * (COLUMNS - 1)) / COLUMNS;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

async function buildDestPath(sourceUri: string): Promise<{ filename: string; destPath: string }> {
  const ext = (sourceUri.split('/').pop() ?? '').match(/\.[^.]+$/)?.[0] ?? '.mp4';
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const baseDisplayName = `视频${dateStr}`;
  const existingNames = new Set(
    (await getFilenamesByPrefix(baseDisplayName)).map((n) => n.replace(/\.[^.]+$/, ''))
  );
  let displayName = baseDisplayName;
  if (existingNames.has(displayName)) {
    let i = 1;
    while (existingNames.has(`${baseDisplayName} (${i})`)) i++;
    displayName = `${baseDisplayName} (${i})`;
  }
  const filename = displayName + ext;
  const destDir = FileSystem.documentDirectory! + 'videos/';
  await FileSystem.makeDirectoryAsync(destDir, { intermediates: true });
  return { filename, destPath: destDir + filename };
}

// ─── Components ───────────────────────────────────────────────────────────────

function VideoGridItem({
  item,
  onOpen,
  onMorePress,
  isSelecting,
  isSelected,
  onToggleSelect,
}: {
  item: Video;
  onOpen: (v: Video) => void;
  onMorePress: (v: Video) => void;
  isSelecting: boolean;
  isSelected: boolean;
  onToggleSelect: (v: Video) => void;
}) {
  const displayName = item.filename.replace(/\.[^.]+$/, '');

  return (
    <View style={styles.card}>
      <Pressable
        style={styles.thumbContainer}
        onPress={() => isSelecting ? onToggleSelect(item) : onOpen(item)}
      >
        {item.thumbnailPath ? (
          <Image source={{ uri: item.thumbnailPath }} style={styles.thumbImage} resizeMode="cover" />
        ) : (
          <View style={styles.thumbPlaceholder}>
            <Text style={styles.thumbPlaceholderIcon}>▶</Text>
          </View>
        )}
        <View style={styles.durationBadge}>
          <Text style={styles.durationText}>{formatDuration(item.duration)}</Text>
        </View>
        {isSelecting && isSelected && (
          <View style={styles.selectedOverlay} />
        )}
        {isSelecting && (
          <View style={[styles.checkCircle, isSelected && styles.checkCircleSelected]}>
            {isSelected && <Feather name="check" size={12} color="#fff" />}
          </View>
        )}
      </Pressable>
      <View style={styles.cardFooter}>
        <Text style={styles.cardTitle} numberOfLines={1} onPress={() => isSelecting ? onToggleSelect(item) : onOpen(item)}>
          {displayName}
        </Text>
        {!isSelecting && (
          <Pressable onPress={() => onMorePress(item)} hitSlop={8} style={styles.moreBtn}>
            <Feather name="more-horizontal" size={18} color="#666" />
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function LibraryScreen() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionVideo, setActionVideo] = useState<Video | null>(null);
  const [renamingVideo, setRenamingVideo] = useState<Video | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [showImportSheet, setShowImportSheet] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const reset = usePlayerStore((s) => s.reset);
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const loadVideos = useCallback(async () => {
    const rows = await getAllVideos();
    setVideos(rows);
  }, []);

  useFocusEffect(useCallback(() => {
    loadVideos();
  }, [loadVideos]));

  const handleImportFromPhotos = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: false,
      quality: 1,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setLoading(true);
    try {
      const { filename, destPath } = await buildDestPath(asset.uri);
      await FileSystem.copyAsync({ from: asset.uri, to: destPath });
      const duration = asset.duration ? asset.duration / 1000 : 0;
      reset();
      router.push({
        pathname: '/player',
        params: { tempPath: destPath, filename, duration: String(duration) },
      });
    } catch (e) {
      Alert.alert(t('library.importFailed'), String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleImportFromFiles = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'video/*',
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setLoading(true);
    try {
      const { filename, destPath } = await buildDestPath(asset.uri);
      await FileSystem.copyAsync({ from: asset.uri, to: destPath });
      reset();
      router.push({
        pathname: '/player',
        params: { tempPath: destPath, filename, duration: '0' },
      });
    } catch (e) {
      Alert.alert(t('library.importFailed'), String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleImport = () => setShowImportSheet(true);

  const handleOpen = (video: Video) => {
    reset();
    router.push({ pathname: '/player', params: { videoId: String(video.id) } });
  };

  const handleDelete = () => {
    if (!actionVideo) return;
    const video = actionVideo;
    setActionVideo(null);
    Alert.alert(
      t('library.deleteTitle'),
      t('library.deleteConfirm', { name: video.filename.replace(/\.[^.]+$/, '') }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('library.deleteBtn'),
          style: 'destructive',
          onPress: async () => {
            try { await FileSystem.deleteAsync(video.localPath, { idempotent: true }); } catch {}
            await deleteVideo(video.id);
            await loadVideos();
          },
        },
      ]
    );
  };

  const handleRenameOpen = () => {
    setRenamingVideo(actionVideo);
    setActionVideo(null);
  };

  const handleRenameConfirm = async (newName: string) => {
    if (!renamingVideo) return;
    const ext = renamingVideo.filename.match(/\.[^.]+$/)?.[0] ?? '';
    try {
      await renameVideo(renamingVideo.id, newName + ext);
      await loadVideos();
    } catch {
      Alert.alert(t('library.renameFailed'));
    } finally {
      setRenamingVideo(null);
    }
  };

  const handleToggleSelect = (video: Video) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(video.id) ? next.delete(video.id) : next.add(video.id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === videos.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(videos.map(v => v.id)));
    }
  };

  const handleCancelSelect = () => {
    setIsSelecting(false);
    setSelectedIds(new Set());
  };

  const handleBulkDelete = () => {
    Alert.alert(
      t('library.deleteTitle'),
      t('library.bulkDeleteConfirm', { count: selectedIds.size }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('library.deleteBtn'),
          style: 'destructive',
          onPress: async () => {
            for (const id of selectedIds) {
              const video = videos.find(v => v.id === id);
              if (video) {
                try { await FileSystem.deleteAsync(video.localPath, { idempotent: true }); } catch {}
                await deleteVideo(id);
              }
            }
            setIsSelecting(false);
            setSelectedIds(new Set());
            await loadVideos();
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Dancify</Text>
      </View>
      <FlatList
        data={videos}
        keyExtractor={(item) => String(item.id)}
        numColumns={COLUMNS}
        columnWrapperStyle={styles.row}
        contentContainerStyle={[
          videos.length === 0 ? styles.emptyContainer : styles.grid,
          isSelecting && styles.gridWithBar,
        ]}
        ListHeaderComponent={
          <View>
            <Pressable
              style={styles.importBanner}
              onPress={handleImport}
              disabled={loading || isSelecting}
            >
              <LinearGradient
                colors={['#4A4A4E', '#2E2E32']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.importBox}
              >
                <View style={styles.importIconWrapper}>
                  <Text style={styles.importPlus}>＋</Text>
                </View>
                <Text style={styles.importLabel}>{t('library.importBanner')}</Text>
              </LinearGradient>
            </Pressable>
            {videos.length > 0 && (
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>{t('library.sectionTitle')}</Text>
                {isSelecting ? (
                  <View style={styles.selectingActions}>
                    <TouchableOpacity onPress={handleSelectAll} activeOpacity={0.7}>
                      <Text style={styles.selectAllText}>
                        {selectedIds.size === videos.length
                          ? t('library.deselectAll')
                          : t('library.selectAll')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleCancelSelect} activeOpacity={0.7} style={styles.manageBtn}>
                      <Text style={styles.manageBtnText}>{t('common.cancel')}</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity onPress={() => setIsSelecting(true)} activeOpacity={0.7} style={styles.manageBtn}>
                    <Text style={styles.manageBtnText}>{t('library.manage')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t('library.emptyTitle')}</Text>
            <Text style={styles.emptySubtext}>{t('library.emptySubtitle')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <VideoGridItem
            item={item}
            onOpen={handleOpen}
            onMorePress={setActionVideo}
            isSelecting={isSelecting}
            isSelected={selectedIds.has(item.id)}
            onToggleSelect={handleToggleSelect}
          />
        )}
      />

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={Colors.brandPrimary} />
          <Text style={styles.loadingText}>{t('library.importing')}</Text>
        </View>
      )}

      <ImportActionSheet
        visible={showImportSheet}
        onSelectPhotos={handleImportFromPhotos}
        onSelectFiles={handleImportFromFiles}
        onClose={() => setShowImportSheet(false)}
      />

      <VideoActionSheet
        video={actionVideo}
        onRename={handleRenameOpen}
        onDelete={handleDelete}
        onClose={() => setActionVideo(null)}
      />

      <RenameModal
        visible={renamingVideo !== null}
        currentName={renamingVideo?.filename.replace(/\.[^.]+$/, '') ?? ''}
        onConfirm={handleRenameConfirm}
        onCancel={() => setRenamingVideo(null)}
      />

      <BulkActionBar
        visible={isSelecting}
        selectedCount={selectedIds.size}
        totalCount={videos.length}
        onSelectAll={handleSelectAll}
        onDelete={handleBulkDelete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgMain },
  grid: { paddingHorizontal: PADDING, paddingVertical: 12, gap: GAP },
  gridWithBar: { paddingBottom: 100 },
  row: { gap: GAP },
  emptyContainer: { flex: 1 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyText: { color: Colors.textPrimary, fontSize: 17, fontWeight: '600' },
  emptySubtext: { color: Colors.textSecondary, fontSize: 14 },
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
  manageBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.bgCard,
  },
  manageBtnText: { color: Colors.textPrimary, fontSize: 14, fontWeight: '500' },

  card: { width: CARD_WIDTH, gap: 6 },
  thumbContainer: {
    width: CARD_WIDTH,
    height: CARD_WIDTH,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: Colors.bgCard,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  thumbPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgCard,
  },
  thumbPlaceholderIcon: { fontSize: 28, color: '#444' },
  durationBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  durationText: { color: Colors.textPrimary, fontSize: 11, fontWeight: '600' },
  selectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(145, 99, 243, 0.35)',
  },
  checkCircle: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  checkCircleSelected: {
    backgroundColor: Colors.brandPrimary,
    borderColor: Colors.brandPrimary,
  },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardTitle: { flex: 1, color: '#ccc', fontSize: 12, lineHeight: 16 },
  moreBtn: { padding: 2 },

  importBanner: {
    paddingHorizontal: PADDING,
    paddingTop: 12,
    paddingBottom: 12,
    alignItems: 'center',
  },
  importBox: {
    width: SCREEN_WIDTH - PADDING * 2,
    height: 140,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  importIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  importPlus: { color: Colors.textPrimary, fontSize: 36, lineHeight: 40 },
  importLabel: { color: Colors.textPrimary, fontSize: 14, marginTop: 0 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: PADDING, paddingTop: 16, paddingBottom: 8 },
  selectingActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectAllText: { color: Colors.brandPrimary, fontSize: 14, fontWeight: '500', paddingHorizontal: 8, paddingVertical: 8 },
  sectionTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '700' },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: { color: Colors.textPrimary, fontSize: 15 },
});
