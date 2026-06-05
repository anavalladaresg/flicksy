/**
 * Pantalla de detalles de película
 */

import { MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import DetailBodyLayout from '../components/detail/DetailBodyLayout';
import DetailHero from '../components/detail/DetailHero';
import DetailMyLibraryCard from '../components/detail/DetailMyLibraryCard';
import { createDetailStyles } from '../components/detail/createDetailStyles';
import { getDetailPalette } from '../components/detail/detailTheme';
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
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import FriendsRatingsBlock from '../components/common/FriendsRatingsBlock';
import { RatingPickerModal } from '../components/common/RatingPickerModal';
import { useMovieDetails } from '../features/movies/presentation/hooks';
import { getFriendLibraryItem, getFriendsRatingsForItem, type FriendItemRating } from '../services/social';
import { buildTMDBWatchUrl, resolveProviderLinksFromTMDBWatchPage } from '../services/tmdb-watch-links';
import { useTrackingStore } from '../store/tracking';
import type { TrackedItem } from '../types';

interface MovieDetailsScreenProps {
  route: any;
  navigation: any;
}

type StreamProvider = { provider_id: number; provider_name: string; logo_path?: string | null };
const DEBUG_WATCH_LINKS =
  Boolean((globalThis as any).__DEV__) || process.env.EXPO_PUBLIC_DEBUG_WATCH_LINKS === 'true';

function getStreamingProviders(payload: any): { region: string | null; providers: StreamProvider[]; watchLink: string | null } {
  const byRegion = payload?.['watch/providers']?.results as Record<string, any> | undefined;
  if (!byRegion) return { region: null, providers: [], watchLink: null };

  const preferredRegions = ['ES', 'US'];
  for (const region of preferredRegions) {
    const flatrate = byRegion?.[region]?.flatrate;
    if (Array.isArray(flatrate) && flatrate.length > 0) {
      return { region, providers: flatrate as StreamProvider[], watchLink: byRegion?.[region]?.link ?? null };
    }
  }

  const fallbackRegion = Object.keys(byRegion).find((key) => Array.isArray(byRegion?.[key]?.flatrate) && byRegion[key].flatrate.length > 0);
  if (!fallbackRegion) return { region: null, providers: [], watchLink: null };
  return {
    region: fallbackRegion,
    providers: byRegion[fallbackRegion].flatrate as StreamProvider[],
    watchLink: byRegion?.[fallbackRegion]?.link ?? null,
  };
}

const MovieDetailsScreen: React.FC<MovieDetailsScreenProps> = ({
  route,
  navigation,
}) => {
  const RootContainer = Platform.OS === 'web' ? View : SafeAreaView;
  const isDark = useColorScheme() === 'dark';
  const palette = getDetailPalette(isDark);
  const detailStyles = useMemo(() => createDetailStyles(palette), [palette]);
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
  const [providerLinks, setProviderLinks] = useState<Record<number, string>>({});
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

  useEffect(() => {
    if (!movie?.id || streaming.providers.length === 0) {
      setProviderLinks({});
      if (DEBUG_WATCH_LINKS) {
        console.log('[watch-links][movie] reset links', {
          movieId: movie?.id,
          providers: streaming.providers.length,
        });
      }
      return;
    }

    let cancelled = false;
    (async () => {
      const links = await resolveProviderLinksFromTMDBWatchPage({
        mediaType: 'movie',
        mediaId: movie.id,
        providers: streaming.providers,
        locale: 'ES',
      });
      if (!cancelled) {
        setProviderLinks(links);
        if (DEBUG_WATCH_LINKS) {
          console.log('[watch-links][movie] resolved provider links', {
            movieId: movie.id,
            providerCount: streaming.providers.length,
            linksFound: Object.keys(links).length,
            linkProviderIds: Object.keys(links),
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [movie?.id, streaming.providers]);

  async function openTrailer() {
    if (!trailerUrl) return;
    const supported = await Linking.canOpenURL(trailerUrl);
    if (supported) await Linking.openURL(trailerUrl);
  }

  async function openExternalUrl(url: string): Promise<boolean> {
    try {
      await Linking.openURL(url);
      return true;
    } catch {
      return false;
    }
  }

  async function openProviderLink(provider: StreamProvider) {
    if (!movie?.id) return;

    let directProviderUrl = providerLinks[provider.provider_id];
    const fallbackWatchUrl = streaming.watchLink || buildTMDBWatchUrl('movie', movie.id, 'ES');
    if (DEBUG_WATCH_LINKS) {
      console.log('[watch-links][movie] chip tap', {
        movieId: movie.id,
        providerId: provider.provider_id,
        providerName: provider.provider_name,
        hasDirectProviderUrl: Boolean(directProviderUrl),
        directProviderUrl,
        fallbackWatchUrl,
      });
    }

    if (!directProviderUrl && streaming.providers.length > 0) {
      const refreshedLinks = await resolveProviderLinksFromTMDBWatchPage({
        mediaType: 'movie',
        mediaId: movie.id,
        providers: streaming.providers,
        locale: 'ES',
      });
      if (Object.keys(refreshedLinks).length > 0) {
        setProviderLinks((previous) => ({ ...previous, ...refreshedLinks }));
      }
      directProviderUrl = refreshedLinks[provider.provider_id];
      if (DEBUG_WATCH_LINKS) {
        console.log('[watch-links][movie] on-demand resolve', {
          movieId: movie.id,
          providerId: provider.provider_id,
          linksFound: Object.keys(refreshedLinks).length,
          directProviderUrl,
        });
      }
    }

    if (directProviderUrl) {
      const opened = await openExternalUrl(directProviderUrl);
      if (DEBUG_WATCH_LINKS) {
        console.log('[watch-links][movie] direct open result', {
          providerId: provider.provider_id,
          opened,
        });
      }
      if (opened) return;
    }

    if (DEBUG_WATCH_LINKS) {
      console.log('[watch-links][movie] fallback to tmdb watch', {
        movieId: movie.id,
        providerId: provider.provider_id,
        fallbackWatchUrl,
      });
    }
    await openExternalUrl(fallbackWatchUrl);
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
      <RootContainer style={detailStyles.container}>
        <CenteredOverlay>
          <MagicLoader size={54} text="Cargando detalles..." />
        </CenteredOverlay>
      </RootContainer>
    );
  }

  if (isError) {
    return (
      <RootContainer style={detailStyles.container}>
        <ErrorMessage
          message="No se pudo cargar los detalles de la película"
          onRetry={() => refetch()}
        />
      </RootContainer>
    );
  }

  if (!movie) {
    return (
      <RootContainer style={detailStyles.container}>
        <Text style={{ color: palette.text }}>Película no encontrada</Text>
      </RootContainer>
    );
  }

  const heroImageUri = movie.poster_path
    ? `https://image.tmdb.org/t/p/original${movie.backdrop_path || movie.poster_path}`
    : null;

  return (
    <RootContainer style={detailStyles.container}>
      <ScrollView style={detailStyles.scrollView} contentContainerStyle={detailStyles.scrollContent} showsVerticalScrollIndicator={false}>
        <DetailHero
          imageUri={heroImageUri}
          onBack={() => navigation.goBack()}
          palette={palette}
          dark={isDark}
        />

        <View style={detailStyles.content}>
          <Text style={detailStyles.title}>{movie.title}</Text>

          <TouchableOpacity
            style={[detailStyles.primaryAction, isTracked && detailStyles.primaryActionTracked]}
            activeOpacity={0.85}
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
              name={isTracked ? 'delete-outline' : 'add'}
              size={18}
              color={isTracked ? palette.danger : '#FFFFFF'}
            />
            <Text style={[detailStyles.primaryActionText, isTracked && detailStyles.primaryActionTextTracked]}>
              {isTracked ? 'Eliminar de biblioteca' : 'Añadir a biblioteca'}
            </Text>
          </TouchableOpacity>

          <DetailBodyLayout
            styles={detailStyles}
            hasSidebar={Boolean(trackedMovieItem || visibleFriendsRatings.length > 0 || (!trackedMovieItem && friendTrackedItem))}
            main={
              <>
          <View style={detailStyles.metaRow}>
            {movie.runtime ? (
              <View style={detailStyles.metaChip}>
                <MaterialIcons name="schedule" size={14} color={palette.subtext} />
                <Text style={detailStyles.metaChipText}>{movie.runtime} min</Text>
              </View>
            ) : null}
            <View style={detailStyles.metaChip}>
              <MaterialIcons name="star-outline" size={14} color={palette.subtext} />
              <Text style={detailStyles.metaChipText}>{movie.vote_average.toFixed(1)}/10</Text>
            </View>
            <View style={detailStyles.metaChip}>
              <MaterialIcons name="calendar-today" size={13} color={palette.subtext} />
              <Text style={detailStyles.metaChipText}>{new Date(movie.release_date).getFullYear()}</Text>
            </View>
          </View>

          {trailerUrl ? (
            <TouchableOpacity style={detailStyles.trailerButton} activeOpacity={0.85} onPress={() => void openTrailer()}>
              <MaterialIcons name="play-circle-outline" size={20} color={palette.brand} />
              <Text style={detailStyles.trailerButtonText}>Ver tráiler</Text>
            </TouchableOpacity>
          ) : null}

          {streaming.providers.length > 0 ? (
            <View style={detailStyles.sectionBlock}>
              <Text style={detailStyles.sectionTitle}>
                Dónde verla {streaming.region ? `· ${streaming.region}` : ''}
              </Text>
              <View style={detailStyles.chipRow}>
                {streaming.providers.map((provider) => (
                  <TouchableOpacity
                    key={provider.provider_id}
                    style={detailStyles.providerChip}
                    activeOpacity={0.85}
                    onPress={() => void openProviderLink(provider)}
                  >
                    {provider.logo_path ? (
                      <Image
                        source={{ uri: `https://image.tmdb.org/t/p/w92${provider.logo_path}` }}
                        style={detailStyles.providerLogo}
                        resizeMode="cover"
                      />
                    ) : null}
                    <Text style={detailStyles.providerName} numberOfLines={1}>
                      {provider.provider_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}

          {movie.genres && movie.genres.length > 0 ? (
            <View style={detailStyles.sectionBlock}>
              <Text style={detailStyles.sectionTitle}>Géneros</Text>
              <View style={detailStyles.chipRow}>
                {movie.genres.map((genre) => (
                  <View key={genre.id} style={detailStyles.genreTag}>
                    <Text style={detailStyles.genreText}>{genre.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <View style={detailStyles.synopsisBlock}>
            <Text style={detailStyles.sectionTitle}>Sinopsis</Text>
            <Text style={detailStyles.synopsisText}>{synopsisText}</Text>
          </View>
              </>
            }
            sidebar={
              <>
                {trackedMovieItem ? (
                  <DetailMyLibraryCard
                    palette={palette}
                    styles={detailStyles}
                    statusLabel={statusLabel((trackedMovieItem.status as 'planned' | 'completed') || 'planned')}
                    statusTone={statusTone((trackedMovieItem.status as 'planned' | 'completed') || 'planned')}
                    ratingText={ratingValue(trackedMovieItem.rating ?? 0)}
                    dateText={`Visto: ${formatShortDate(trackedMovieItem.watchedAt)}`}
                    onEdit={openEditor}
                  />
                ) : null}
                {!trackedMovieItem && friendTrackedItem ? (
                  <View style={detailStyles.friendHint}>
                    <Text style={detailStyles.friendHintText}>
                      {fromFriendName || 'Tu amigo/a'} ha puntuado esta película con{' '}
                      {typeof friendTrackedItem.rating === 'number' ? `${friendTrackedItem.rating.toFixed(1)} ⭐️` : 'sin puntuación'}.
                    </Text>
                  </View>
                ) : null}
                <FriendsRatingsBlock itemLabel="película" ratings={visibleFriendsRatings} variant="sidebar" />
              </>
            }
          />
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

export default MovieDetailsScreen;
