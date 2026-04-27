import React from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Video } from '../types';

interface Props {
  video: Video | null;
  onRename: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function VideoActionSheet({ video, onRename, onDelete, onClose }: Props) {
  const { t } = useTranslation();
  const displayName = video?.filename.replace(/\.[^.]+$/, '') ?? '';

  return (
    <Modal
      visible={video !== null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          {/* 视频信息头 */}
          <View style={styles.header}>
            <View style={styles.headerThumb}>
              <Feather name="film" size={20} color="#666" />
            </View>
            <View style={styles.headerInfo}>
              <Text style={styles.headerTitle} numberOfLines={1}>{displayName}</Text>
              <Text style={styles.headerSub}>{video ? fmtDuration(video.duration) : ''}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* 操作列表 */}
          <Pressable style={styles.action} onPress={onRename}>
            <Feather name="edit-2" size={20} color="#ccc" />
            <Text style={styles.actionText} numberOfLines={1}>{t('library.rename')}</Text>
          </Pressable>

          <Pressable style={styles.action} onPress={onDelete}>
            <Feather name="trash-2" size={20} color="#f87171" />
            <Text style={[styles.actionText, styles.actionTextDanger]} numberOfLines={1}>{t('library.deleteBtn')}</Text>
          </Pressable>

          {/* 取消 */}
          <Pressable style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText} numberOfLines={1}>{t('common.cancel')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function fmtDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 36,
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  headerThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  headerSub: {
    color: '#666',
    fontSize: 13,
  },
  divider: {
    height: 1,
    backgroundColor: '#2a2a2a',
    marginVertical: 8,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  actionText: {
    color: '#ccc',
    fontSize: 16,
  },
  actionTextDanger: {
    color: '#f87171',
  },
  cancelBtn: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
  },
  cancelText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
