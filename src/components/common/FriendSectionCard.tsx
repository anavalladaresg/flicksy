import { MaterialIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import UserAvatar from './UserAvatar';
import CompatibilityHeartBadge from './CompatibilityHeartBadge';
import type { AddFriendSearchResult } from './AddFriendModal';

interface FriendPreviewItem {
  id: string;
  name: string;
  username?: string;
  avatarUrl?: string | null;
  compatibilityScore?: number | null;
  isOnline?: boolean;
}

interface FriendSectionCardProps {
  isDark?: boolean;
  friends: FriendPreviewItem[];
  friendCount: number;
  pendingRequestsCount: number;
  searchQuery: string;
  searchResults: AddFriendSearchResult[];
  searchLoading?: boolean;
  searchError?: string;
  onChangeSearchQuery: (query: string) => void;
  onOpenFriendsList: () => void;
  onOpenFriendLibrary: (friendId: string) => void;
  onOpenRequestsModal: () => void;
  onSendFriendRequest: (userId: string) => void;
  onCompatibilityLongPress?: (score: number) => void;
}

export default function FriendSectionCard({
  isDark = false,
  friends,
  friendCount,
  pendingRequestsCount,
  searchQuery,
  searchResults,
  searchLoading = false,
  searchError,
  onChangeSearchQuery,
  onOpenFriendsList,
  onOpenFriendLibrary,
  onOpenRequestsModal,
  onSendFriendRequest,
  onCompatibilityLongPress,
}: FriendSectionCardProps) {
  const [hoveredFriendId, setHoveredFriendId] = useState<string | null>(null);
  const visibleFriends = friends.slice(0, 5);
  const extraCount = Math.max(0, friendCount - visibleFriends.length);
  const showDropdown = searchQuery.trim().length > 0;

  return (
    <View style={[styles.card, isDark && styles.cardDark]}>
      <View style={styles.headerRow}>
        <View style={styles.titleWrap}>
          <Text style={[styles.title, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>Amigos</Text>
          <View style={[styles.countPill, isDark && styles.countPillDark]}>
            <Text style={[styles.countPillText, { color: isDark ? '#DBEAFE' : '#0C4A6E' }]}>{friendCount}</Text>
          </View>
          {pendingRequestsCount > 0 ? (
            <TouchableOpacity style={[styles.requestsChip, isDark && styles.requestsChipDark]} onPress={onOpenRequestsModal}>
              <Text style={[styles.requestsChipText, { color: isDark ? '#FECDD3' : '#9F1239' }]}>Solicitudes ({pendingRequestsCount})</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity onPress={onOpenFriendsList}>
          <Text style={[styles.linkText, { color: isDark ? '#7DD3FC' : '#0E7490' }]}>Ver todos →</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previewRow}>
        {visibleFriends.map((friend) => (
          <TouchableOpacity
            key={friend.id}
            style={styles.avatarItem}
            onPress={() => onOpenFriendLibrary(friend.id)}
            {...(Platform.OS === 'web'
              ? ({
                  onMouseEnter: () => setHoveredFriendId(friend.id),
                  onMouseLeave: () => setHoveredFriendId((current) => (current === friend.id ? null : current)),
                } as any)
              : null)}
          >
            {hoveredFriendId === friend.id && typeof friend.compatibilityScore === 'number' ? (
              <View style={[styles.compatibilityHint, isDark && styles.compatibilityHintDark]} pointerEvents="none">
                <Text
                  numberOfLines={1}
                  style={[
                    styles.compatibilityHintText,
                    isDark && styles.compatibilityHintTextDark,
                    Platform.OS === 'web' ? ({ whiteSpace: 'nowrap' } as any) : null,
                  ]}
                >
                  Compatibilidad {Math.round(friend.compatibilityScore)}%
                </Text>
              </View>
            ) : null}
            <View style={styles.avatarShell}>
              <UserAvatar avatarUrl={friend.avatarUrl ?? null} size={42} isDark={isDark} />
              {typeof friend.compatibilityScore === 'number' ? (
                <View style={styles.heartBadgeWrap}>
                  <CompatibilityHeartBadge
                    score={friend.compatibilityScore}
                    isDark={isDark}
                    onLongPress={() => onCompatibilityLongPress?.(friend.compatibilityScore as number)}
                  />
                </View>
              ) : null}
              {friend.isOnline ? <View style={styles.onlineDot} /> : null}
            </View>
            <Text style={[styles.avatarLabel, { color: isDark ? '#CBD5E1' : '#334155' }]} numberOfLines={1}>
              {friend.name}
            </Text>
          </TouchableOpacity>
        ))}
        {extraCount > 0 ? (
          <View style={styles.avatarItem}>
            <View style={[styles.moreAvatar, isDark && styles.moreAvatarDark]}>
              <Text style={[styles.moreAvatarText, { color: isDark ? '#BFDBFE' : '#0369A1' }]}>+{extraCount}</Text>
            </View>
            <Text style={[styles.avatarLabel, { color: isDark ? '#94A3B8' : '#64748B' }]} numberOfLines={1}>
              Más
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.searchWrap, isDark && styles.searchWrapDark]}>
        <MaterialIcons name="search" size={16} color={isDark ? '#94A3B8' : '#64748B'} />
        <TextInput
          value={searchQuery}
          onChangeText={onChangeSearchQuery}
          placeholder="Busca para añadir usuarios..."
          placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
          style={[styles.searchInput, { color: isDark ? '#E5E7EB' : '#0F172A' }]}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
      </View>

      {showDropdown ? (
        <View style={[styles.dropdown, isDark && styles.dropdownDark]}>
          {searchLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="small" color="#0E7490" />
            </View>
          ) : (
            <>
              {searchError ? <Text style={styles.errorText}>{searchError}</Text> : null}
              {!searchError && searchResults.length === 0 ? (
                <Text style={[styles.emptyText, { color: isDark ? '#94A3B8' : '#64748B' }]}>Sin resultados.</Text>
              ) : null}
              {searchResults.slice(0, 5).map((item, index, arr) => {
                const isAdd = item.state !== 'friend' && item.state !== 'sent';
                return (
                  <View
                    key={item.id}
                    style={[
                      styles.resultRow,
                      isDark && styles.resultRowDark,
                      index === 0 && styles.resultRowFirst,
                      index === arr.length - 1 && styles.resultRowLast,
                    ]}
                  >
                    <View style={styles.resultMain}>
                      <UserAvatar avatarUrl={item.avatarUrl ?? null} size={28} isDark={isDark} />
                      <Text style={[styles.resultName, { color: isDark ? '#E5E7EB' : '#0F172A' }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                    </View>
                    <TouchableOpacity
                      disabled={!isAdd}
                      style={[styles.resultAction, !isAdd && styles.resultActionDisabled]}
                      onPress={() => onSendFriendRequest(item.id)}
                    >
                      <Text style={[styles.resultActionText, !isAdd && styles.resultActionTextDisabled]}>
                        {item.state === 'friend' ? 'Ya es tu amigo' : item.state === 'sent' ? 'Enviada' : 'Añadir'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </>
          )}
        </View>
      ) : null}

      {pendingRequestsCount > 0 ? (
        <TouchableOpacity style={[styles.compactRequestsBtn, isDark && styles.compactRequestsBtnDark]} onPress={onOpenRequestsModal}>
          <Text style={[styles.compactRequestsText, { color: isDark ? '#FECACA' : '#991B1B' }]}>Ver solicitudes ({pendingRequestsCount})</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 11,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 4,
  },
  cardDark: {
    borderColor: '#1F2937',
    backgroundColor: '#111827',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flexWrap: 'wrap',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
  },
  countPill: {
    minWidth: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
  },
  countPillDark: {
    backgroundColor: '#1E3A8A',
  },
  countPillText: {
    fontSize: 11,
    fontWeight: '900',
  },
  requestsChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#FBCFE8',
    backgroundColor: '#FDF2F8',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  requestsChipDark: {
    borderColor: '#9D174D',
    backgroundColor: '#4A044E',
  },
  requestsChipText: {
    fontSize: 10,
    fontWeight: '800',
  },
  linkText: {
    fontSize: 12,
    fontWeight: '800',
  },
  previewRow: {
    gap: 12,
    paddingTop: 22,
    paddingLeft: 48,
    paddingRight: 48,
  },
  compatibilityHint: {
    position: 'absolute',
    top: -18,
    alignSelf: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CFFAFE',
    backgroundColor: '#ECFEFF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    zIndex: 9,
  },
  compatibilityHintDark: {
    borderColor: '#164E63',
    backgroundColor: '#082F49',
  },
  compatibilityHintText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  compatibilityHintTextDark: {
    color: '#E0F2FE',
  },
  avatarItem: {
    width: 58,
    alignItems: 'center',
    gap: 5,
    overflow: 'visible',
    position: 'relative',
  },
  avatarShell: {
    position: 'relative',
    overflow: 'visible',
  },
  heartBadgeWrap: {
    position: 'absolute',
    right: -2,
    top: -2,
    zIndex: 5,
  },
  onlineDot: {
    position: 'absolute',
    right: 1,
    bottom: 1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22C55E',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  avatarLabel: {
    width: '100%',
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
  },
  moreAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    backgroundColor: '#ECFEFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreAvatarDark: {
    borderColor: '#164E63',
    backgroundColor: '#082F49',
  },
  moreAvatarText: {
    fontSize: 12,
    fontWeight: '900',
  },
  searchWrap: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    minHeight: 40,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchWrapDark: {
    borderColor: '#334155',
    backgroundColor: '#0B1220',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 9,
  },
  dropdown: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  dropdownDark: {
    borderColor: '#334155',
    backgroundColor: '#0B1220',
  },
  loadingWrap: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  emptyText: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 12,
    fontWeight: '600',
  },
  errorText: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
  resultRow: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  resultRowDark: {
    borderTopColor: '#1F2937',
  },
  resultRowFirst: {
    borderTopWidth: 0,
  },
  resultRowLast: {
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  resultMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  resultName: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  resultAction: {
    borderRadius: 999,
    backgroundColor: '#0E7490',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  resultActionDisabled: {
    backgroundColor: '#E2E8F0',
  },
  resultActionText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  resultActionTextDisabled: {
    color: '#64748B',
  },
  compactRequestsBtn: {
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignSelf: 'flex-start',
  },
  compactRequestsBtnDark: {
    borderColor: '#7F1D1D',
    backgroundColor: '#3F0D0D',
  },
  compactRequestsText: {
    fontSize: 11,
    fontWeight: '800',
  },
});
