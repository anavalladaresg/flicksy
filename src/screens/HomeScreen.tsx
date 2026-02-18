import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { TMDB_IMAGE_BASE_URL } from '../constants/config';
import { useGamesBySort } from '../features/games/presentation/hooks';
import { useMoviesBySort } from '../features/movies/presentation/hooks';
import { useTVShowsBySort } from '../features/tv/presentation/hooks';
import { getFriendsActivity, type FriendActivityItem } from '../services/social';
import { usePreferencesStore } from '../store/preferences';
import { useTrackingStore } from '../store/tracking';
import { Game, MediaType, Movie, TVShow, TrackedItem } from '../types';

const FALLBACK_IMAGE = require('../../assets/images/icon.png');
const ITEMS_PER_SECTION = 30;
const RECOMMENDATION_ITEMS = 30;
const SAFE_RATIO = 0.8;

type CardItem = { id: number; name: string; imageUrl: string | null; rating?: number };
type RecommendationItem = CardItem & {
  mediaType: MediaType;
  reason: string;
};

function toGameImageUrl(game: Game): string | null {
  if (game.cover?.image_id) {
    return `https://images.igdb.com/igdb/image/upload/t_cover_big_2x/${game.cover.image_id}.jpg`;
  }
  if (!game.cover?.url) return null;
  const normalized =
    game.cover.url.startsWith('//')
      ? `https:${game.cover.url}`
      : game.cover.url.startsWith('http')
        ? game.cover.url
        : `https://${game.cover.url}`;
  return normalized.replace('/t_thumb/', '/t_cover_big_2x/');
}

function SectionRow({
  title,
  type,
  items,
  dark,
}: {
  title: string;
  type: 'movie' | 'tv' | 'game';
  items: CardItem[];
  dark: boolean;
}) {
  const router = useRouter();
  return (
    <View style={[styles.section, styles.sectionCard, dark && styles.sectionCardDark]}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: dark ? '#E5E7EB' : '#0F172A' }]}>{title}</Text>
        <TouchableOpacity onPress={() => router.push(`/browse/${type}`)} style={[styles.moreButton, dark && styles.moreButtonDark]}>
          <MaterialIcons name="chevron-right" size={20} color={dark ? '#E5E7EB' : '#0F172A'} />
        </TouchableOpacity>
      </View>
      <FlatList
        horizontal
        data={items.slice(0, ITEMS_PER_SECTION)}
        keyExtractor={(item) => item.id.toString()}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.75}
            onPress={() => router.push(`/${type}/${item.id}`)}
          >
            <Image
              source={item.imageUrl ? { uri: item.imageUrl } : FALLBACK_IMAGE}
              style={styles.poster}
              resizeMode="cover"
            />
            <Text numberOfLines={2} style={[styles.cardTitle, { color: dark ? '#E5E7EB' : '#0F172A' }]}>
              {item.name}
            </Text>
            <View style={styles.cardMetaRow}>
              <Text style={styles.scoreIcon}>💫</Text>
              <Text style={[styles.ratingText, { color: dark ? '#94A3B8' : '#64748B' }]}>
                {item.rating ? `${(type === 'game' ? item.rating / 10 : item.rating).toFixed(1)}` : 'Sin rating'}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

function PersonalizedRow({
  title,
  items,
  dark,
  onDismiss,
}: {
  title: string;
  items: RecommendationItem[];
  dark: boolean;
  onDismiss: (item: RecommendationItem) => void;
}) {
  const router = useRouter();
  if (items.length === 0) return null;

  return (
    <View style={[styles.section, styles.sectionCard, dark && styles.sectionCardDark]}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: dark ? '#E5E7EB' : '#0F172A' }]}>
          {title}
        </Text>
      </View>
      <FlatList
        horizontal
        data={items}
        keyExtractor={(item) => `${item.mediaType}-${item.id}`}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} activeOpacity={0.75} onPress={() => router.push(`/${item.mediaType}/${item.id}`)}>
            <Image
              source={item.imageUrl ? { uri: item.imageUrl } : FALLBACK_IMAGE}
              style={styles.poster}
              resizeMode="cover"
            />
            <TouchableOpacity style={styles.dismissButton} onPress={() => onDismiss(item)}>
              <MaterialIcons name="block" size={13} color="#7C2D12" />
            </TouchableOpacity>
            <Text numberOfLines={2} style={[styles.cardTitle, { color: dark ? '#E5E7EB' : '#0F172A' }]}>
              {item.name}
            </Text>
            <Text numberOfLines={2} style={[styles.recommendationReason, { color: dark ? '#93C5FD' : '#0369A1' }]}>
              {item.reason}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

function statusBoost(status: TrackedItem['status']): number {
  if (status === 'completed') return 2;
  if (status === 'watching' || status === 'playing') return 1;
  if (status === 'planned') return 0.5;
  return 0;
}

function FriendsActivityRow({
  items,
  dark,
}: {
  items: FriendActivityItem[];
  dark: boolean;
}) {
  const router = useRouter();

  return (
    <View style={[styles.section, styles.sectionCard, dark && styles.sectionCardDark]}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: dark ? '#E5E7EB' : '#0F172A' }]}>Lo que hacen tus amigos</Text>
      </View>
      {items.length === 0 ? (
        <Text style={[styles.friendEmptyText, { color: dark ? '#94A3B8' : '#64748B' }]}>
          Añade amigas/os en Perfil para ver su actividad aquí.
        </Text>
      ) : (
        <FlatList
          horizontal
          data={items}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.friendCard, dark && styles.friendCardDark]}
              activeOpacity={0.8}
              onPress={() => router.push(`/${item.mediaType}/${item.externalId}` as any)}
            >
              <Text numberOfLines={1} style={[styles.friendName, { color: dark ? '#93C5FD' : '#0E7490' }]}>{item.friendName}</Text>
              <Text numberOfLines={2} style={[styles.friendTitle, { color: dark ? '#E5E7EB' : '#0F172A' }]}>{item.title}</Text>
              <Text numberOfLines={1} style={[styles.friendMeta, { color: dark ? '#94A3B8' : '#64748B' }]}>{new Date(item.activityDate).toLocaleDateString('es-ES')}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

function HomeScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const isWeb = Platform.OS === 'web';
  const trackedItems = useTrackingStore((state) => state.items);
  const dismissedRecommendationKeys = usePreferencesStore((state) => state.dismissedRecommendationKeys);
  const dismissRecommendation = usePreferencesStore((state) => state.dismissRecommendation);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [friendsActivity, setFriendsActivity] = useState<FriendActivityItem[]>([]);
  const moviesQuery = useMoviesBySort('vote_count.desc', 1);
  const moviesQueryPage2 = useMoviesBySort('vote_count.desc', 2);
  const tvQuery = useTVShowsBySort('vote_count.desc', 1);
  const tvQueryPage2 = useTVShowsBySort('vote_count.desc', 2);
  const gamesQuery = useGamesBySort('rating_count.desc', 1);
  const gamesQueryPage2 = useGamesBySort('rating_count.desc', 2);

  const movies = useMemo(
    () =>
      ([...(moviesQuery.data?.data ?? []), ...(moviesQueryPage2.data?.data ?? [])] as Movie[])
        .slice(0, ITEMS_PER_SECTION)
        .map((movie: Movie) => ({
        id: movie.id,
        name: movie.title,
        imageUrl: movie.poster_path ? `${TMDB_IMAGE_BASE_URL}${movie.poster_path}` : null,
        rating: movie.vote_average,
      })),
    [moviesQuery.data, moviesQueryPage2.data]
  );

  const tvShows = useMemo(
    () =>
      ([...(tvQuery.data?.data ?? []), ...(tvQueryPage2.data?.data ?? [])] as TVShow[])
        .slice(0, ITEMS_PER_SECTION)
        .map((show: TVShow) => ({
        id: show.id,
        name: show.name,
        imageUrl: show.poster_path ? `${TMDB_IMAGE_BASE_URL}${show.poster_path}` : null,
        rating: show.vote_average,
      })),
    [tvQuery.data, tvQueryPage2.data]
  );

  const games = useMemo(
    () =>
      ([...(gamesQuery.data?.data ?? []), ...(gamesQueryPage2.data?.data ?? [])] as Game[])
        .slice(0, ITEMS_PER_SECTION)
        .map((game: Game) => ({
        id: game.id,
        name: game.name,
        imageUrl: toGameImageUrl(game),
        rating: game.rating,
      })),
    [gamesQuery.data, gamesQueryPage2.data]
  );

  const personalized = useMemo<{ safe: RecommendationItem[]; discovery: RecommendationItem[] }>(() => {
    if (trackedItems.length === 0) return { safe: [], discovery: [] };

    const trackedByType: Record<MediaType, TrackedItem[]> = {
      movie: trackedItems.filter((item) => item.mediaType === 'movie'),
      tv: trackedItems.filter((item) => item.mediaType === 'tv'),
      game: trackedItems.filter((item) => item.mediaType === 'game'),
    };

    const favoriteByType: Partial<Record<MediaType, TrackedItem>> = {};
    (['movie', 'tv', 'game'] as MediaType[]).forEach((type) => {
      const ranked = [...trackedByType[type]].sort(
        (a, b) =>
          ((b.rating ?? 0) + statusBoost(b.status)) - ((a.rating ?? 0) + statusBoost(a.status))
      );
      if (ranked.length > 0) favoriteByType[type] = ranked[0];
    });

    const typePriority = (['movie', 'tv', 'game'] as MediaType[])
      .map((type) => {
        const items = trackedByType[type];
        if (items.length === 0) return { type, score: 0 };
        const score =
          items.reduce((acc, item) => acc + (item.rating ?? 5) + statusBoost(item.status), 0) /
          items.length;
        return { type, score };
      })
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.type);

    const trackedMovieIds = new Set(trackedByType.movie.map((item) => item.externalId));
    const trackedTVIds = new Set(trackedByType.tv.map((item) => item.externalId));
    const trackedGameIds = new Set(trackedByType.game.map((item) => item.externalId));

    const byTypeCandidates: Record<MediaType, CardItem[]> = {
      movie: movies.filter((item) => !trackedMovieIds.has(item.id)),
      tv: tvShows.filter((item) => !trackedTVIds.has(item.id)),
      game: games.filter((item) => !trackedGameIds.has(item.id)),
    };

    const recommendations: RecommendationItem[] = [];
    const perTypeTake = Math.max(10, Math.ceil(RECOMMENDATION_ITEMS / Math.max(1, typePriority.length)) * 2);
    for (const type of typePriority) {
      const baseReason =
        favoriteByType[type]?.rating && (favoriteByType[type]?.rating ?? 0) >= 7
          ? `Porque te gustó ${favoriteByType[type]?.title}`
          : favoriteByType[type]
            ? `Basado en tu ${type === 'game' ? 'actividad de juegos' : type === 'tv' ? 'actividad de series' : 'actividad de películas'}`
            : 'Basado en tu biblioteca';

      const top = byTypeCandidates[type].slice(0, perTypeTake).map((item) => ({
        ...item,
        mediaType: type,
        reason: baseReason,
      }));
      recommendations.push(...top);
    }

    const filtered = recommendations.filter(
      (item) => !dismissedRecommendationKeys.includes(`${item.mediaType}-${item.id}`)
    );

    const safeCount = Math.max(1, Math.floor(RECOMMENDATION_ITEMS * SAFE_RATIO));
    const safe = filtered.slice(0, safeCount);
    const discoveryPool = filtered.filter((item) => !safe.some((s) => s.id === item.id && s.mediaType === item.mediaType));
    const discovery = discoveryPool.slice(0, RECOMMENDATION_ITEMS - safe.length);

    return { safe, discovery };
  }, [trackedItems, movies, tvShows, games, dismissedRecommendationKeys]);

  const isLoading =
    moviesQuery.isLoading ||
    moviesQueryPage2.isLoading ||
    tvQuery.isLoading ||
    tvQueryPage2.isLoading ||
    gamesQuery.isLoading ||
    gamesQueryPage2.isLoading;
  const allFailed = moviesQuery.isError && tvQuery.isError && gamesQuery.isError;

  useEffect(() => {
    if (!feedbackMessage) return;
    const timer = setTimeout(() => setFeedbackMessage(''), 2400);
    return () => clearTimeout(timer);
  }, [feedbackMessage]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const feed = await getFriendsActivity(10);
      if (!cancelled) setFriendsActivity(feed);
    })();
    return () => {
      cancelled = true;
    };
  }, [trackedItems.length]);

  function handleDismissRecommendation(item: RecommendationItem) {
    dismissRecommendation(`${item.mediaType}-${item.id}`);
    setFeedbackMessage(`No recomendaremos "${item.name}" de nuevo.`);
  }

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: isDark ? '#0B1220' : '#F8FAFC' }]}>
        <ActivityIndicator size="large" color="#0E7490" />
        <Text style={[styles.loadingText, { color: isDark ? '#CBD5E1' : '#334155' }]}>Cargando populares...</Text>
      </SafeAreaView>
    );
  }

  if (allFailed) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: isDark ? '#0B1220' : '#F8FAFC' }]}>
        <Text style={styles.errorTitle}>No pudimos cargar el contenido</Text>
        <Text style={styles.errorSubtitle}>Verifica tus claves de TMDB e IGDB y recarga la app.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#0B1220' : '#F8FAFC' }]}> 
      <ScrollView contentContainerStyle={[styles.scrollContent, isWeb && styles.scrollContentWeb]}>
        <View style={[styles.hero, isDark && styles.heroDark]}>
          <View style={styles.heroGlowA} />
          <View style={styles.heroGlowB} />
          <Text style={[styles.heroTitle, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>Flicksy</Text>
          <Text style={[styles.heroSubtitle, { color: isDark ? '#CBD5E1' : '#334155' }]}>Lo más popular del catálogo mundial</Text>
          <Text style={[styles.heroHint, { color: isDark ? '#93C5FD' : '#0369A1' }]}>
            🎬 Películas · 📺 Series · 🎮 Juegos en un solo lugar
          </Text>
        </View>

        <View style={styles.sectionLabelRow}>
          <Text style={styles.sectionEmoji}>❤️</Text>
          <Text style={[styles.sectionLabelText, { color: isDark ? '#CBD5E1' : '#334155' }]}>Para ti</Text>
        </View>
        <PersonalizedRow
          title="Recomendaciones"
          items={personalized.safe}
          dark={isDark}
          onDismiss={handleDismissRecommendation}
        />
        <FriendsActivityRow items={friendsActivity} dark={isDark} />
        <PersonalizedRow
          title="Descubrimiento"
          items={personalized.discovery}
          dark={isDark}
          onDismiss={handleDismissRecommendation}
        />

        <View style={styles.sectionLabelRow}>
          <Text style={styles.sectionEmoji}>🔥</Text>
          <Text style={[styles.sectionLabelText, { color: isDark ? '#CBD5E1' : '#334155' }]}>Tendencias mundiales</Text>
        </View>

        {moviesQuery.isError ? (
          <Text style={styles.sectionError}>No se pudieron cargar películas.</Text>
        ) : (
          <SectionRow title="Películas más vistas" type="movie" items={movies} dark={isDark} />
        )}

        {tvQuery.isError ? (
          <Text style={styles.sectionError}>No se pudieron cargar series.</Text>
        ) : (
          <SectionRow title="Series más vistas" type="tv" items={tvShows} dark={isDark} />
        )}

        {gamesQuery.isError ? (
          <Text style={styles.sectionError}>No se pudieron cargar videojuegos.</Text>
        ) : (
          <SectionRow title="Juegos más jugados" type="game" items={games} dark={isDark} />
        )}
      </ScrollView>
      {feedbackMessage ? (
        <View style={[styles.feedbackToast, isDark && styles.feedbackToastDark]}>
          <MaterialIcons name="check-circle" size={14} color={isDark ? '#A7F3D0' : '#065F46'} />
          <Text style={[styles.feedbackText, { color: isDark ? '#D1FAE5' : '#065F46' }]} numberOfLines={2}>
            {feedbackMessage}
          </Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 28,
  },
  scrollContentWeb: {
    width: '100%',
    maxWidth: 1240,
    alignSelf: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  hero: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 6,
    borderRadius: 20,
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#7DD3FC',
    padding: 16,
    overflow: 'hidden',
  },
  heroDark: {
    backgroundColor: '#111827',
    borderColor: '#1E3A8A',
  },
  heroGlowA: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(14,116,144,0.16)',
    top: -20,
    right: -12,
  },
  heroGlowB: {
    position: 'absolute',
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: 'rgba(45,212,191,0.2)',
    bottom: -16,
    left: -10,
  },
  heroTitle: {
    fontSize: 34,
    fontWeight: '900',
    color: '#0F172A',
  },
  heroSubtitle: {
    marginTop: 4,
    fontSize: 14,
    color: '#334155',
    fontWeight: '600',
  },
  heroHint: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '700',
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
  },
  sectionLabelText: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 0.3,
    lineHeight: 34,
  },
  sectionEmoji: {
    fontSize: 24,
    lineHeight: 28,
  },
  section: {
    marginTop: 8,
    marginHorizontal: 16,
  },
  sectionCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
  },
  sectionCardDark: {
    borderColor: '#1F2937',
    backgroundColor: '#111827',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  moreButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreButtonDark: {
    backgroundColor: '#1F2937',
  },
  listContent: {
    paddingHorizontal: 12,
  },
  card: {
    width: 140,
    marginHorizontal: 4,
    position: 'relative',
  },
  friendCard: {
    width: 180,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 10,
    marginHorizontal: 4,
    backgroundColor: '#FFFFFF',
  },
  friendCardDark: {
    backgroundColor: '#0B1220',
    borderColor: '#1F2937',
  },
  friendName: {
    fontSize: 12,
    fontWeight: '800',
  },
  friendTitle: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '700',
    minHeight: 32,
  },
  friendMeta: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '600',
  },
  friendEmptyText: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  poster: {
    width: 140,
    height: 200,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
  },
  cardTitle: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '600',
    minHeight: 34,
  },
  cardMetaRow: {
    marginTop: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recommendationReason: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 14,
  },
  dismissButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: '#FDBA74',
    zIndex: 20,
  },
  ratingText: {
    fontSize: 12,
  },
  scoreIcon: {
    fontSize: 12,
    lineHeight: 14,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#7F1D1D',
    textAlign: 'center',
  },
  errorSubtitle: {
    marginTop: 8,
    fontSize: 14,
    color: '#991B1B',
    textAlign: 'center',
  },
  sectionError: {
    fontSize: 14,
    color: '#991B1B',
    paddingHorizontal: 16,
    marginTop: 18,
  },
  feedbackToast: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 14,
    backgroundColor: '#D1FAE5',
    borderColor: '#6EE7B7',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  feedbackToastDark: {
    backgroundColor: '#064E3B',
    borderColor: '#047857',
  },
  feedbackText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
  },
});

export { HomeScreen };
export default HomeScreen;
