import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import UserAvatar from './UserAvatar';
import type { FriendRequestItem } from '../../services/social';

interface FriendRequestsModalProps {
  visible: boolean;
  isDark?: boolean;
  requests: FriendRequestItem[];
  onClose: () => void;
  onAccept: (requestId: string) => void;
  onReject: (requestId: string) => void;
}

export default function FriendRequestsModal({
  visible,
  isDark = false,
  requests,
  onClose,
  onAccept,
  onReject,
}: FriendRequestsModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, isDark && styles.cardDark]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>Solicitudes ({requests.length})</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeText}>Cerrar</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.list}>
            {requests.length === 0 ? (
              <Text style={[styles.emptyText, { color: isDark ? '#94A3B8' : '#64748B' }]}>No tienes solicitudes pendientes.</Text>
            ) : (
              requests.map((request) => (
                <View key={request.id} style={[styles.row, isDark && styles.rowDark]}>
                  <View style={styles.mainInfo}>
                    <UserAvatar avatarUrl={request.fromProfile?.avatar_url ?? null} size={34} isDark={isDark} />
                    <View style={styles.textWrap}>
                      <Text style={[styles.name, { color: isDark ? '#E5E7EB' : '#0F172A' }]} numberOfLines={1}>
                        {request.fromName || 'Usuario'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.actions}>
                    <TouchableOpacity style={styles.acceptBtn} onPress={() => onAccept(request.id)}>
                      <Text style={styles.actionText}>Aceptar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.rejectBtn} onPress={() => onReject(request.id)}>
                      <Text style={styles.actionText}>Denegar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.58)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    padding: 14,
    maxHeight: '78%',
  },
  cardDark: {
    borderColor: '#1F2937',
    backgroundColor: '#0B1220',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
  },
  closeBtn: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
  },
  closeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  list: {
    gap: 8,
    paddingBottom: 6,
  },
  row: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 10,
    gap: 8,
  },
  rowDark: {
    borderColor: '#334155',
    backgroundColor: '#111827',
  },
  mainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  textWrap: {
    flex: 1,
  },
  name: {
    fontSize: 13,
    fontWeight: '800',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  acceptBtn: {
    borderRadius: 999,
    backgroundColor: '#16A34A',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  rejectBtn: {
    borderRadius: 999,
    backgroundColor: '#DC2626',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
