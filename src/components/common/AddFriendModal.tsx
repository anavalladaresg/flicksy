import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import UserAvatar from './UserAvatar';

export interface AddFriendSearchResult {
  id: string;
  name: string;
  username: string;
  avatarUrl?: string | null;
  state?: 'add' | 'sent' | 'friend';
}

interface AddFriendModalProps {
  visible: boolean;
  isDark?: boolean;
  query: string;
  loading?: boolean;
  error?: string;
  results: AddFriendSearchResult[];
  onClose: () => void;
  onChangeQuery: (query: string) => void;
  onSendRequest: (userId: string) => void;
}

export default function AddFriendModal({
  visible,
  isDark = false,
  query,
  loading = false,
  error,
  results,
  onClose,
  onChangeQuery,
  onSendRequest,
}: AddFriendModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, isDark && styles.cardDark]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>Añadir amigo</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeText}>Cerrar</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.searchWrap, isDark && styles.searchWrapDark]}>
            <MaterialIcons name="search" size={16} color={isDark ? '#94A3B8' : '#64748B'} />
            <TextInput
              value={query}
              onChangeText={onChangeQuery}
              placeholder="Buscar usuario..."
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              style={[styles.searchInput, { color: isDark ? '#E5E7EB' : '#0F172A' }]}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
          </View>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="small" color="#0E7490" />
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
              {query.trim().length < 2 ? (
                <Text style={[styles.infoText, { color: isDark ? '#94A3B8' : '#64748B' }]}>Escribe al menos 2 caracteres.</Text>
              ) : null}
              {query.trim().length >= 2 && results.length === 0 ? (
                <Text style={[styles.infoText, { color: isDark ? '#94A3B8' : '#64748B' }]}>Sin resultados.</Text>
              ) : null}
              {!!error ? <Text style={[styles.errorText, { color: '#DC2626' }]}>{error}</Text> : null}
              {results.map((item) => {
                const isAdd = item.state !== 'friend' && item.state !== 'sent';
                return (
                  <View key={item.id} style={[styles.resultRow, isDark && styles.resultRowDark]}>
                    <View style={styles.resultMain}>
                      <UserAvatar avatarUrl={item.avatarUrl ?? null} size={30} isDark={isDark} />
                      <View style={styles.resultTextWrap}>
                        <Text style={[styles.resultName, { color: isDark ? '#E5E7EB' : '#0F172A' }]} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text style={[styles.resultUsername, { color: isDark ? '#94A3B8' : '#64748B' }]} numberOfLines={1}>
                          @{item.username}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      disabled={!isAdd}
                      style={[styles.addBtn, !isAdd && styles.addBtnDisabled]}
                      onPress={() => onSendRequest(item.id)}
                    >
                      <Text style={[styles.addBtnText, !isAdd && styles.addBtnTextDisabled]}>
                        {item.state === 'friend' ? 'Ya es tu amigo' : item.state === 'sent' ? 'Solicitud enviada' : 'Añadir'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
          )}
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
    maxHeight: '80%',
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
  searchWrap: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    minHeight: 42,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchWrapDark: {
    borderColor: '#334155',
    backgroundColor: '#111827',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 10,
  },
  loadingWrap: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  list: {
    paddingTop: 10,
    gap: 8,
    paddingBottom: 6,
  },
  infoText: {
    fontSize: 12,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 12,
    fontWeight: '700',
  },
  resultRow: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  resultRowDark: {
    borderColor: '#334155',
    backgroundColor: '#111827',
  },
  resultMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  resultTextWrap: {
    flex: 1,
  },
  resultName: {
    fontSize: 13,
    fontWeight: '800',
  },
  resultUsername: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  addBtn: {
    borderRadius: 999,
    backgroundColor: '#0E7490',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  addBtnDisabled: {
    backgroundColor: '#E2E8F0',
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  addBtnTextDisabled: {
    color: '#64748B',
  },
});
