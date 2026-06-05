import { MaterialIcons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { FriendItemRating } from '../../services/social';
import { useEscapeClose } from '../../hooks/use-escape-close';
import { getDetailPalette } from '../detail/detailTheme';

interface FriendsRatingsBlockProps {
  itemLabel: string;
  ratings: FriendItemRating[];
  variant?: 'default' | 'sidebar';
}

function statusLabel(status: string) {
  if (status === 'watching') return 'Viendo';
  if (status === 'playing') return 'Jugando';
  if (status === 'planned') return 'En lista';
  if (status === 'completed') return 'Completado';
  if (status === 'dropped') return 'Abandonado';
  return status;
}

export default function FriendsRatingsBlock({ itemLabel, ratings, variant = 'default' }: FriendsRatingsBlockProps) {
  const isDark = useColorScheme() === 'dark';
  const palette = getDetailPalette(isDark);
  const [expanded, setExpanded] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  useEscapeClose(isModalOpen, () => setIsModalOpen(false));

  const visible = useMemo(() => ratings.slice(0, expanded ? 5 : 3), [expanded, ratings]);

  if (ratings.length === 0) return null;

  return (
    <>
      <View style={[styles.section, variant === 'sidebar' && styles.sectionSidebar]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.title, { color: palette.text }]}>Tus amigos</Text>
          {variant !== 'sidebar' ? (
            <Text style={[styles.subtitle, { color: palette.subtext }]}>
              Quién ha visto {itemLabel === 'juego' ? 'este juego' : itemLabel === 'serie' ? 'esta serie' : 'esta película'}
            </Text>
          ) : null}
        </View>

        <View style={[styles.list, { backgroundColor: palette.elevated }]}>
          {visible.map((entry, index) => (
            <View
              key={entry.friendId}
              style={[
                variant === 'sidebar' ? styles.rowSidebar : styles.row,
                index < visible.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border },
              ]}
            >
              <View style={styles.nameCol}>
                <Text style={[styles.name, { color: palette.text }]} numberOfLines={1}>
                  {entry.friendName}
                </Text>
                <Text style={[styles.status, { color: palette.subtext }]}>{statusLabel(entry.status)}</Text>
              </View>
              <Text style={[styles.rating, { color: palette.brand }]}>{entry.rating.toFixed(1)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          {ratings.length > 3 ? (
            <TouchableOpacity onPress={() => setExpanded((prev) => !prev)}>
              <Text style={[styles.actionText, { color: palette.brand }]}>
                {expanded ? 'Mostrar menos' : 'Mostrar más'}
              </Text>
            </TouchableOpacity>
          ) : (
            <View />
          )}
          <TouchableOpacity
            onPress={() => setIsModalOpen(true)}
            style={[styles.allBtn, Platform.OS === 'web' && ({ cursor: 'pointer' } as any)]}
          >
            <Text style={[styles.actionText, { color: palette.subtext }]}>Ver todos</Text>
            <MaterialIcons name="chevron-right" size={16} color={palette.subtext} />
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={isModalOpen} transparent animationType="fade" onRequestClose={() => setIsModalOpen(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.modalCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: palette.text }]}>Tus amigos</Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                <MaterialIcons name="close" size={20} color={palette.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 340 }} contentContainerStyle={{ gap: 0 }}>
              {ratings.map((entry, index) => (
                <View
                  key={`${entry.friendId}-${entry.rating}`}
                  style={[
                    styles.row,
                    index < ratings.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: palette.border,
                    },
                  ]}
                >
                  <View style={styles.nameCol}>
                    <Text style={[styles.name, { color: palette.text }]} numberOfLines={1}>
                      {entry.friendName}
                    </Text>
                    <Text style={[styles.status, { color: palette.subtext }]}>{statusLabel(entry.status)}</Text>
                  </View>
                  <Text style={[styles.rating, { color: palette.brand }]}>{entry.rating.toFixed(1)}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 4,
    marginBottom: 8,
  },
  sectionSidebar: {
    marginTop: 0,
    marginBottom: 0,
  },
  sectionHeader: {
    marginBottom: 10,
    gap: 3,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  list: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  row: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  rowSidebar: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  nameCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  name: {
    fontSize: 13,
    fontWeight: '600',
  },
  status: {
    fontSize: 11,
    fontWeight: '500',
  },
  rating: {
    fontSize: 13,
    fontWeight: '700',
    minWidth: 28,
    textAlign: 'right',
  },
  actions: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  allBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  modalHeader: {
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
});
