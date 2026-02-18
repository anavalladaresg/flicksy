import { MaterialIcons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { FriendItemRating } from '../../services/social';

interface FriendsRatingsBlockProps {
  itemLabel: string;
  ratings: FriendItemRating[];
}

function statusLabel(status: string) {
  if (status === 'watching') return 'Viendo';
  if (status === 'playing') return 'Jugando';
  if (status === 'planned') return 'Pendiente';
  if (status === 'completed') return 'Completado';
  if (status === 'dropped') return 'Abandonado';
  return status;
}

export default function FriendsRatingsBlock({ itemLabel, ratings }: FriendsRatingsBlockProps) {
  const isDark = useColorScheme() === 'dark';
  const [expanded, setExpanded] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const visible = useMemo(() => ratings.slice(0, expanded ? 5 : 3), [expanded, ratings]);

  if (ratings.length === 0) return null;

  return (
    <>
      <View style={[styles.card, isDark && styles.cardDark]}>
        <Text style={[styles.title, { color: isDark ? '#E5E7EB' : '#1E293B' }]}>
          Amigos han puntuado esta {itemLabel}
        </Text>
        {visible.map((entry) => (
          <View key={entry.friendId} style={[styles.row, isDark && styles.rowDark]}>
            <Text style={[styles.name, { color: isDark ? '#E5E7EB' : '#0F172A' }]} numberOfLines={1}>
              {entry.friendName}
            </Text>
            <View style={styles.meta}>
              <Text style={[styles.status, { color: isDark ? '#94A3B8' : '#64748B' }]}>{statusLabel(entry.status)}</Text>
              <Text style={styles.rating}>{entry.rating.toFixed(1)} ⭐️</Text>
            </View>
          </View>
        ))}
        <View style={styles.actions}>
          {ratings.length > 3 ? (
            <TouchableOpacity onPress={() => setExpanded((prev) => !prev)}>
              <Text style={styles.actionText}>{expanded ? 'Mostrar menos' : 'Mostrar más'}</Text>
            </TouchableOpacity>
          ) : (
            <View />
          )}
          <TouchableOpacity onPress={() => setIsModalOpen(true)} style={styles.allBtn}>
            <MaterialIcons name="groups" size={14} color="#0E7490" />
            <Text style={styles.actionText}>Ver todos</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={isModalOpen} transparent animationType="fade" onRequestClose={() => setIsModalOpen(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.modalCard, isDark && styles.modalCardDark]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>
                Puntuaciones de amigos
              </Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                <MaterialIcons name="close" size={18} color={isDark ? '#E5E7EB' : '#0F172A'} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ gap: 8 }}>
              {ratings.map((entry) => (
                <View key={`${entry.friendId}-${entry.rating}`} style={[styles.row, isDark && styles.rowDark]}>
                  <Text style={[styles.name, { color: isDark ? '#E5E7EB' : '#0F172A' }]} numberOfLines={1}>
                    {entry.friendName}
                  </Text>
                  <View style={styles.meta}>
                    <Text style={[styles.status, { color: isDark ? '#94A3B8' : '#64748B' }]}>{statusLabel(entry.status)}</Text>
                    <Text style={styles.rating}>{entry.rating.toFixed(1)} ⭐️</Text>
                  </View>
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
  card: {
    marginTop: 4,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#FCD34D',
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  cardDark: {
    backgroundColor: '#1F2937',
    borderColor: '#92400E',
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
  },
  row: {
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  rowDark: {
    borderColor: '#374151',
    backgroundColor: '#111827',
  },
  name: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
  meta: {
    alignItems: 'flex-end',
  },
  status: {
    fontSize: 11,
    fontWeight: '600',
  },
  rating: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '800',
    color: '#B45309',
  },
  actions: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0E7490',
  },
  allBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  modalCardDark: {
    backgroundColor: '#111827',
    borderColor: '#1F2937',
  },
  modalHeader: {
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
});

