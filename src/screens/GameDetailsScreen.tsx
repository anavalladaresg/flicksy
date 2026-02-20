/**
 * Pantalla de detalles de videojuego
 */

import { MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { useColorScheme } from '@/hooks/use-color-scheme';
import MagicLoader from '@/components/loaders/MagicLoader';
import CenteredOverlay from '@/components/layout/CenteredOverlay';
import {
    Image,
    Modal,
    Platform,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import FriendsRatingsBlock from '../components/common/FriendsRatingsBlock';
import { RatingPickerModal } from '../components/common/RatingPickerModal';
import { useGameDetails } from '../features/games/presentation/hooks';
import { useEscapeClose } from '../hooks/use-escape-close';
import { getFriendLibraryItem, getFriendsRatingsForItem, type FriendItemRating } from '../services/social';
import { useTrackingStore } from '../store/tracking';
import type { TrackedItem } from '../types';

interface GameDetailsScreenProps {
  route: any;
  navigation: any;
}

const GameDetailsScreen: React.FC<GameDetailsScreenProps> = ({
  route,
  navigation,
}) => {
  const RootContainer = Platform.OS === 'web' ? View : SafeAreaView;
  const isDark = useColorScheme() === 'dark';
  const { gameId, fromFriendId, fromFriendName } = route.params;
  const { data: game, isLoading, isError, refetch } = useGameDetails(gameId);
  const addTrackedItem = useTrackingStore((state) => state.addItem);
  const updateTrackedItem = useTrackingStore((state) => state.updateItem);
  const removeTrackedItem = useTrackingStore((state) => state.removeItem);
  const trackedItems = useTrackingStore((state) => state.items);
  const [isRatingOpen, setIsRatingOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [status, setStatus] = useState<'planned' | 'playing' | 'completed'>('completed');
  const [startedAt, setStartedAt] = useState('');
  const [finishedAt, setFinishedAt] = useState('');
  const [startedAtApproximate, setStartedAtApproximate] = useState(false);
  const [finishedAtApproximate, setFinishedAtApproximate] = useState(false);
  const [friendTrackedItem, setFriendTrackedItem] = useState<TrackedItem | null>(null);
  const [friendsRatings, setFriendsRatings] = useState<FriendItemRating[]>([]);
  const [selectedScreenshotUrl, setSelectedScreenshotUrl] = useState<string | null>(null);

  const isTracked = trackedItems.some(
    (item) => item.externalId === gameId && item.mediaType === 'game'
  );
  const trackedGameItem = trackedItems.find(
    (item) => item.externalId === gameId && item.mediaType === 'game'
  );
  const visibleFriendsRatings = fromFriendId
    ? friendsRatings.filter((entry) => entry.friendId !== fromFriendId)
    : friendsRatings;

  useEffect(() => {
    if (!fromFriendId || !gameId) {
      setFriendTrackedItem(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const item = await getFriendLibraryItem(fromFriendId, 'game', gameId);
      if (!cancelled) setFriendTrackedItem(item);
    })();
    return () => {
      cancelled = true;
    };
  }, [fromFriendId, gameId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ratings = await getFriendsRatingsForItem('game', gameId);
      if (!cancelled) setFriendsRatings(ratings);
    })();
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  function statusLabel(value: 'planned' | 'playing' | 'completed') {
    if (value === 'planned') return 'Pendiente';
    if (value === 'playing') return 'Jugando';
    return 'Jugado';
  }

  function ratingValue(value: number) {
    if (!value) return '0.0/10';
    return `${value.toFixed(1)}/10`;
  }

  function statusTone(value: 'planned' | 'playing' | 'completed') {
    if (value === 'planned') return { color: '#64748B', bg: '#F1F5F9', border: '#CBD5E1' };
    if (value === 'playing') return { color: '#6D28D9', bg: '#F3E8FF', border: '#C4B5FD' };
    return { color: '#15803D', bg: '#DCFCE7', border: '#86EFAC' };
  }

  function formatShortDate(value?: string): string {
    if (!value) return 'sin fecha';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }
  const gameCoverUrl = game?.cover?.image_id
    ? `https://images.igdb.com/igdb/image/upload/t_1080p/${game.cover.image_id}.jpg`
    : game?.cover?.url
      ? `https:${game.cover.url}`.replace('/t_thumb/', '/t_1080p/')
      : null;
  const developerStudios = Array.from(
    new Set(
      (game?.involved_companies ?? [])
        .filter((entry) => entry.developer)
        .map((entry) => entry.company?.name)
        .filter((name): name is string => Boolean(name))
    )
  );
  const screenshotUrls = (game?.screenshots ?? [])
    .map((shot) =>
      shot.image_id
        ? `https://images.igdb.com/igdb/image/upload/t_screenshot_big/${shot.image_id}.jpg`
        : shot.url
          ? shot.url.startsWith('//')
            ? `https:${shot.url}`.replace('/t_thumb/', '/t_screenshot_big/')
            : shot.url.replace('/t_thumb/', '/t_screenshot_big/')
          : null
    )
    .filter((url): url is string => Boolean(url))
    .slice(0, 10);
  const summaryText = game?.summary?.trim() || 'Resumen no disponible en español por ahora.';
  const storylineText = game?.storyline?.trim() || 'Historia no disponible en español por ahora.';

  useEscapeClose(Boolean(selectedScreenshotUrl), () => setSelectedScreenshotUrl(null));

  const handleConfirmAdd = () => {
    if (!game) return;
    const canSaveScore = status !== 'planned';
    const canSaveStart = status === 'playing' || status === 'completed';
    const canSaveEnd = status === 'completed';
    if (trackedGameItem) {
      updateTrackedItem(trackedGameItem.id, {
        rating: canSaveScore ? rating : undefined,
        status,
        startedAt: canSaveStart ? startedAt.trim() || undefined : undefined,
        finishedAt: canSaveEnd ? finishedAt.trim() || undefined : undefined,
        startedAtApproximate: canSaveStart ? startedAtApproximate : false,
        finishedAtApproximate: canSaveEnd ? finishedAtApproximate : false,
        releaseYear:
          game.release_dates && game.release_dates.length > 0
            ? new Date(game.release_dates[0].date * 1000).getFullYear()
            : undefined,
        genres: game.genres?.map((genre) => genre.name) ?? [],
        platforms: game.platforms?.map((platform) => platform.name) ?? [],
        estimatedHours: status === 'completed' ? 35 : status === 'playing' ? 18 : 7,
      });
      setIsRatingOpen(false);
      return;
    }
    if (game && !isTracked) {
      addTrackedItem({
        externalId: game.id,
        mediaType: 'game',
        title: game.name,
        posterPath: gameCoverUrl || undefined,
        rating: canSaveScore ? rating : undefined,
        status,
        startedAt: canSaveStart ? startedAt.trim() || undefined : undefined,
        finishedAt: canSaveEnd ? finishedAt.trim() || undefined : undefined,
        startedAtApproximate: canSaveStart ? startedAtApproximate : false,
        finishedAtApproximate: canSaveEnd ? finishedAtApproximate : false,
        releaseYear:
          game.release_dates && game.release_dates.length > 0
            ? new Date(game.release_dates[0].date * 1000).getFullYear()
            : undefined,
        genres: game.genres?.map((genre) => genre.name) ?? [],
        platforms: game.platforms?.map((platform) => platform.name) ?? [],
        estimatedHours: status === 'completed' ? 35 : status === 'playing' ? 18 : 7,
      });
      setIsRatingOpen(false);
    }
  };

  function openEditor() {
    if (!trackedGameItem) return;
    setRating(trackedGameItem.rating ?? 0);
    setStatus(
      (trackedGameItem.status as 'planned' | 'playing' | 'completed') || 'completed'
    );
    setStartedAt(trackedGameItem.startedAt ?? '');
    setFinishedAt(trackedGameItem.finishedAt ?? '');
    setStartedAtApproximate(Boolean(trackedGameItem.startedAtApproximate));
    setFinishedAtApproximate(Boolean(trackedGameItem.finishedAtApproximate));
    setIsRatingOpen(true);
  }

  if (isLoading) {
    return (
      <RootContainer style={styles.container}>
        <CenteredOverlay>
          <MagicLoader size={54} text="Cargando detalles..." />
        </CenteredOverlay>
      </RootContainer>
    );
  }

  if (isError) {
    return (
      <RootContainer style={styles.container}>
        <ErrorMessage
          message="No se pudo cargar los detalles del videojuego"
          onRetry={() => refetch()}
        />
      </RootContainer>
    );
  }

  if (!game) {
    return (
      <RootContainer style={styles.container}>
        <Text>Videojuego no encontrado</Text>
      </RootContainer>
    );
  }

  return (
    <RootContainer style={[styles.container, isDark && styles.containerDark]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[styles.backButton, isDark && styles.backButtonDark]}
          >
            <MaterialIcons name="arrow-back" size={22} color={isDark ? '#E2E8F0' : '#0F172A'} />
          </TouchableOpacity>
        </View>

        {gameCoverUrl && (
          <View style={styles.backdropWrap}>
            <Image
              source={{
                uri: gameCoverUrl,
              }}
              style={styles.backdrop}
              resizeMode="cover"
            />
            <View style={[styles.backdropOverlay, isDark && styles.backdropOverlayDark]} />
          </View>
        )}

        <View style={[styles.content, isDark && styles.contentDark]}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: isDark ? '#E5E7EB' : '#333' }]}>{game.name}</Text>
            <TouchableOpacity
              style={[styles.inlineAddButton, isTracked && styles.inlineAddButtonTracked]}
              onPress={() => {
                if (isTracked && trackedGameItem) {
                  removeTrackedItem(trackedGameItem.id);
                  return;
                }
                setRating(0);
                setStatus('completed');
                setStartedAt('');
                setFinishedAt('');
                setStartedAtApproximate(false);
                setFinishedAtApproximate(false);
                setIsRatingOpen(true);
              }}
            >
              <MaterialIcons
                name={isTracked ? 'delete' : 'add'}
                size={18}
                color={isTracked ? '#B91C1C' : '#FFFFFF'}
              />
              <Text style={[styles.inlineAddText, isTracked && styles.inlineAddTextTracked]}>
                {isTracked ? 'Eliminar' : 'Añadir'}
              </Text>
            </TouchableOpacity>
          </View>
          {isTracked && trackedGameItem && (
            <View style={[styles.myDataCard, isDark && styles.myDataCardDark]}>
              <TouchableOpacity style={[styles.editDataButton, isDark && styles.editDataButtonDark]} onPress={openEditor}>
                <MaterialIcons name="edit" size={14} color="#0E7490" />
              </TouchableOpacity>
              <View style={styles.myDataTopRow}>
                <View
                  style={[
                    styles.statusPill,
                    isDark && styles.statusPillDark,
                    {
                      borderColor: statusTone((trackedGameItem.status as 'planned' | 'playing' | 'completed') || 'playing').border,
                      backgroundColor: statusTone((trackedGameItem.status as 'planned' | 'playing' | 'completed') || 'playing').bg,
                    },
                  ]}
                >
                  <MaterialIcons
                    name="flag"
                    size={13}
                    color={statusTone((trackedGameItem.status as 'planned' | 'playing' | 'completed') || 'playing').color}
                  />
                  <Text
                    style={[
                      styles.statusPillText,
                      { color: statusTone((trackedGameItem.status as 'planned' | 'playing' | 'completed') || 'playing').color },
                    ]}
                  >
                    {statusLabel((trackedGameItem.status as 'planned' | 'playing' | 'completed') || 'playing')}
                  </Text>
                </View>
                <Text style={[styles.ratingLine, { color: isDark ? '#E5E7EB' : '#1E293B' }]}>⭐️ {ratingValue(trackedGameItem.rating ?? 0)}</Text>
              </View>
              <Text style={[styles.myDataDate, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                {formatShortDate(trackedGameItem.startedAt)} - {formatShortDate(trackedGameItem.finishedAt)}
              </Text>
            </View>
          )}
          {!trackedGameItem && friendTrackedItem && (
            <View style={[styles.friendDataCard, isDark && styles.friendDataCardDark]}>
              <Text style={[styles.friendDataText, { color: isDark ? '#E5E7EB' : '#1E293B' }]}>
                {fromFriendName || 'Tu amigo/a'} ha puntuado este juego con{' '}
                {typeof friendTrackedItem.rating === 'number' ? `${friendTrackedItem.rating.toFixed(1)} ⭐️` : 'sin puntuación'}.
              </Text>
            </View>
          )}
          <FriendsRatingsBlock itemLabel="juego" ratings={visibleFriendsRatings} />

          <View style={styles.info}>
            {game.rating && (
              <View style={[styles.metaChip, isDark && styles.metaChipDark]}>
                <Text style={[styles.infoText, { color: isDark ? '#CBD5E1' : '#334155' }]}>🌐 {(game.rating / 10).toFixed(1)}/10</Text>
              </View>
            )}
            {game.release_dates && game.release_dates.length > 0 && (
              <View style={[styles.metaChip, isDark && styles.metaChipDark]}>
                <Text style={[styles.infoText, { color: isDark ? '#CBD5E1' : '#334155' }]}>📅 {new Date(game.release_dates[0].date * 1000).getFullYear()}</Text>
              </View>
            )}
          </View>

          {game.genres && game.genres.length > 0 && (
            <View style={styles.genres}>
              {game.genres.map((genre) => (
                <View key={genre.id} style={styles.genreTag}>
                  <Text style={styles.genreText}>{genre.name}</Text>
                </View>
              ))}
            </View>
          )}

          {game.platforms && game.platforms.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { color: isDark ? '#E5E7EB' : '#333' }]}>Plataformas</Text>
              <View style={styles.platforms}>
                {game.platforms.map((platform) => (
                  <View key={platform.id} style={styles.platformTag}>
                    <Text style={styles.platformText}>{platform.name}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {developerStudios.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>Estudio / Desarrollador</Text>
              <View style={styles.platforms}>
                {developerStudios.map((studio) => (
                  <View key={studio} style={[styles.platformTag, styles.developerTag]}>
                    <Text style={[styles.platformText, styles.developerText]}>{studio}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {screenshotUrls.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>Capturas</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.screenshotsRow}
              >
                {screenshotUrls.map((url, index) => (
                  <TouchableOpacity key={`${url}-${index}`} activeOpacity={0.85} onPress={() => setSelectedScreenshotUrl(url)}>
                    <Image source={{ uri: url }} style={styles.screenshotImage} resizeMode="cover" />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          <>
            <Text style={[styles.sectionTitle, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>Resumen</Text>
            <View style={[styles.descriptionCard, isDark && styles.descriptionCardDark]}>
              <Text style={[styles.description, { color: isDark ? '#CBD5E1' : '#475569' }]}>{summaryText}</Text>
            </View>
          </>

          <>
            <Text style={[styles.sectionTitle, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>Historia</Text>
            <View style={[styles.descriptionCard, isDark && styles.descriptionCardDark]}>
              <Text style={[styles.description, { color: isDark ? '#CBD5E1' : '#475569' }]}>{storylineText}</Text>
            </View>
          </>

        </View>
      </ScrollView>
      <Modal
        visible={Boolean(selectedScreenshotUrl)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedScreenshotUrl(null)}
      >
        <Pressable style={styles.screenshotModalBackdrop} onPress={() => setSelectedScreenshotUrl(null)}>
          <Pressable style={styles.screenshotModalCard} onPress={(event) => event.stopPropagation()}>
            <TouchableOpacity style={styles.screenshotCloseButton} onPress={() => setSelectedScreenshotUrl(null)}>
              <MaterialIcons name="close" size={20} color="#E2E8F0" />
            </TouchableOpacity>
            {selectedScreenshotUrl ? (
              <View style={styles.screenshotModalMedia}>
                <Image source={{ uri: selectedScreenshotUrl }} style={styles.screenshotModalImage} resizeMode="cover" />
              </View>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
      <RatingPickerModal
        visible={isRatingOpen}
        title={game.name}
        value={rating}
        status={status}
        statusOptions={[
          { value: 'planned', label: 'Pendiente', color: '#64748B' },
          { value: 'playing', label: 'Jugando', color: '#7C3AED' },
          { value: 'completed', label: 'Jugado', color: '#16A34A' },
        ]}
        startedAt={startedAt}
        finishedAt={finishedAt}
        startedAtApproximate={startedAtApproximate}
        finishedAtApproximate={finishedAtApproximate}
        onChange={setRating}
        onChangeStatus={(next) => setStatus(next as 'planned' | 'playing' | 'completed')}
        onChangeStartedAt={setStartedAt}
        onChangeFinishedAt={setFinishedAt}
        onChangeStartedAtApproximate={setStartedAtApproximate}
        onChangeFinishedAtApproximate={setFinishedAtApproximate}
        onCancel={() => setIsRatingOpen(false)}
        onConfirm={handleConfirmAdd}
      />
    </RootContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  containerDark: {
    backgroundColor: '#111827',
  },
  scrollContent: {
    paddingBottom: 26,
  },
  scrollView: {
    ...(Platform.OS === 'web' ? ({ scrollbarWidth: 'none', msOverflowStyle: 'none' } as any) : {}),
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(248,250,252,0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.4)',
  },
  backButtonDark: {
    backgroundColor: 'rgba(15,23,42,0.76)',
    borderColor: 'rgba(100,116,139,0.46)',
  },
  backdrop: {
    width: '100%',
    height: 340,
  },
  backdropWrap: {
    position: 'relative',
  },
  backdropOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.32)',
  },
  backdropOverlayDark: {
    backgroundColor: 'rgba(2,6,23,0.52)',
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 18,
    marginTop: -30,
    marginHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 22,
    elevation: 8,
  },
  contentDark: {
    borderColor: '#1E293B',
    backgroundColor: '#0B1220',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },
  title: {
    flex: 1,
    fontSize: 27,
    fontWeight: '800',
    color: '#333',
    letterSpacing: 0.2,
  },
  inlineAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0E7490',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  inlineAddButtonTracked: {
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#B91C1C',
  },
  inlineAddText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  inlineAddTextTracked: {
    color: '#B91C1C',
  },
  myDataCard: {
    marginTop: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 10,
    gap: 8,
  },
  myDataCardDark: {
    backgroundColor: '#111827',
    borderColor: '#334155',
  },
  friendDataCard: {
    marginTop: 4,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#FCD34D',
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  friendDataCardDark: {
    backgroundColor: '#1F2937',
    borderColor: '#92400E',
  },
  friendDataText: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  editDataButton: {
    position: 'absolute',
    top: -10,
    right: -10,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFEFF',
    borderWidth: 1,
    borderColor: '#A5F3FC',
    zIndex: 20,
    elevation: 4,
  },
  editDataButtonDark: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
  },
  myDataTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#67E8F9',
    backgroundColor: '#ECFEFF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusPillDark: {
    borderColor: '#334155',
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0E7490',
  },
  ratingLine: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  myDataDate: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    textAlign: 'right',
  },
  info: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  metaChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CFFAFE',
    backgroundColor: '#F0FDFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  metaChipDark: {
    borderColor: '#334155',
    backgroundColor: '#111827',
  },
  infoText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '700',
  },
  genres: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  genreTag: {
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  genreText: {
    fontSize: 12,
    color: '#0369A1',
    fontWeight: '700',
  },
  platforms: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  platformTag: {
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  platformText: {
    fontSize: 12,
    color: '#6D28D9',
    fontWeight: '700',
  },
  developerTag: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
  },
  developerText: {
    color: '#3730A3',
  },
  screenshotsRow: {
    gap: 10,
    paddingBottom: 6,
    marginBottom: 14,
  },
  screenshotImage: {
    width: 220,
    height: 124,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
    backgroundColor: '#0F172A',
  },
  screenshotModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 24,
  },
  screenshotModalCard: {
    width: '100%',
    maxWidth: 1100,
    height: '86%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0B1220',
    overflow: 'hidden',
  },
  screenshotModalMedia: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
    backgroundColor: '#020617',
  },
  screenshotCloseButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(15,23,42,0.84)',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  screenshotModalImage: {
    width: '100%',
    height: '100%',
    display: 'flex',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#333',
    marginTop: 12,
    marginBottom: 8,
  },
  descriptionCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  descriptionCardDark: {
    borderColor: '#1F2937',
    backgroundColor: '#111827',
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
    color: '#666',
  },
});

export default GameDetailsScreen;
