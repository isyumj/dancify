import React, { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View,
  Text,
  FlatList,
  Pressable,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { router } from 'expo-router';
import { getAllVideos, deleteVideo, renameVideo } from '../../db/database';
import { Feather } from '@expo/vector-icons';
import { Video } from '../../types';
import { usePlayerStore } from '../../store/playerStore';
import { VideoActionSheet } from '../../components/VideoActionSheet';
import { RenameModal } from '../../components/RenameModal';
import { BulkActionBar } from '../../components/BulkActionBar';

const COLUMNS = 2;
const GAP = 12;
const PADDING = 14;
const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = (SCREEN_WIDTH - PADDING * 2 - GAP * (COLUMNS - 1)) / COLUMNS;

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

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
        <View style={styles.thumbPlaceholder}>
          <Text style={styles.thumbPlaceholderIcon}>▶</Text>
        </View>
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

export default function LibraryScreen() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionVideo, setActionVideo] = useState<Video | null>(null);
  const [renamingVideo, setRenamingVideo] = useState<Video | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const reset = usePlayerStore((s) => s.reset);
  const insets = useSafeAreaInsets();

  const loadVideos = useCallback(async () => {
    const rows = await getAllVideos();
    setVideos(rows);
  }, []);

  useFocusEffect(useCallback(() => {
    loadVideos();
  }, [loadVideos]));

  const handleImport = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: false,
      quality: 1,
    });

    if (result.canceled || !result.assets[0]) return;

    setLoading(true);
    try {
      const asset = result.assets[0];
      const filename = asset.uri.split('/').pop() ?? `video_${Date.now()}.mp4`;
      const destDir = FileSystem.documentDirectory + 'videos/';
      await FileSystem.makeDirectoryAsync(destDir, { intermediates: true });
      const destPath = destDir + filename;
      await FileSystem.copyAsync({ from: asset.uri, to: destPath });

      const duration = asset.duration ? asset.duration / 1000 : 0;

      reset();
      router.push({
        pathname: '/player',
        params: { tempPath: destPath, filename, duration: String(duration) },
      });
    } catch (e) {
      Alert.alert('导入失败', String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = (video: Video) => {
    reset();
    router.push({ pathname: '/player', params: { videoId: String(video.id) } });
  };

  const handleDelete = () => {
    if (!actionVideo) return;
    const video = actionVideo;
    setActionVideo(null);
    Alert.alert('删除视频', `确认删除「${video.filename.replace(/\.[^.]+$/, '')}」？相关片段也会一并删除。`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          try { await FileSystem.deleteAsync(video.localPath, { idempotent: true }); } catch {}
          await deleteVideo(video.id);
          await loadVideos();
        },
      },
    ]);
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
      Alert.alert('重命名失败', '请重试');
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
    Alert.alert('删除视频', `确认删除选中的 ${selectedIds.size} 个视频？相关片段也会一并删除。`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
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
    ]);
  };

  return (
    <View style={styles.container}>
      {/* 自定义顶部栏 */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerSide} />
        <Text style={styles.headerTitle}>Dancify</Text>
        <View style={[styles.headerSide, { alignItems: 'flex-end' }]} />
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
              <View style={styles.importBox}>
                <Text style={styles.importPlus}>＋</Text>
                <Text style={styles.importLabel}>导入视频开始练习</Text>
              </View>
            </Pressable>
            {videos.length > 0 && (
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>我的视频</Text>
                {isSelecting ? (
                  <View style={styles.selectingActions}>
                    <TouchableOpacity onPress={handleSelectAll} activeOpacity={0.7}>
                      <Text style={styles.selectAllText}>
                        {selectedIds.size === videos.length ? '取消全选' : '全选'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleCancelSelect} activeOpacity={0.7} style={styles.manageBtn}>
                      <Text style={styles.manageBtnText}>取消</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity onPress={() => setIsSelecting(true)} activeOpacity={0.7} style={styles.manageBtn}>
                    <Text style={styles.manageBtnText}>管理</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>还没有视频</Text>
            <Text style={styles.emptySubtext}>导入一个视频开始练习吧</Text>
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
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>导入中…</Text>
        </View>
      )}

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
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  grid: { paddingHorizontal: PADDING, paddingVertical: 12, gap: GAP },
  gridWithBar: { paddingBottom: 100 },
  row: { gap: GAP },
  emptyContainer: { flex: 1 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  emptySubtext: { color: '#666', fontSize: 14 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  headerSide: {
    width: 72,
    alignItems: 'flex-start',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  manageBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#2a2a2a',
  },
  manageBtnText: { color: '#fff', fontSize: 14, fontWeight: '500' },

  card: { width: CARD_WIDTH, gap: 6 },
  thumbContainer: {
    width: CARD_WIDTH,
    height: CARD_WIDTH,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  thumbPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e1e1e',
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
  durationText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  selectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(33, 107, 255, 0.35)',
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
    backgroundColor: '#216BFF',
    borderColor: '#216BFF',
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
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#333',
    borderStyle: 'dashed',
    backgroundColor: '#141414',
    alignItems: 'center',
    justifyContent: 'center',
  },
  importPlus: { color: '#555', fontSize: 48, lineHeight: 56 },
  importLabel: { color: '#555', fontSize: 14, marginTop: 8 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: PADDING, paddingTop: 16, paddingBottom: 8 },
  selectingActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectAllText: { color: '#216BFF', fontSize: 14, fontWeight: '500', paddingHorizontal: 8, paddingVertical: 8 },
  sectionTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: { color: '#fff', fontSize: 15 },
});
