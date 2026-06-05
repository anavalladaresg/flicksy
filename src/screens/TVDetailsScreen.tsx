/**
 * Pantalla de detalles de serie TV
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
import { useTVShowDetails } from '../features/tv/presentation/hooks';
import { getFriendLibraryItem, getFriendsRatingsForItem, type FriendItemRating } from '../services/social';
import { buildTMDBWatchUrl, resolveProviderLinksFromTMDBWatchPage } from '../services/tmdb-watch-links';
import { useTrackingStore } from '../store/tracking';
import type { TrackedItem } from '../types';

interface TVDetailsScreenProps {
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

const TVDetailsScreen: React.FC<TVDetailsScreenProps> = ({
  route,
  navigation,
}) => {
  const RootContainer = Platform.OS === 'web' ? View : SafeAreaView;
  const isDark = useColorScheme() === 'dark';
  const palette = getDetailPalette(isDark);
  const detailStyles = useMemo(() => createDetailStyles(palette), [palette]);
  const { tvId, fromFriendId, fromFriendName } = route.params;
  const { data: show, isLoading, isError, refetch } = useTVShowDetails(tvId);
  const addTrackedItem = useTrackingStore((state) => state.addItem);
  const updateTrackedItem = useTrackingStore((state) => state.updateItem);
  const removeTrackedItem = useTrackingStore((state) => state.removeItem);
  const trackedItems = useTrackingStore((state) => state.items);
  const [isRatingOpen, setIsRatingOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [status, setStatus] = useState<'planned' | 'watching' | 'completed'>('completed');
  const [startedAt, setStartedAt] = useState('');
  const [finishedAt, setFinishedAt] = useState('');
  const [startedAtApproximate, setStartedAtApproximate] = useState(false);
  const [finishedAtApproximate, setFinishedAtApproximate] = useState(false);
  const [providerLinks, setProviderLinks] = useState<Record<number, string>>({});
  const [friendTrackedItem, setFriendTrackedItem] = useState<TrackedItem | null>(null);
  const [friendsRatings, setFriendsRatings] = useState<FriendItemRating[]>([]);

  const isTracked = trackedItems.some(
    (item) => item.externalId === tvId && item.mediaType === 'tv'
  );
  const trackedTVItem = trackedItems.find(
    (item) => item.externalId === tvId && item.mediaType === 'tv'
  );
  const visibleFriendsRatings = fromFriendId
    ? friendsRatings.filter((entry) => entry.friendId !== fromFriendId)
    : friendsRatings;

  useEffect(() => {
    if (!fromFriendId || !tvId) {
      setFriendTrackedItem(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const item = await getFriendLibraryItem(fromFriendId, 'tv', tvId);
      if (!cancelled) setFriendTrackedItem(item);
    })();
    return () => {
      cancelled = true;
    };
  }, [fromFriendId, tvId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ratings = await getFriendsRatingsForItem('tv', tvId);
      if (!cancelled) setFriendsRatings(ratings);
    })();
    return () => {
      cancelled = true;
    };
  }, [tvId]);

  function statusLabel(value: 'planned' | 'watching' | 'completed') {
    if (value === 'planned') return 'Pendiente';
    if (value === 'watching') return 'Viendo';
    return 'Vista';
  }

  function ratingValue(value: number) {
    if (!value) return '0.0/10';
    return `${value.toFixed(1)}/10`;
  }

  function statusTone(value: 'planned' | 'watching' | 'completed') {
    if (value === 'planned') return { color: '#64748B', bg: '#F1F5F9', border: '#CBD5E1' };
    if (value === 'watching') return { color: '#0369A1', bg: '#E0F2FE', border: '#7DD3FC' };
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
  const trailerVideo = show?.videos?.results?.find(
    (video) => video.site === 'YouTube' && (video.type === 'Trailer' || video.type === 'Teaser')
  );
  const synopsisText = show?.overview?.trim() || 'Sinopsis no disponible en español por ahora.';
  const streaming = useMemo(() => getStreamingProviders(show), [show]);
  const trailerUrl = trailerVideo?.key ? `https://www.youtube.com/watch?v=${trailerVideo.key}` : null;

  useEffect(() => {
    if (!show?.id || streaming.providers.length === 0) {
      setProviderLinks({});
      if (DEBUG_WATCH_LINKS) {
        console.log('[watch-links][tv] reset links', {
          tvId: show?.id,
          providers: streaming.providers.length,
        });
      }
      return;
    }

    let cancelled = false;
    (async () => {
      const links = await resolveProviderLinksFromTMDBWatchPage({
        mediaType: 'tv',
        mediaId: show.id,
        providers: streaming.providers,
        locale: 'ES',
      });
      if (!cancelled) {
        setProviderLinks(links);
        if (DEBUG_WATCH_LINKS) {
          console.log('[watch-links][tv] resolved provider links', {
            tvId: show.id,
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
  }, [show?.id, streaming.providers]);

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
    if (!show?.id) return;

    let directProviderUrl = providerLinks[provider.provider_id];
    const fallbackWatchUrl = streaming.watchLink || buildTMDBWatchUrl('tv', show.id, 'ES');
    if (DEBUG_WATCH_LINKS) {
      console.log('[watch-links][tv] chip tap', {
        tvId: show.id,
        providerId: provider.provider_id,
        providerName: provider.provider_name,
        hasDirectProviderUrl: Boolean(directProviderUrl),
        directProviderUrl,
        fallbackWatchUrl,
      });
    }

    if (!directProviderUrl && streaming.providers.length > 0) {
      const refreshedLinks = await resolveProviderLinksFromTMDBWatchPage({
        mediaType: 'tv',
        mediaId: show.id,
        providers: streaming.providers,
        locale: 'ES',
      });
      if (Object.keys(refreshedLinks).length > 0) {
        setProviderLinks((previous) => ({ ...previous, ...refreshedLinks }));
      }
      directProviderUrl = refreshedLinks[provider.provider_id];
      if (DEBUG_WATCH_LINKS) {
        console.log('[watch-links][tv] on-demand resolve', {
          tvId: show.id,
          providerId: provider.provider_id,
          linksFound: Object.keys(refreshedLinks).length,
          directProviderUrl,
        });
      }
    }

    if (directProviderUrl) {
      const opened = await openExternalUrl(directProviderUrl);
      if (DEBUG_WATCH_LINKS) {
        console.log('[watch-links][tv] direct open result', {
          providerId: provider.provider_id,
          opened,
        });
      }
      if (opened) return;
    }

    if (DEBUG_WATCH_LINKS) {
      console.log('[watch-links][tv] fallback to tmdb watch', {
        tvId: show.id,
        providerId: provider.provider_id,
        fallbackWatchUrl,
      });
    }
    await openExternalUrl(fallbackWatchUrl);
  }

  function requestDeleteTrackedTV() {
    if (!trackedTVItem) return;
    if (Platform.OS === 'web') {
      const shouldDelete =
        typeof window !== 'undefined' &&
        window.confirm('¿Seguro que quieres eliminar esta serie de tu biblioteca?');
      if (shouldDelete) removeTrackedItem(trackedTVItem.id);
      return;
    }
    Alert.alert(
      'Eliminar serie',
      '¿Seguro que quieres eliminar esta serie de tu biblioteca?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => removeTrackedItem(trackedTVItem.id),
        },
      ]
    );
  }

  const handleConfirmAdd = () => {
    if (!show) return;
    const canSaveScore = status !== 'planned';
    const canSaveStart = status === 'watching' || status === 'completed';
    const canSaveEnd = status === 'completed';
    if (trackedTVItem) {
      updateTrackedItem(trackedTVItem.id, {
        rating: canSaveScore ? rating : undefined,
        status,
        startedAt: canSaveStart ? startedAt.trim() || undefined : undefined,
        finishedAt: canSaveEnd ? finishedAt.trim() || undefined : undefined,
        startedAtApproximate: canSaveStart ? startedAtApproximate : false,
        finishedAtApproximate: canSaveEnd ? finishedAtApproximate : false,
        releaseYear: show.first_air_date ? new Date(show.first_air_date).getFullYear() : undefined,
        genres: show.genres?.map((genre) => genre.name) ?? [],
        estimatedHours: show.number_of_episodes ? Math.round(show.number_of_episodes * 0.75) : undefined,
        seasonsAtAdd: show.number_of_seasons ?? undefined,
      });
      setIsRatingOpen(false);
      return;
    }
    if (show && !isTracked) {
      addTrackedItem({
        externalId: show.id,
        mediaType: 'tv',
        title: show.name,
        posterPath: show.poster_path || undefined,
        rating: canSaveScore ? rating : undefined,
        status,
        startedAt: canSaveStart ? startedAt.trim() || undefined : undefined,
        finishedAt: canSaveEnd ? finishedAt.trim() || undefined : undefined,
        startedAtApproximate: canSaveStart ? startedAtApproximate : false,
        finishedAtApproximate: canSaveEnd ? finishedAtApproximate : false,
        releaseYear: show.first_air_date ? new Date(show.first_air_date).getFullYear() : undefined,
        genres: show.genres?.map((genre) => genre.name) ?? [],
        estimatedHours: show.number_of_episodes ? Math.round(show.number_of_episodes * 0.75) : undefined,
        seasonsAtAdd: show.number_of_seasons ?? undefined,
      });
      setIsRatingOpen(false);
    }
  };

  function openEditor() {
    if (!trackedTVItem) return;
    setRating(trackedTVItem.rating ?? 0);
    setStatus(
      (trackedTVItem.status as 'planned' | 'watching' | 'completed') || 'planned'
    );
    setStartedAt(trackedTVItem.startedAt ?? '');
    setFinishedAt(trackedTVItem.finishedAt ?? '');
    setStartedAtApproximate(Boolean(trackedTVItem.startedAtApproximate));
    setFinishedAtApproximate(Boolean(trackedTVItem.finishedAtApproximate));
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
          message="No se pudo cargar los detalles de la serie"
          onRetry={() => refetch()}
        />
      </RootContainer>
    );
  }

  if (!show) {
    return (
      <RootContainer style={detailStyles.container}>
        <Text style={{ color: palette.text }}>Serie no encontrada</Text>
      </RootContainer>
    );
  }

  const heroImageUri = show.poster_path
    ? `https://image.tmdb.org/t/p/original${show.backdrop_path || show.poster_path}`
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
          <Text style={detailStyles.title}>{show.name}</Text>

          <TouchableOpacity
            style={[detailStyles.primaryAction, isTracked && detailStyles.primaryActionTracked]}
            activeOpacity={0.85}
            onPress={() => {
              if (trackedTVItem) {
                requestDeleteTrackedTV();
              } else {
                setRating(0);
                setStatus('completed');
                setStartedAt('');
                setFinishedAt('');
                setStartedAtApproximate(false);
                setFinishedAtApproximate(false);
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
            hasSidebar={Boolean(trackedTVItem || visibleFriendsRatings.length > 0 || (!trackedTVItem && friendTrackedItem))}
            main={
              <>
          <View style={detailStyles.metaRow}>
            {show.number_of_seasons ? (
              <View style={detailStyles.metaChip}>
                <MaterialIcons name="tv" size={14} color={palette.subtext} />
                <Text style={detailStyles.metaChipText}>{show.number_of_seasons} temporada(s)</Text>
              </View>
            ) : null}
            {show.number_of_episodes ? (
              <View style={detailStyles.metaChip}>
                <MaterialIcons name="movie" size={14} color={palette.subtext} />
                <Text style={detailStyles.metaChipText}>{show.number_of_episodes} episodios</Text>
              </View>
            ) : null}
            <View style={detailStyles.metaChip}>
              <MaterialIcons name="star-outline" size={14} color={palette.subtext} />
              <Text style={detailStyles.metaChipText}>{show.vote_average.toFixed(1)}/10</Text>
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

          {show.genres && show.genres.length > 0 ? (
            <View style={detailStyles.sectionBlock}>
              <Text style={detailStyles.sectionTitle}>Géneros</Text>
              <View style={detailStyles.chipRow}>
                {show.genres.map((genre) => (
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
                {trackedTVItem ? (
                  <DetailMyLibraryCard
                    palette={palette}
                    styles={detailStyles}
                    statusLabel={statusLabel((trackedTVItem.status as 'planned' | 'watching' | 'completed') || 'planned')}
                    statusTone={statusTone((trackedTVItem.status as 'planned' | 'watching' | 'completed') || 'planned')}
                    ratingText={ratingValue(trackedTVItem.rating ?? 0)}
                    dateText={`${formatShortDate(trackedTVItem.startedAt)} – ${formatShortDate(trackedTVItem.finishedAt)}`}
                    onEdit={openEditor}
                  />
                ) : null}
                {!trackedTVItem && friendTrackedItem ? (
                  <View style={detailStyles.friendHint}>
                    <Text style={detailStyles.friendHintText}>
                      {fromFriendName || 'Tu amigo/a'} ha puntuado esta serie con{' '}
                      {typeof friendTrackedItem.rating === 'number' ? `${friendTrackedItem.rating.toFixed(1)} ⭐️` : 'sin puntuación'}.
                    </Text>
                  </View>
                ) : null}
                <FriendsRatingsBlock itemLabel="serie" ratings={visibleFriendsRatings} variant="sidebar" />
              </>
            }
          />
        </View>
      </ScrollView>
      <RatingPickerModal
        visible={isRatingOpen}
        title={show.name}
        value={rating}
        status={status}
        statusOptions={[
          { value: 'planned', label: 'Pendiente', color: '#64748B' },
          { value: 'watching', label: 'Viendo', color: '#0284C7' },
          { value: 'completed', label: 'Visto', color: '#16A34A' },
        ]}
        startedAt={startedAt}
        finishedAt={finishedAt}
        startedAtApproximate={startedAtApproximate}
        finishedAtApproximate={finishedAtApproximate}
        onChange={setRating}
        onChangeStatus={(next) => setStatus(next as 'planned' | 'watching' | 'completed')}
        onChangeStartedAt={setStartedAt}
        onChangeFinishedAt={setFinishedAt}
        onChangeStartedAtApproximate={setStartedAtApproximate}
        onChangeFinishedAtApproximate={setFinishedAtApproximate}
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

export default TVDetailsScreen;
