import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  Dimensions,
  Image,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import { CalendarInput } from '../components/common/CalendarInput';
import { TMDB_IMAGE_BASE_URL } from '../constants/config';
import { gameRepository } from '../features/games/data/repositories';
import { useTrackingStore } from '../store/tracking';
import { MediaType, TrackedItem } from '../types';
import { formatDate, getMediaIcon, getStatusColor } from '../utils/helpers';

type Filter = 'all' | MediaType;
type SortBy = 'recent' | 'oldest' | 'rating' | 'title' | 'status';

const FALLBACK_IMAGE = require('../../assets/images/icon.png');

const SORT_OPTIONS: { value: SortBy; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { value: 'recent', label: 'Reciente', icon: 'schedule' },
  { value: 'rating', label: 'Puntuación', icon: 'star' },
  { value: 'title', label: 'A-Z', icon: 'sort-by-alpha' },
  { value: 'status', label: 'Estado', icon: 'flag' },
  { value: 'oldest', label: 'Antiguo', icon: 'history' },
];

const STATUS_COLORS: Record<TrackedItem['status'], string> = {
  planned: '#64748B',
  watching: '#0284C7',
  playing: '#7C3AED',
  completed: '#16A34A',
  dropped: '#B91C1C',
};

function resolveTrackedPoster(item: TrackedItem): string | null {
  if (!item.posterPath) return null;
  if (/^[a-z0-9]{8,}$/i.test(item.posterPath) && !item.posterPath.includes('/')) {
    return `https://images.igdb.com/igdb/image/upload/t_cover_big_2x/${item.posterPath}.jpg`;
  }
  if (item.posterPath.startsWith('/')) {
    return `${TMDB_IMAGE_BASE_URL}${item.posterPath}`;
  }
  if (item.posterPath.startsWith('//')) {
    return `https:${item.posterPath}`.replace('/t_thumb/', '/t_cover_big_2x/');
  }
  if (item.posterPath.startsWith('http')) {
    return item.posterPath.replace('/t_thumb/', '/t_cover_big_2x/');
  }
  return `https://${item.posterPath}`.replace('/t_thumb/', '/t_cover_big_2x/');
}

function routeFromItem(item: TrackedItem): `/movie/${number}` | `/tv/${number}` | `/game/${number}` {
  if (item.mediaType === 'movie') return `/movie/${item.externalId}`;
  if (item.mediaType === 'tv') return `/tv/${item.externalId}`;
  return `/game/${item.externalId}`;
}

function statusOptionsForType(type: MediaType) {
  if (type === 'game') {
    return [
      { value: 'planned', label: 'Pendiente' },
      { value: 'playing', label: 'Jugando' },
      { value: 'completed', label: 'Jugado' },
    ] as const;
  }
  return [
    { value: 'planned', label: 'Pendiente' },
    { value: 'watching', label: 'Viendo' },
    { value: 'completed', label: 'Visto' },
  ] as const;
}

function statusLabel(status: TrackedItem['status']) {
  const labels: Record<TrackedItem['status'], string> = {
    planned: 'Pendiente',
    watching: 'Viendo',
    playing: 'Jugando',
    completed: 'Completado',
    dropped: 'Abandonado',
  };
  return labels[status] ?? status;
}

function RatingEditor({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) {
  const [starsWidth, setStarsWidth] = useState(0);
  const starsTrackRef = useRef<View | null>(null);
  const trackPageXRef = useRef(0);
  const valueRef = useRef(value);
  valueRef.current = value;

  function iconNameFor(v: number, starIndex: number): 'star' | 'star-half' | 'star-border' {
    if (v >= starIndex) return 'star';
    if (v >= starIndex - 0.5) return 'star-half';
    return 'star-border';
  }

  const measureTrack = useCallback(() => {
    starsTrackRef.current?.measureInWindow((x) => {
      trackPageXRef.current = x;
    });
  }, []);

  const ratingFromTouchX = useCallback((pageX: number) => {
    if (starsWidth <= 0) return valueRef.current || 0;
    const localX = pageX - trackPageXRef.current;
    const boundedX = Math.max(0, Math.min(starsWidth, localX));
    const pointsPerStep = starsWidth / 20;
    const steps = Math.round(boundedX / pointsPerStep);
    return Math.max(0, Math.min(10, steps * 0.5));
  }, [starsWidth]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          const tappedValue = ratingFromTouchX(event.nativeEvent.pageX);
          onChange(tappedValue);
        },
        onPanResponderMove: (_, gestureState) => onChange(ratingFromTouchX(gestureState.moveX)),
      }),
    [onChange, ratingFromTouchX]
  );

  return (
    <View style={styles.modalBlock}>
      <Text style={styles.modalLabel}>Puntuación personal ({value.toFixed(1)} / 10)</Text>
      <View style={styles.modalStarsRow}>
        <View
          ref={starsTrackRef}
          style={styles.starsTrack}
          onLayout={(event) => {
            setStarsWidth(event.nativeEvent.layout.width);
            measureTrack();
          }}
          {...panResponder.panHandlers}
        >
          {Array.from({ length: 10 }, (_, idx) => idx + 1).map((index) => (
            <View key={index} style={styles.starSlot}>
              <MaterialIcons name={iconNameFor(value, index)} size={22} color="#F59E0B" />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function TrackedScreen() {
  const isDark = useColorScheme() === 'dark';
  const isWeb = Platform.OS === 'web';
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('status');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortButtonRef = useRef<View | null>(null);
  const [sortMenuPosition, setSortMenuPosition] = useState({ top: 0, left: 0 });

  const [editingItem, setEditingItem] = useState<TrackedItem | null>(null);
  const [editingStatus, setEditingStatus] = useState<TrackedItem['status']>('planned');
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [editingRating, setEditingRating] = useState(0);
  const [editingWatchedAt, setEditingWatchedAt] = useState('');
  const [editingStartedAt, setEditingStartedAt] = useState('');
  const [editingFinishedAt, setEditingFinishedAt] = useState('');

  const items = useTrackingStore((state) => state.items);
  const removeItem = useTrackingStore((state) => state.removeItem);
  const updateItem = useTrackingStore((state) => state.updateItem);

  useEffect(() => {
    const candidates = items.filter((item) => item.mediaType === 'game' && !resolveTrackedPoster(item));
    if (candidates.length === 0) return;

    let cancelled = false;
    (async () => {
      for (const item of candidates) {
        try {
          const game = await gameRepository.getGameDetails(item.externalId);
          if (cancelled) return;
          const repairedPoster = game.cover?.image_id
            ? `https://images.igdb.com/igdb/image/upload/t_cover_big_2x/${game.cover.image_id}.jpg`
            : game.cover?.url
              ? game.cover.url.startsWith('//')
                ? `https:${game.cover.url}`.replace('/t_thumb/', '/t_cover_big_2x/')
                : game.cover.url
              : undefined;
          if (repairedPoster) updateItem(item.id, { posterPath: repairedPoster });
        } catch {
          // ignore partial failures
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [items, updateItem]);

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

  function openEditor(item: TrackedItem) {
    setEditingItem(item);
    setEditingStatus(item.status);
    setEditingRating(item.rating ?? 0);
    setEditingWatchedAt(item.watchedAt ?? '');
    setEditingStartedAt(item.startedAt ?? '');
    setEditingFinishedAt(item.finishedAt ?? '');
    setIsStatusOpen(false);
  }

  function saveEditor() {
    if (!editingItem) return;
    const hasInvalidRange =
      editingItem.mediaType !== 'movie' &&
      Boolean(editingStartedAt && editingFinishedAt) &&
      new Date(editingFinishedAt).getTime() < new Date(editingStartedAt).getTime();
    if (hasInvalidRange) return;
    updateItem(editingItem.id, {
      status: editingStatus,
      rating: editingRating > 0 ? editingRating : undefined,
      watchedAt: editingItem.mediaType === 'movie' ? editingWatchedAt.trim() || undefined : undefined,
      startedAt: editingItem.mediaType !== 'movie' ? editingStartedAt.trim() || undefined : undefined,
      finishedAt: editingItem.mediaType !== 'movie' ? editingFinishedAt.trim() || undefined : undefined,
    });
    setEditingItem(null);
  }

  const hasInvalidRangeInEditor =
    editingItem?.mediaType !== 'movie' &&
    Boolean(editingStartedAt && editingFinishedAt) &&
    new Date(editingFinishedAt).getTime() < new Date(editingStartedAt).getTime();

  function renderDateSummary(item: TrackedItem) {
    if (item.mediaType === 'movie') {
      const watched = item.watchedAt ? formatDate(item.watchedAt) : 'sin fecha';
      return `Visto: ${watched}`;
    }
    const start = item.startedAt ? formatDate(item.startedAt) : 'sin inicio';
    const end = item.finishedAt ? formatDate(item.finishedAt) : 'sin fin';
    return `Inicio: ${start} · Fin: ${end}`;
  }

  function toggleSortMenu() {
    if (isWeb && !isSortOpen) {
      sortButtonRef.current?.measureInWindow((x, y, width, height) => {
        const menuWidth = 170;
        const screenWidth = Dimensions.get('window').width;
        const left = Math.max(8, Math.min(screenWidth - menuWidth - 8, x + width - menuWidth));
        setSortMenuPosition({ top: y + height + 6, left });
        setIsSortOpen(true);
      });
      return;
    }
    setIsSortOpen((prev) => !prev);
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#0B1220' : '#F8FAFC' }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>Biblioteca</Text>
          <Text style={[styles.subtitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>{counters.all} guardados</Text>
        </View>

        <View style={styles.controls}>
          <View style={styles.filterBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
              <TouchableOpacity style={[styles.filterChip, filter === 'all' && styles.filterChipActive]} onPress={() => setFilter('all')}>
                <MaterialIcons name="apps" size={14} color={filter === 'all' ? '#FFFFFF' : '#334155'} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.filterChip, filter === 'movie' && styles.filterChipActive]} onPress={() => setFilter('movie')}>
                <MaterialIcons name="movie" size={14} color={filter === 'movie' ? '#FFFFFF' : '#334155'} />
                <Text style={[styles.filterText, filter === 'movie' && styles.filterTextActive]}>Películas</Text>
                <View style={styles.chipCounter}>
                  <Text style={styles.chipCounterText}>{counters.movie}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.filterChip, filter === 'tv' && styles.filterChipActive]} onPress={() => setFilter('tv')}>
                <MaterialIcons name="tv" size={14} color={filter === 'tv' ? '#FFFFFF' : '#334155'} />
                <Text style={[styles.filterText, filter === 'tv' && styles.filterTextActive]}>Series</Text>
                <View style={styles.chipCounter}>
                  <Text style={styles.chipCounterText}>{counters.tv}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.filterChip, filter === 'game' && styles.filterChipActive]} onPress={() => setFilter('game')}>
                <MaterialIcons name="sports-esports" size={14} color={filter === 'game' ? '#FFFFFF' : '#334155'} />
                <Text style={[styles.filterText, filter === 'game' && styles.filterTextActive]}>Videojuegos</Text>
                <View style={styles.chipCounter}>
                  <Text style={styles.chipCounterText}>{counters.game}</Text>
                </View>
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.sortAnchor} ref={sortButtonRef}>
              <TouchableOpacity style={styles.sortButton} onPress={toggleSortMenu}>
                <MaterialIcons name={isSortOpen ? 'tune' : 'filter-list'} size={16} color="#0F172A" />
              </TouchableOpacity>

              {isSortOpen && !isWeb && (
                <View style={styles.sortMenu}>
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
                        <MaterialIcons name={option.icon} size={14} color={active ? '#0E7490' : '#334155'} />
                        <Text style={[styles.sortMenuText, active && styles.sortMenuTextActive]}>{option.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          </View>
        </View>

        {isWeb && isSortOpen && (
          <Modal visible transparent animationType="none" onRequestClose={() => setIsSortOpen(false)}>
            <Pressable style={styles.sortOverlay} onPress={() => setIsSortOpen(false)}>
              <View style={[styles.sortMenu, styles.sortMenuFloating, { top: sortMenuPosition.top, left: sortMenuPosition.left }]}>
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
                      <MaterialIcons name={option.icon} size={14} color={active ? '#0E7490' : '#334155'} />
                      <Text style={[styles.sortMenuText, active && styles.sortMenuTextActive]}>{option.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Pressable>
          </Modal>
        )}

        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>Tu biblioteca está vacía</Text>
            <Text style={[styles.emptySubtitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>Añade contenido desde Home o Search para verlo aquí.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.list}>
            {filtered.map((item, index) => {
              const previous = filtered[index - 1];
              const showStatusSeparator = sortBy === 'status' && index > 0 && previous?.status !== item.status;
              const cardContent = (
                <TouchableOpacity style={[styles.card, isDark && styles.cardDark]} activeOpacity={0.8} onPress={() => router.push(routeFromItem(item))}>
                  <Image source={resolveTrackedPoster(item) ? { uri: resolveTrackedPoster(item) as string } : FALLBACK_IMAGE} style={styles.poster} resizeMode="cover" />

                  <View style={styles.content}>
                    <View style={styles.titleRow}>
                      <MaterialIcons name={getMediaIcon(item.mediaType)} size={16} color={isDark ? '#E5E7EB' : '#0F172A'} />
                      <Text numberOfLines={1} style={[styles.cardTitle, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>{item.title}</Text>
                    </View>

                    <View style={styles.metaRow}>
                      <View style={[styles.statusBadge, { borderColor: getStatusColor(item.status), backgroundColor: '#FFFFFF' }]}>
                        <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>{statusLabel(item.status)}</Text>
                      </View>
                      <Text style={[styles.ratingText, { color: isDark ? '#CBD5E1' : '#334155' }]}>{item.rating ? `★ ${item.rating.toFixed(1)}` : 'Sin puntuación'}</Text>
                    </View>

                    <Text numberOfLines={1} style={[styles.dateSummary, { color: isDark ? '#94A3B8' : '#64748B' }]}>{renderDateSummary(item)}</Text>
                  </View>
                </TouchableOpacity>
              );

              if (isWeb) {
                return (
                  <View key={item.id}>
                    {showStatusSeparator ? <View style={[styles.statusSeparator, isDark && styles.statusSeparatorDark]} /> : null}
                    {cardContent}
                    <View style={styles.webActionsRow}>
                      <TouchableOpacity style={[styles.webActionBtn, styles.webActionEdit]} onPress={() => openEditor(item)}>
                        <MaterialIcons name="edit" size={16} color="#FFFFFF" />
                        <Text style={styles.webActionText}>Editar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.webActionBtn, styles.webActionDelete]} onPress={() => removeItem(item.id)}>
                        <MaterialIcons name="delete" size={16} color="#FFFFFF" />
                        <Text style={styles.webActionText}>Eliminar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }

              return (
                <View key={item.id}>
                  {showStatusSeparator ? <View style={[styles.statusSeparator, isDark && styles.statusSeparatorDark]} /> : null}
                  <Swipeable
                    overshootRight={false}
                    overshootLeft={false}
                    renderLeftActions={() => (
                      <TouchableOpacity style={styles.swipeEdit} onPress={() => openEditor(item)}>
                        <MaterialIcons name="edit" size={20} color="#FFFFFF" />
                      </TouchableOpacity>
                    )}
                    renderRightActions={() => (
                      <TouchableOpacity style={styles.swipeDelete} onPress={() => removeItem(item.id)}>
                        <MaterialIcons name="delete" size={22} color="#FFFFFF" />
                      </TouchableOpacity>
                    )}
                  >
                    {cardContent}
                  </Swipeable>
                </View>
              );
            })}
          </ScrollView>
        )}

        <Modal visible={Boolean(editingItem)} transparent animationType="fade" onRequestClose={() => setEditingItem(null)}>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, isDark && styles.modalCardDark]}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={[styles.modalTitle, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>Editar elemento</Text>
                <Text style={[styles.modalItemTitle, { color: isDark ? '#CBD5E1' : '#334155' }]}>{editingItem?.title}</Text>

                {editingItem && (
                  <View style={styles.modalBlock}>
                    <Text style={styles.modalLabel}>Estado</Text>
                    <TouchableOpacity style={styles.statusDropdownButton} onPress={() => setIsStatusOpen((prev) => !prev)}>
                      <Text style={styles.statusDropdownText}>{statusLabel(editingStatus)}</Text>
                      <MaterialIcons name={isStatusOpen ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} size={20} color="#334155" />
                    </TouchableOpacity>
                    {isStatusOpen && (
                      <View style={styles.statusDropdownMenu}>
                        {statusOptionsForType(editingItem.mediaType).map((option) => (
                          <TouchableOpacity
                            key={option.value}
                            style={[
                              styles.statusDropdownItem,
                              {
                                backgroundColor: `${(STATUS_COLORS[option.value] || '#64748B')}22`,
                              },
                            ]}
                            onPress={() => {
                              setEditingStatus(option.value);
                              setIsStatusOpen(false);
                            }}
                          >
                            <View style={[styles.statusColorDot, { backgroundColor: STATUS_COLORS[option.value] || '#64748B' }]} />
                            <Text style={styles.statusDropdownItemText}>{option.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                )}

                <RatingEditor value={editingRating} onChange={setEditingRating} />

                <View style={styles.modalBlock}>
                  {editingItem?.mediaType === 'movie' ? (
                    <CalendarInput label="Fecha visualización" value={editingWatchedAt} onChange={setEditingWatchedAt} placeholder="Seleccionar" />
                  ) : (
                    <View style={styles.modalDatesRow}>
                      <View style={styles.modalDateCol}>
                        <CalendarInput label="Fecha inicio" value={editingStartedAt} onChange={setEditingStartedAt} placeholder="Seleccionar" />
                      </View>
                      <View style={styles.modalDateCol}>
                        <CalendarInput label="Fecha fin" value={editingFinishedAt} onChange={setEditingFinishedAt} placeholder="Seleccionar" />
                      </View>
                    </View>
                  )}
                </View>
                {hasInvalidRangeInEditor && (
                  <Text style={styles.rangeError}>
                    La fecha de fin no puede ser anterior a la fecha de inicio.
                  </Text>
                )}

                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.modalCancel} onPress={() => setEditingItem(null)}>
                    <Text style={styles.modalCancelText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalSave, hasInvalidRangeInEditor && styles.modalSaveDisabled]}
                    onPress={saveEditor}
                    disabled={Boolean(hasInvalidRangeInEditor)}
                  >
                    <Text style={styles.modalSaveText}>Guardar</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: '#64748B',
  },
  controls: {
    gap: 8,
    marginBottom: 10,
    position: 'relative',
    zIndex: 60,
    elevation: 12,
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
    zIndex: 60,
  },
  filtersRow: {
    paddingVertical: 4,
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
  filterChipActive: {
    backgroundColor: '#0E7490',
    borderColor: '#0E7490',
  },
  filterText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  chipCounter: {
    position: 'absolute',
    top: -5,
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
    lineHeight: 11,
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
  sortMenuFloating: {
    top: 0,
    right: 'auto',
    left: 0,
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
  sortMenuTextActive: {
    color: '#0E7490',
    fontWeight: '700',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  emptySubtitle: {
    marginTop: 8,
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    zIndex: 1,
  },
  statusSeparator: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginTop: 2,
    marginBottom: 10,
  },
  statusSeparatorDark: {
    backgroundColor: '#334155',
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    marginBottom: 10,
  },
  cardDark: {
    backgroundColor: '#111827',
    borderColor: '#1F2937',
  },
  swipeDelete: {
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    marginBottom: 10,
    borderRadius: 14,
  },
  swipeEdit: {
    backgroundColor: '#0E7490',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    marginBottom: 10,
    borderRadius: 14,
  },
  webActionsRow: {
    marginTop: -4,
    marginBottom: 12,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  webActionBtn: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  webActionEdit: {
    backgroundColor: '#0E7490',
  },
  webActionDelete: {
    backgroundColor: '#DC2626',
  },
  webActionText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  poster: {
    width: 70,
    height: 102,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  content: {
    flex: 1,
    marginLeft: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
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
  ratingText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '700',
  },
  dateSummary: {
    marginTop: 6,
    fontSize: 11,
    color: '#64748B',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    maxHeight: '82%',
  },
  modalCardDark: {
    backgroundColor: '#111827',
    borderColor: '#1F2937',
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalItemTitle: {
    marginTop: 4,
    fontSize: 14,
    color: '#334155',
  },
  modalBlock: {
    marginTop: 14,
  },
  modalLabel: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
  },
  statusDropdownButton: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
  },
  statusDropdownText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  statusDropdownMenu: {
    position: 'absolute',
    top: 66,
    left: 0,
    right: 0,
    zIndex: 20,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  statusDropdownItem: {
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusColorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDropdownItemText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  modalStarsRow: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  starSlot: {
    width: 23,
    height: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starsTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  leftHit: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '50%',
  },
  rightHit: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: '50%',
  },
  modalDatesRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modalDateCol: {
    flex: 1,
  },
  modalActions: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  rangeError: {
    marginTop: 8,
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
  },
  modalCancel: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  modalSave: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#0E7490',
  },
  modalSaveDisabled: {
    backgroundColor: '#94A3B8',
  },
  modalSaveText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export { TrackedScreen };
export default TrackedScreen;
