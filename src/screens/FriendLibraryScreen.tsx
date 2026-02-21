import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Image, Modal, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import UserAvatar from '../components/common/UserAvatar';
import { TMDB_IMAGE_BASE_URL } from '../constants/config';
import { useEscapeClose } from '../hooks/use-escape-close';
import { getFriendLibrary } from '../services/social';
import { useTrackingStore } from '../store/tracking';
import type { MediaType, TrackedItem } from '../types';
import MagicLoader from '@/components/loaders/MagicLoader';

const FALLBACK_IMAGE = require('../../assets/images/icon.png');
type Filter = 'all' | MediaType;
type SortBy = 'recent' | 'oldest' | 'rating' | 'title' | 'status';

const SORT_OPTIONS: { value: SortBy; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { value: 'recent', label: 'Reciente', icon: 'schedule' },
  { value: 'rating', label: 'Puntuación', icon: 'star' },
  { value: 'title', label: 'A-Z', icon: 'sort-by-alpha' },
  { value: 'status', label: 'Estado', icon: 'flag' },
  { value: 'oldest', label: 'Antiguo', icon: 'history' },
];

function resolvePoster(item: TrackedItem): string | null {
  if (!item.posterPath) return null;
  if (/^[a-z0-9]{8,}$/i.test(item.posterPath) && !item.posterPath.includes('/')) {
    return `https://images.igdb.com/igdb/image/upload/t_cover_big_2x/${item.posterPath}.jpg`;
  }
  if (item.posterPath.startsWith('/')) return `${TMDB_IMAGE_BASE_URL}${item.posterPath}`;
  if (item.posterPath.startsWith('//')) return `https:${item.posterPath}`.replace('/t_thumb/', '/t_cover_big_2x/');
  if (item.posterPath.startsWith('http')) return item.posterPath.replace('/t_thumb/', '/t_cover_big_2x/');
  return `https://${item.posterPath}`.replace('/t_thumb/', '/t_cover_big_2x/');
}

function statusLabel(status: TrackedItem['status']) {
  if (status === 'planned') return 'Pendiente';
  if (status === 'watching') return 'Viendo';
  if (status === 'playing') return 'Jugando';
  if (status === 'completed') return 'Completado';
  return 'Abandonado';
}

function getStatusColor(status: TrackedItem['status']) {
  if (status === 'planned') return '#64748B';
  if (status === 'watching') return '#0284C7';
  if (status === 'playing') return '#7C3AED';
  if (status === 'completed') return '#16A34A';
  return '#B91C1C';
}

function FriendLibraryScreen() {
  const isDark = useColorScheme() === 'dark';
  const isWeb = Platform.OS === 'web';
  const router = useRouter();
  const { id, name, avatarUrl } = useLocalSearchParams<{ id: string; name?: string; avatarUrl?: string }>();
  const [items, setItems] = useState<TrackedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('status');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [hoveredCardId, setHoveredCardId] = useState<string | number | null>(null);
  const [hoveredLibraryKey, setHoveredLibraryKey] = useState<string | null>(null);
  const ownLibraryItems = useTrackingStore((state) => state.items);
  const ownLibraryKeys = useMemo(
    () => new Set(ownLibraryItems.map((trackedItem) => `${trackedItem.mediaType}-${trackedItem.externalId}`)),
    [ownLibraryItems]
  );

  useEscapeClose(isSortOpen, () => setIsSortOpen(false));

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const data = await getFriendLibrary(id);
        if (!cancelled) setItems(data);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const counters = useMemo(
    () => ({
      all: items.length,
      movie: items.filter((item) => item.mediaType === 'movie').length,
      tv: items.filter((item) => item.mediaType === 'tv').length,
      game: items.filter((item) => item.mediaType === 'game').length,
    }),
    [items]
  );

  const filtered = useMemo(() => {
    const base = filter === 'all' ? items : items.filter((item) => item.mediaType === filter);
    const copied = [...base];
    const statusOrder: Record<TrackedItem['status'], number> = {
      watching: 0,
      playing: 0,
      planned: 1,
      completed: 2,
      dropped: 3,
    };

    if (sortBy === 'recent') copied.sort((a, b) => b.dateAdded.localeCompare(a.dateAdded));
    else if (sortBy === 'oldest') copied.sort((a, b) => a.dateAdded.localeCompare(b.dateAdded));
    else if (sortBy === 'rating') copied.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
    else if (sortBy === 'title') copied.sort((a, b) => a.title.localeCompare(b.title, 'es', { sensitivity: 'base' }));
    else if (sortBy === 'status') copied.sort((a, b) => (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99));

    return copied;
  }, [items, filter, sortBy]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#0B1220' : '#F8FAFC' }]}>
      <View style={[styles.header, isWeb && styles.headerWeb]}>
        <TouchableOpacity style={[styles.backBtn, isDark && styles.backBtnDark]} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={18} color={isDark ? '#E5E7EB' : '#0F172A'} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.backText, { color: isDark ? '#CBD5E1' : '#334155' }]}>Volver</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.friendHero, isDark && styles.friendHeroDark, isWeb && styles.friendHeroWeb]}>
        <UserAvatar avatarUrl={avatarUrl ?? null} size={86} isDark={isDark} />
        <Text style={[styles.friendHeroName, { color: isDark ? '#E5E7EB' : '#0F172A' }]} numberOfLines={1}>
          {name || 'Amigo/a'}
        </Text>
        <Text style={[styles.friendHeroMeta, { color: isDark ? '#94A3B8' : '#64748B' }]}>
          {filtered.length} de {items.length} elementos
        </Text>
      </View>

      <View style={[styles.controls, isWeb && styles.controlsWeb]}>
        <View style={[styles.filterBar, isWeb && styles.filterBarWeb]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
            <TouchableOpacity style={[styles.filterChip, isDark && styles.filterChipDark, filter === 'all' && styles.filterChipActive]} onPress={() => setFilter('all')}>
              <MaterialIcons name="apps" size={14} color={filter === 'all' ? '#FFFFFF' : isDark ? '#CBD5E1' : '#334155'} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.filterChip, isDark && styles.filterChipDark, filter === 'movie' && styles.filterChipActive]} onPress={() => setFilter('movie')}>
              <MaterialIcons name="movie" size={14} color={filter === 'movie' ? '#FFFFFF' : isDark ? '#CBD5E1' : '#334155'} />
              <Text style={[styles.filterText, isDark && styles.filterTextDark, filter === 'movie' && styles.filterTextActive]}>Películas</Text>
              <View style={styles.chipCounter}>
                <Text style={styles.chipCounterText}>{counters.movie}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.filterChip, isDark && styles.filterChipDark, filter === 'tv' && styles.filterChipActive]} onPress={() => setFilter('tv')}>
              <MaterialIcons name="tv" size={14} color={filter === 'tv' ? '#FFFFFF' : isDark ? '#CBD5E1' : '#334155'} />
              <Text style={[styles.filterText, isDark && styles.filterTextDark, filter === 'tv' && styles.filterTextActive]}>Series</Text>
              <View style={styles.chipCounter}>
                <Text style={styles.chipCounterText}>{counters.tv}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.filterChip, isDark && styles.filterChipDark, filter === 'game' && styles.filterChipActive]} onPress={() => setFilter('game')}>
              <MaterialIcons name="sports-esports" size={14} color={filter === 'game' ? '#FFFFFF' : isDark ? '#CBD5E1' : '#334155'} />
              <Text style={[styles.filterText, isDark && styles.filterTextDark, filter === 'game' && styles.filterTextActive]}>Juegos</Text>
              <View style={styles.chipCounter}>
                <Text style={styles.chipCounterText}>{counters.game}</Text>
              </View>
            </TouchableOpacity>
          </ScrollView>

          <View style={styles.sortAnchor}>
            <TouchableOpacity style={[styles.sortButton, isDark && styles.sortButtonDark]} onPress={() => setIsSortOpen((prev) => !prev)}>
              <MaterialIcons name={isSortOpen ? 'tune' : 'filter-list'} size={16} color={isDark ? '#E5E7EB' : '#0F172A'} />
            </TouchableOpacity>
            {isSortOpen && (
              <View style={[styles.sortMenu, isDark && styles.sortMenuDark]}>
                {SORT_OPTIONS.map((option) => {
                  const active = sortBy === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[styles.sortMenuItem, active && styles.sortMenuItemActive]}
                      onPress={() => {
                        setSortBy(option.value);
                        setIsSortOpen(false);
                      }}
                    >
                      <MaterialIcons name={option.icon} size={14} color={active ? '#0E7490' : isDark ? '#CBD5E1' : '#334155'} />
                      <Text style={[styles.sortMenuText, isDark && styles.sortMenuTextDark, active && styles.sortMenuTextActive]}>{option.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        </View>
      </View>

      {isSortOpen && (
        <Modal visible transparent animationType="none" onRequestClose={() => setIsSortOpen(false)}>
          <Pressable style={styles.sortOverlay} onPress={() => setIsSortOpen(false)} />
        </Modal>
      )}

      <ScrollView contentContainerStyle={[styles.content, isWeb && styles.contentWeb]}>
        {isLoading ? (
          <View style={styles.loadingWrap}>
            <MagicLoader size={52} text="Cargando biblioteca..." />
          </View>
        ) : null}
        {!isLoading && filtered.length === 0 ? (
          <Text style={[styles.emptyText, { color: isDark ? '#94A3B8' : '#64748B' }]}>Sin contenido reciente.</Text>
        ) : !isLoading ? (
          filtered.map((item, index) => {
            const previous = filtered[index - 1];
            const showStatusSeparator = sortBy === 'status' && index > 0 && previous?.status !== item.status;
            const itemKey = `${item.mediaType}-${item.externalId}`;
            const isInOwnLibrary = ownLibraryKeys.has(itemKey);
            return (
              <View key={item.id}>
                {showStatusSeparator ? <View style={[styles.statusSeparator, isDark && styles.statusSeparatorDark]} /> : null}
                <TouchableOpacity
                  style={[
                    styles.card,
                    isDark && styles.cardDark,
                    isWeb && styles.cardWeb,
                    isWeb && hoveredCardId === item.id && styles.cardWebHovered,
                  ]}
                  onPress={() =>
                    router.push({
                      pathname: `/${item.mediaType}/${item.externalId}` as any,
                      params: {
                        fromFriendId: id,
                        fromFriendName: name || 'Amigo/a',
                      },
                    })
                  }
                  {...(isWeb
                    ? {
                        onMouseEnter: () => setHoveredCardId(item.id),
                        onMouseLeave: () => {
                          setHoveredCardId(null);
                          setHoveredLibraryKey(null);
                        },
                      }
                    : {})}
                >
                  <Image source={resolvePoster(item) ? { uri: resolvePoster(item) as string } : FALLBACK_IMAGE} style={styles.poster} resizeMode="cover" />
                  <View style={styles.meta}>
                    <Text numberOfLines={2} style={[styles.itemTitle, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>{item.title}</Text>
                    <View style={styles.metaRow}>
                      <View style={[styles.statusBadge, { borderColor: getStatusColor(item.status), backgroundColor: '#FFFFFF' }]}>
                        <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>{statusLabel(item.status)}</Text>
                      </View>
                      <Text style={[styles.friendRating, { color: isDark ? '#FBBF24' : '#B45309' }]}>
                        ★ {typeof item.rating === 'number' ? `${item.rating.toFixed(1)}/10` : 'Sin puntuación'}
                      </Text>
                    </View>
                  </View>
                  {isInOwnLibrary ? (
                    <View
                      style={styles.inLibraryBadgeWrap}
                      {...(isWeb
                        ? {
                            onMouseEnter: () => setHoveredLibraryKey(itemKey),
                            onMouseLeave: () =>
                              setHoveredLibraryKey((prev) => (prev === itemKey ? null : prev)),
                          }
                        : {})}
                    >
                      <View style={styles.inLibraryBadge}>
                        <MaterialIcons name="library-add-check" size={14} color="#E0F2FE" />
                      </View>
                      {isWeb && hoveredLibraryKey === itemKey ? (
                        <View style={styles.iconTooltip}>
                          <Text numberOfLines={1} style={styles.iconTooltipText}>Ya añadido</Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </TouchableOpacity>
              </View>
            );
          })
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 6, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerWeb: {
    paddingHorizontal: 16,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  backBtnDark: {
    borderColor: '#334155',
    backgroundColor: '#111827',
  },
  backText: { fontSize: 13, fontWeight: '700' },
  friendHero: {
    marginTop: 10,
    marginHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 18,
    gap: 8,
  },
  friendHeroWeb: {
    marginHorizontal: 16,
    borderRadius: 20,
  },
  friendHeroDark: {
    borderColor: '#1F2937',
    backgroundColor: '#111827',
  },
  friendHeroName: {
    fontSize: 22,
    fontWeight: '900',
  },
  friendHeroMeta: {
    fontSize: 12,
    fontWeight: '700',
  },
  controls: {
    gap: 8,
    marginTop: 10,
    marginBottom: 10,
    position: 'relative',
    zIndex: 60,
    elevation: 12,
  },
  controlsWeb: {
    marginTop: 14,
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
    zIndex: 60,
  },
  filterBarWeb: {
    paddingHorizontal: 16,
  },
  filtersRow: {
    paddingTop: 8,
    paddingBottom: 4,
    gap: 8,
  },
  filterChip: {
    position: 'relative',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  filterChipDark: {
    borderColor: '#334155',
    backgroundColor: '#0F172A',
  },
  filterChipActive: {
    backgroundColor: '#0E7490',
    borderColor: '#0E7490',
  },
  filterText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  filterTextDark: {
    color: '#CBD5E1',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  chipCounter: {
    position: 'absolute',
    top: -3,
    right: -5,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#64748B',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  chipCounterText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 9,
    ...(Platform.OS === 'android' ? ({ includeFontPadding: false } as const) : null),
  },
  sortAnchor: {
    position: 'relative',
    zIndex: 80,
  },
  sortButton: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sortButtonDark: {
    borderColor: '#334155',
    backgroundColor: '#0F172A',
  },
  sortMenu: {
    position: 'absolute',
    top: 40,
    right: 0,
    width: 170,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    zIndex: 120,
    elevation: 20,
  },
  sortMenuDark: {
    backgroundColor: '#111827',
    borderColor: '#334155',
  },
  sortOverlay: {
    flex: 1,
  },
  sortMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  sortMenuItemActive: {
    backgroundColor: '#ECFEFF',
  },
  sortMenuText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  sortMenuTextDark: {
    color: '#CBD5E1',
  },
  sortMenuTextActive: {
    color: '#0E7490',
    fontWeight: '700',
  },
  content: { padding: 16, gap: 8, paddingBottom: 24 },
  contentWeb: {
    paddingHorizontal: 16,
  },
  emptyText: { fontSize: 13, fontWeight: '600' },
  loadingWrap: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 10,
    flexDirection: 'row',
    gap: 10,
    position: 'relative',
    overflow: 'visible',
  },
  cardWeb: {
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 1px 3px rgba(2,6,23,0.04)',
          transitionDuration: '260ms',
          transitionProperty: 'box-shadow, opacity',
          transitionTimingFunction: 'cubic-bezier(0.22,1,0.36,1)',
        } as any)
      : null),
  },
  cardWebHovered: {
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 8px 16px rgba(2,6,23,0.08)',
        } as any)
      : null),
  },
  cardDark: {
    borderColor: '#1F2937',
    backgroundColor: '#111827',
  },
  poster: {
    width: 56,
    height: 84,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  meta: { flex: 1, justifyContent: 'center' },
  itemTitle: { fontSize: 14, fontWeight: '800' },
  metaRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  friendRating: { fontSize: 12, fontWeight: '700' },
  inLibraryBadgeWrap: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 20,
    overflow: 'visible',
  },
  inLibraryBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0E7490',
    borderWidth: 1,
    borderColor: '#67E8F9',
    boxShadow: '0 4px 12px rgba(14,116,144,0.28)',
  },
  iconTooltip: {
    position: 'absolute',
    top: 28,
    right: 0,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#0F172A',
    minWidth: 74,
    alignItems: 'center',
  },
  iconTooltipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#E2E8F0',
    ...(Platform.OS === 'web' ? ({ whiteSpace: 'nowrap' } as any) : null),
  },
  statusSeparator: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginTop: 2,
    marginBottom: 8,
  },
  statusSeparatorDark: {
    backgroundColor: '#334155',
  },
});

export default FriendLibraryScreen;
