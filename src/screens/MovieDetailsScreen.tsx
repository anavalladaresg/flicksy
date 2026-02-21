/**
 * Pantalla de detalles de película
 */

import { MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { useColorScheme } from '@/hooks/use-color-scheme';
import MagicLoader from '@/components/loaders/MagicLoader';
import CenteredOverlay from '@/components/layout/CenteredOverlay';
import {
    Alert,
    Image,
    Linking,
    Platform,
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
import { useMovieDetails } from '../features/movies/presentation/hooks';
import { getFriendLibraryItem, getFriendsRatingsForItem, type FriendItemRating } from '../services/social';
import { useTrackingStore } from '../store/tracking';
import type { TrackedItem } from '../types';

interface MovieDetailsScreenProps {
  route: any;
  navigation: any;
}

type StreamProvider = { provider_id: number; provider_name: string; logo_path?: string | null };

function getStreamingProviders(payload: any): { region: string | null; providers: StreamProvider[] } {
  const byRegion = payload?.['watch/providers']?.results as Record<string, any> | undefined;
  if (!byRegion) return { region: null, providers: [] };

  const preferredRegions = ['ES', 'US'];
  for (const region of preferredRegions) {
    const flatrate = byRegion?.[region]?.flatrate;
    if (Array.isArray(flatrate) && flatrate.length > 0) {
      return { region, providers: flatrate as StreamProvider[] };
    }
  }

  const fallbackRegion = Object.keys(byRegion).find((key) => Array.isArray(byRegion?.[key]?.flatrate) && byRegion[key].flatrate.length > 0);
  if (!fallbackRegion) return { region: null, providers: [] };
  return { region: fallbackRegion, providers: byRegion[fallbackRegion].flatrate as StreamProvider[] };
}

const MovieDetailsScreen: React.FC<MovieDetailsScreenProps> = ({
  route,
  navigation,
}) => {
  const RootContainer = Platform.OS === 'web' ? View : SafeAreaView;
  const isDark = useColorScheme() === 'dark';
  const { movieId, fromFriendId, fromFriendName } = route.params;
  const { data: movie, isLoading, isError, refetch } = useMovieDetails(movieId);
  const addTrackedItem = useTrackingStore((state) => state.addItem);
  const updateTrackedItem = useTrackingStore((state) => state.updateItem);
  const removeTrackedItem = useTrackingStore((state) => state.removeItem);
  const trackedItems = useTrackingStore((state) => state.items);
  const [isRatingOpen, setIsRatingOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [status, setStatus] = useState<'planned' | 'completed'>('completed');
  const [watchedAt, setWatchedAt] = useState('');
  const [watchedAtApproximate, setWatchedAtApproximate] = useState(false);
  const [friendTrackedItem, setFriendTrackedItem] = useState<TrackedItem | null>(null);
  const [friendsRatings, setFriendsRatings] = useState<FriendItemRating[]>([]);

  const isTracked = trackedItems.some(
    (item) => item.externalId === movieId && item.mediaType === 'movie'
  );
  const trackedMovieItem = trackedItems.find(
    (item) => item.externalId === movieId && item.mediaType === 'movie'
  );
  const visibleFriendsRatings = fromFriendId
    ? friendsRatings.filter((entry) => entry.friendId !== fromFriendId)
    : friendsRatings;

  useEffect(() => {
    if (!fromFriendId || !movieId) {
      setFriendTrackedItem(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const item = await getFriendLibraryItem(fromFriendId, 'movie', movieId);
      if (!cancelled) setFriendTrackedItem(item);
    })();
    return () => {
      cancelled = true;
    };
  }, [fromFriendId, movieId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ratings = await getFriendsRatingsForItem('movie', movieId);
      if (!cancelled) setFriendsRatings(ratings);
    })();
    return () => {
      cancelled = true;
    };
  }, [movieId]);

  function statusLabel(value: 'planned' | 'completed') {
    if (value === 'planned') return 'Pendiente';
    return 'Vista';
  }

  function ratingValue(value: number) {
    if (!value) return '0.0/10';
    return `${value.toFixed(1)}/10`;
  }

  function statusTone(value: 'planned' | 'completed') {
    if (value === 'planned') return { color: '#64748B', bg: '#F1F5F9', border: '#CBD5E1' };
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
  const trailerVideo = movie?.videos?.results?.find(
    (video) => video.site === 'YouTube' && (video.type === 'Trailer' || video.type === 'Teaser')
  );
  const synopsisText = movie?.overview?.trim() || 'Sinopsis no disponible en español por ahora.';
  const streaming = useMemo(() => getStreamingProviders(movie), [movie]);
  const trailerUrl = trailerVideo?.key ? `https://www.youtube.com/watch?v=${trailerVideo.key}` : null;

  async function openTrailer() {
    if (!trailerUrl) return;
    const supported = await Linking.canOpenURL(trailerUrl);
    if (supported) await Linking.openURL(trailerUrl);
  }

  function requestDeleteTrackedMovie() {
    if (!trackedMovieItem) return;
    if (Platform.OS === 'web') {
      const shouldDelete =
        typeof window !== 'undefined' &&
        window.confirm('¿Seguro que quieres eliminar esta película de tu biblioteca?');
      if (shouldDelete) removeTrackedItem(trackedMovieItem.id);
      return;
    }
    Alert.alert(
      'Eliminar película',
      '¿Seguro que quieres eliminar esta película de tu biblioteca?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => removeTrackedItem(trackedMovieItem.id),
        },
      ]
    );
  }

  const handleConfirmAdd = () => {
    if (!movie) return;
    const canSaveScore = status !== 'planned';
    const canSaveDate = status === 'completed';
    if (trackedMovieItem) {
      updateTrackedItem(trackedMovieItem.id, {
        rating: canSaveScore ? rating : undefined,
        status,
        watchedAt: canSaveDate ? watchedAt.trim() || undefined : undefined,
        watchedAtApproximate: canSaveDate ? watchedAtApproximate : false,
        startedAt: undefined,
        finishedAt: undefined,
        releaseYear: movie.release_date ? new Date(movie.release_date).getFullYear() : undefined,
        genres: movie.genres?.map((genre) => genre.name) ?? [],
        runtimeMinutes: movie.runtime ?? undefined,
        estimatedHours: movie.runtime ? Math.round((movie.runtime / 60) * 10) / 10 : undefined,
      });
      setIsRatingOpen(false);
      return;
    }
    if (movie && !isTracked) {
      addTrackedItem({
        externalId: movie.id,
        mediaType: 'movie',
        title: movie.title,
        posterPath: movie.poster_path || undefined,
        rating: canSaveScore ? rating : undefined,
        status,
        watchedAt: canSaveDate ? watchedAt.trim() || undefined : undefined,
        watchedAtApproximate: canSaveDate ? watchedAtApproximate : false,
        startedAt: undefined,
        finishedAt: undefined,
        releaseYear: movie.release_date ? new Date(movie.release_date).getFullYear() : undefined,
        genres: movie.genres?.map((genre) => genre.name) ?? [],
        runtimeMinutes: movie.runtime ?? undefined,
        estimatedHours: movie.runtime ? Math.round((movie.runtime / 60) * 10) / 10 : undefined,
      });
      setIsRatingOpen(false);
    }
  };

  function openEditor() {
    if (!trackedMovieItem) return;
    setRating(trackedMovieItem.rating ?? 0);
    setStatus(
      (trackedMovieItem.status as 'planned' | 'completed') || 'planned'
    );
    setWatchedAt(trackedMovieItem.watchedAt ?? '');
    setWatchedAtApproximate(Boolean(trackedMovieItem.watchedAtApproximate));
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
          message="No se pudo cargar los detalles de la película"
          onRetry={() => refetch()}
        />
      </RootContainer>
    );
  }

  if (!movie) {
    return (
      <RootContainer style={styles.container}>
        <Text>Película no encontrada</Text>
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

        {movie.poster_path && (
          <View style={styles.backdropWrap}>
            <Image
              source={{
                uri: `https://image.tmdb.org/t/p/original${movie.backdrop_path || movie.poster_path}`,
              }}
              style={styles.backdrop}
              resizeMode="cover"
            />
            <View style={[styles.backdropOverlay, isDark && styles.backdropOverlayDark]} />
          </View>
        )}

        <View style={[styles.content, isDark && styles.contentDark]}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: isDark ? '#E5E7EB' : '#333' }]}>{movie.title}</Text>
            <TouchableOpacity
              style={[styles.inlineAddButton, isTracked && styles.inlineAddButtonTracked]}
              onPress={() => {
                if (trackedMovieItem) {
                  requestDeleteTrackedMovie();
                } else {
                  setRating(0);
                  setStatus('completed');
                  setWatchedAt('');
                  setWatchedAtApproximate(false);
                  setIsRatingOpen(true);
                }
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
          {trackedMovieItem && (
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
                      borderColor: statusTone((trackedMovieItem.status as 'planned' | 'completed') || 'planned').border,
                      backgroundColor: statusTone((trackedMovieItem.status as 'planned' | 'completed') || 'planned').bg,
                    },
                  ]}
                >
                  <MaterialIcons
                    name="flag"
                    size={13}
                    color={statusTone((trackedMovieItem.status as 'planned' | 'completed') || 'planned').color}
                  />
                  <Text
                    style={[
                      styles.statusPillText,
                      { color: statusTone((trackedMovieItem.status as 'planned' | 'completed') || 'planned').color },
                    ]}
                  >
                    {statusLabel((trackedMovieItem.status as 'planned' | 'completed') || 'planned')}
                  </Text>
                </View>
                <Text style={[styles.ratingLine, { color: isDark ? '#E5E7EB' : '#1E293B' }]}>⭐️ {ratingValue(trackedMovieItem.rating ?? 0)}</Text>
              </View>
              <Text style={[styles.myDataDate, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                Visto: {formatShortDate(trackedMovieItem.watchedAt)}
              </Text>
            </View>
          )}
          {!trackedMovieItem && friendTrackedItem && (
            <View style={[styles.friendDataCard, isDark && styles.friendDataCardDark]}>
              <Text style={[styles.friendDataText, { color: isDark ? '#E5E7EB' : '#1E293B' }]}>
                {fromFriendName || 'Tu amigo/a'} ha puntuado esta película con{' '}
                {typeof friendTrackedItem.rating === 'number' ? `${friendTrackedItem.rating.toFixed(1)} ⭐️` : 'sin puntuación'}.
              </Text>
            </View>
          )}
          <FriendsRatingsBlock itemLabel="película" ratings={visibleFriendsRatings} />

          <View style={styles.info}>
            {movie.runtime && (
              <View style={[styles.metaChip, isDark && styles.metaChipDark]}>
                <Text style={[styles.infoText, { color: isDark ? '#CBD5E1' : '#334155' }]}>⏱️ {movie.runtime} min</Text>
              </View>
            )}
            <View style={[styles.metaChip, isDark && styles.metaChipDark]}>
              <Text style={[styles.infoText, { color: isDark ? '#CBD5E1' : '#334155' }]}>🌐 {movie.vote_average.toFixed(1)}/10</Text>
            </View>
            <View style={[styles.metaChip, isDark && styles.metaChipDark]}>
              <Text style={[styles.infoText, { color: isDark ? '#CBD5E1' : '#334155' }]}>📅 {new Date(movie.release_date).getFullYear()}</Text>
            </View>
          </View>

          {trailerUrl ? (
            <TouchableOpacity style={[styles.trailerButton, isDark && styles.trailerButtonDark]} onPress={() => void openTrailer()}>
              <MaterialIcons name="play-circle-filled" size={18} color="#FFFFFF" />
              <Text style={styles.trailerButtonText}>Ver tráiler</Text>
            </TouchableOpacity>
          ) : null}

          {streaming.providers.length > 0 ? (
            <View style={styles.streamingWrap}>
              <Text style={[styles.sectionTitle, { color: isDark ? '#E5E7EB' : '#0F172A', marginTop: 2 }]}>
                Dónde verla {streaming.region ? `(${streaming.region})` : ''}
              </Text>
              <View style={styles.streamingList}>
                {streaming.providers.map((provider) => (
                  <View key={provider.provider_id} style={[styles.providerChip, isDark && styles.providerChipDark]}>
                    {provider.logo_path ? (
                      <Image
                        source={{ uri: `https://image.tmdb.org/t/p/w92${provider.logo_path}` }}
                        style={styles.providerLogo}
                        resizeMode="cover"
                      />
                    ) : null}
                    <Text style={[styles.providerName, { color: isDark ? '#CBD5E1' : '#334155' }]} numberOfLines={1}>
                      {provider.provider_name}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {movie.genres && movie.genres.length > 0 && (
            <View style={styles.genres}>
              {movie.genres.map((genre) => (
                <View key={genre.id} style={styles.genreTag}>
                  <Text style={styles.genreText}>{genre.name}</Text>
                </View>
              ))}
            </View>
          )}

          <Text style={[styles.sectionTitle, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>Sinopsis</Text>
          <View style={[styles.descriptionCard, isDark && styles.descriptionCardDark]}>
            <Text style={[styles.description, { color: isDark ? '#CBD5E1' : '#475569' }]}>{synopsisText}</Text>
          </View>

        </View>
      </ScrollView>
      <RatingPickerModal
        visible={isRatingOpen}
        title={movie.title}
        value={rating}
        status={status}
        statusOptions={[
          { value: 'planned', label: 'Pendiente', color: '#64748B' },
          { value: 'completed', label: 'Visto', color: '#16A34A' },
        ]}
        dateMode="single"
        watchedAt={watchedAt}
        watchedAtApproximate={watchedAtApproximate}
        startedAt=""
        finishedAt=""
        onChange={setRating}
        onChangeStatus={(next) => setStatus(next as 'planned' | 'completed')}
        onChangeWatchedAt={setWatchedAt}
        onChangeWatchedAtApproximate={setWatchedAtApproximate}
        onChangeStartedAt={() => undefined}
        onChangeFinishedAt={() => undefined}
        onCancel={() => setIsRatingOpen(false)}
        onConfirm={handleConfirmAdd}
        onConfirmAndGoBack={() => {
          setIsRatingOpen(false);
          navigation.goBack();
        }}
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
  trailerButton: {
    marginTop: -2,
    marginBottom: 14,
    borderRadius: 12,
    backgroundColor: '#0E7490',
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trailerButtonDark: {
    backgroundColor: '#1E40AF',
  },
  trailerButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  streamingWrap: {
    marginBottom: 14,
  },
  streamingList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  providerChip: {
    maxWidth: 140,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  providerChipDark: {
    borderColor: '#334155',
    backgroundColor: '#111827',
  },
  providerLogo: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#E2E8F0',
  },
  providerName: {
    flexShrink: 1,
    fontSize: 11,
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
    marginBottom: 20,
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

export default MovieDetailsScreen;
