import React, { useState, useCallback, useMemo } from 'react';
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
import type { ImagePickerAsset } from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { getThumbnailAsync } from 'expo-video-thumbnails';
import { Video as VideoCompressor } from 'react-native-compressor';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  getAllVideos,
  deleteVideo,
  renameVideo,
  getFilenamesByPrefix,
  insertVideo,
} from '../../db/database';
import { Colors } from '../../constants/theme';
import { Feather } from '@expo/vector-icons';
import { Video } from '../../types';
import { usePlayerStore } from '../../store/playerStore';
import { useImportStore, PendingImport } from '../../store/importStore';
import { VideoActionSheet } from '../../components/VideoActionSheet';
import { RenameModal } from '../../components/RenameModal';
import { BulkActionBar } from '../../components/BulkActionBar';

const COLUMNS = 2;
const GAP = 12;
const PADDING = 14;
const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = (SCREEN_WIDTH - PADDING * 2 - GAP * (COLUMNS - 1)) / COLUMNS;

// ─── Types ────────────────────────────────────────────────────────────────────

type LibraryItem =
  | { _type: 'video'; data: Video }
  | { _type: 'pending'; data: PendingImport };

// ─── Background import ────────────────────────────────────────────────────────
//
// Thread-safety model (React Native / Expo):
//
//   • getThumbnailAsync and FileSystem.copyAsync both delegate work to native
//     background threads and resolve to JS via the bridge — equivalent to
//     running a Swift Task on a background actor and resuming on @MainActor.
//
//   • The JS `await` suspends this async function without blocking the JS event
//     loop or React's UI thread (they run on separate OS threads in RN).
//
//   • Zustand's `set()` is posted on the JS thread and React batches the
//     resulting state update onto the UI thread — equivalent to
//     DispatchQueue.main.async { self.objectWillChange.send() } in SwiftUI.
//
// Progress wiring:
//
//   FileSystem.copyAsync has no progress signal, so the placeholder card shows
//   an indeterminate ActivityIndicator. When you add a real compressor that
//   exposes a progress callback (ffmpeg-kit, react-native-compressor), call
//   setProgress() from inside that callback:
//
//     await VideoCompressor.compress(asset.uri, options, (p) => {
//       useImportStore.getState().setProgress(tempId, p); // safe from bridge thread
//     });
//
async function runBackgroundImport(
  asset: ImagePickerAsset,
  onSuccess: () => void,
  onError: (e: unknown) => void,
): Promise<void> {
  const { add, remove, markNew } = useImportStore.getState();

  const ext = (asset.uri.split('/').pop() ?? '').match(/\.[^.]+$/)?.[0] ?? '.mp4';
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
  const duration = asset.duration ? asset.duration / 1000 : 0;
  const tempId = `pending_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  // Phase 1: Extract thumbnail from source URI — native, ~200ms, off UI thread
  let thumbnailUri: string | null = null;
  try {
    const thumb = await getThumbnailAsync(asset.uri, { time: 0 });
    thumbnailUri = thumb.uri;
  } catch {}

  // Phase 2: Add placeholder card — list re-renders immediately on the UI thread
  add({ tempId, filename, duration, thumbnailUri, progress: 0 });

  // Phase 3: Compress to 720p on native thread — JS event loop stays unblocked.
  //
  // iOS: delegates to AVAssetExportSession on a background dispatch queue.
  //      AVFoundation guarantees the main thread is never touched.
  // Android: uses MediaCodec on a dedicated encoder thread.
  //
  // Progress fires via NativeEventEmitter → JS bridge → Zustand set().
  // Zustand set() posts a re-render onto React's scheduler; the UI thread
  // picks it up on its next vsync — identical to the @MainActor pattern in Swift.
  //
  // Skip re-encoding if the source is already ≤ 720p; just do a fast file copy.
  try {
    const destDir = FileSystem.documentDirectory! + 'videos/';
    await FileSystem.makeDirectoryAsync(destDir, { intermediates: true });
    const destPath = destDir + filename;

    const sourceLargestDim =
      asset.width && asset.height
        ? Math.max(asset.width, asset.height)
        : Infinity; // unknown resolution → compress to be safe

    if (sourceLargestDim > 1280) {
      // Source is larger than 720p — encode down with react-native-compressor.
      //
      // maxSize: 1280  → caps the largest dimension at 1280 px.
      //   Portrait 4K (2160×3840) → 720×1280  (720p portrait) ✓
      //   Landscape 4K (3840×2160) → 1280×720  (720p landscape) ✓
      //   1080p portrait (1080×1920) → 720×1280 ✓
      //
      // bitrate: 3 000 000 bps (3 Mbps)
      //   H.264 at 30 fps, 720p.  3 Mbps handles fast-motion dance content
      //   without visible macro-blocking; Netflix targets 2.8 Mbps at the
      //   same resolution.
      //
      // compressionMethod: 'manual'
      //   Gives us exact bitrate control instead of letting AVFoundation
      //   pick a quality preset ('auto' maps to AVAssetExportPresetMediumQuality
      //   whose bitrate is unspecified and varies by device).
      const compressedUri = await VideoCompressor.compress(
        asset.uri,
        {
          compressionMethod: 'manual',
          maxSize: 1280,
          bitrate: 3_000_000,
          minimumFileSizeForCompress: 0, // always encode, ignore file size
        },
        (progress) => {
          // Called from the native bridge thread — safe to call Zustand here.
          // Equivalent to DispatchQueue.main.async { self.progress = progress } in Swift.
          useImportStore.getState().setProgress(tempId, progress);
        }
      );
      // Move the compressor's temp output into our persistent app storage.
      // moveAsync is a rename syscall (no copy) when src and dst are on the
      // same filesystem partition — O(1) regardless of file size.
      await FileSystem.moveAsync({ from: compressedUri, to: destPath });
    } else {
      // Already ≤ 720p — raw copy, no re-encoding.
      await FileSystem.copyAsync({ from: asset.uri, to: destPath });
    }

    // Phase 4: Persist to SQLite (WAL mode, concurrent-read safe)
    const videoId = await insertVideo(filename, duration, destPath, thumbnailUri ?? undefined);

    // Phase 5: Remove placeholder, flag video for first-open SetupSheet
    remove(tempId);
    markNew(videoId);
    onSuccess();
  } catch (e) {
    remove(tempId);
    onError(e);
  }
}

// ─── Components ───────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/** Placeholder card shown while a video is being compressed and saved. */
function PendingVideoGridItem({ item }: { item: PendingImport }) {
  const displayName = item.filename.replace(/\.[^.]+$/, '');
  const pct = Math.round(item.progress * 100);

  return (
    <View style={styles.card}>
      <View style={styles.thumbContainer}>
        {item.thumbnailUri ? (
          <Image source={{ uri: item.thumbnailUri }} style={styles.thumbImage} resizeMode="cover" />
        ) : (
          <View style={styles.thumbPlaceholder} />
        )}

        {/* Translucent overlay: spinner before first progress tick, percentage after */}
        <View style={styles.pendingOverlay} pointerEvents="none">
          {item.progress > 0 ? (
            <Text style={styles.pendingPct}>{pct}%</Text>
          ) : (
            <ActivityIndicator size="large" color="#fff" />
          )}
        </View>

        {/* Determinate progress bar along the bottom edge of the thumbnail */}
        <View style={styles.progressBarTrack} pointerEvents="none">
          <View style={[styles.progressBarFill, { width: `${pct}%` }]} />
        </View>
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.cardTitle} numberOfLines={1}>{displayName}</Text>
      </View>
    </View>
  );
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
  const [actionVideo, setActionVideo] = useState<Video | null>(null);
  const [renamingVideo, setRenamingVideo] = useState<Video | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const reset = usePlayerStore((s) => s.reset);
  const pendingImports = useImportStore((s) => s.pending);
  const consumeNew = useImportStore((s) => s.consumeNew);
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const loadVideos = useCallback(async () => {
    const rows = await getAllVideos();
    setVideos(rows);
  }, []);

  useFocusEffect(useCallback(() => {
    loadVideos();
  }, [loadVideos]));

  // Pending imports appear at the top of the grid while being processed
  const listData = useMemo<LibraryItem[]>(
    () => [
      ...pendingImports.map((p): LibraryItem => ({ _type: 'pending', data: p })),
      ...videos.map((v): LibraryItem => ({ _type: 'video', data: v })),
    ],
    [pendingImports, videos],
  );

  const handleImport = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: false,
      quality: 1,
    });
    if (result.canceled || !result.assets[0]) return;

    // Fire-and-forget: placeholder appears immediately via Zustand.
    // No blocking overlay, no navigation — user stays on the library screen.
    runBackgroundImport(
      result.assets[0],
      loadVideos,
      (e) => Alert.alert(t('library.importFailed'), String(e)),
    );
  };

  const handleOpen = (video: Video) => {
    reset();
    const isNew = consumeNew(video.id);
    router.push({
      pathname: '/player',
      params: { videoId: String(video.id), ...(isNew ? { isNew: 'true' } : {}) },
    });
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
        data={listData}
        keyExtractor={(item) =>
          item._type === 'pending'
            ? `pending_${item.data.tempId}`
            : String(item.data.id)
        }
        numColumns={COLUMNS}
        columnWrapperStyle={styles.row}
        contentContainerStyle={[
          listData.length === 0 ? styles.emptyContainer : styles.grid,
          isSelecting && styles.gridWithBar,
        ]}
        ListHeaderComponent={
          <View>
            <Pressable
              style={styles.importBanner}
              onPress={handleImport}
              disabled={isSelecting}
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
            {listData.length > 0 && (
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
        renderItem={({ item }) => {
          if (item._type === 'pending') {
            return <PendingVideoGridItem item={item.data} />;
          }
          return (
            <VideoGridItem
              item={item.data}
              onOpen={handleOpen}
              onMorePress={setActionVideo}
              isSelecting={isSelecting}
              isSelected={selectedIds.has(item.data.id)}
              onToggleSelect={handleToggleSelect}
            />
          );
        }}
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

  /** Translucent overlay on the pending card. Shows spinner or percentage. */
  pendingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pendingPct: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  /** Thin progress bar anchored to the bottom of the thumbnail. */
  progressBarTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.brandPrimary,
    borderRadius: 1.5,
  },

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
});
