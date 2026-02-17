import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { TMDB_IMAGE_BASE_URL } from '../constants/config';
import { usePopularGames } from '../features/games/presentation/hooks';
import { usePopularMovies } from '../features/movies/presentation/hooks';
import { usePopularTVShows } from '../features/tv/presentation/hooks';
import { Game, Movie, TVShow } from '../types';

const FALLBACK_IMAGE = require('../../assets/images/icon.png');
const ITEMS_PER_SECTION = 5;

function randomPage(max: number): number {
  return Math.floor(Math.random() * max) + 1;
}

function pickRandomItems<T>(items: T[], count: number): T[] {
  const shuffled = [...items].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function toGameImageUrl(game: Game): string | null {
  if (!game.cover?.url) return null;
  if (game.cover.url.startsWith('//')) return `https:${game.cover.url}`;
  if (game.cover.url.startsWith('http')) return game.cover.url;
  return `https://${game.cover.url}`;
}

function MediaRow({
  title,
  items,
}: {
  title: string;
  items: { id: number; name: string; imageUrl: string | null; rating?: number }[];
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <FlatList
        horizontal
        data={items}
        keyExtractor={(item) => item.id.toString()}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Image
              source={item.imageUrl ? { uri: item.imageUrl } : FALLBACK_IMAGE}
              style={styles.poster}
              resizeMode="cover"
            />
            <Text numberOfLines={2} style={styles.cardTitle}>
              {item.name}
            </Text>
            <Text style={styles.ratingText}>
              {item.rating ? `⭐ ${item.rating.toFixed(1)}` : 'Sin rating'}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

function HomeScreen() {
  const isWeb = Platform.OS === 'web';
  const moviePage = useMemo(() => randomPage(30), []);
  const tvPage = useMemo(() => randomPage(30), []);
  const gamePage = useMemo(() => randomPage(20), []);

  const moviesQuery = usePopularMovies(moviePage);
  const tvQuery = usePopularTVShows(tvPage);
  const gamesQuery = usePopularGames(gamePage, !isWeb);

  const movies = useMemo(
    () =>
      pickRandomItems(moviesQuery.data?.data ?? [], ITEMS_PER_SECTION).map((movie: Movie) => ({
        id: movie.id,
        name: movie.title,
        imageUrl: movie.poster_path ? `${TMDB_IMAGE_BASE_URL}${movie.poster_path}` : null,
        rating: movie.vote_average,
      })),
    [moviesQuery.data]
  );

  const tvShows = useMemo(
    () =>
      pickRandomItems(tvQuery.data?.data ?? [], ITEMS_PER_SECTION).map((show: TVShow) => ({
        id: show.id,
        name: show.name,
        imageUrl: show.poster_path ? `${TMDB_IMAGE_BASE_URL}${show.poster_path}` : null,
        rating: show.vote_average,
      })),
    [tvQuery.data]
  );

  const games = useMemo(
    () =>
      pickRandomItems(gamesQuery.data?.data ?? [], ITEMS_PER_SECTION).map((game: Game) => ({
        id: game.id,
        name: game.name,
        imageUrl: toGameImageUrl(game),
        rating: game.rating,
      })),
    [gamesQuery.data]
  );

  const isLoading = moviesQuery.isLoading || tvQuery.isLoading || gamesQuery.isLoading;
  const allFailed = moviesQuery.isError && tvQuery.isError && gamesQuery.isError;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#0E7490" />
        <Text style={styles.loadingText}>Cargando recomendaciones aleatorias...</Text>
      </SafeAreaView>
    );
  }

  if (allFailed) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorTitle}>No pudimos cargar el contenido</Text>
        <Text style={styles.errorSubtitle}>Verifica tus claves de TMDB e IGDB y recarga la app.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Flicksy</Text>
        <Text style={styles.subtitle}>5 películas, 5 series y 5 juegos al azar</Text>

        {moviesQuery.isError ? (
          <Text style={styles.sectionError}>No se pudieron cargar películas.</Text>
        ) : (
          <MediaRow title="Películas" items={movies} />
        )}
        {tvQuery.isError ? (
          <Text style={styles.sectionError}>No se pudieron cargar series.</Text>
        ) : (
          <MediaRow title="Series" items={tvShows} />
        )}
        {isWeb ? (
          <Text style={styles.sectionError}>
            Videojuegos (IGDB) no disponibles en web por CORS. Pruébalo en iOS/Android.
          </Text>
        ) : gamesQuery.isError ? (
          <Text style={styles.sectionError}>No se pudieron cargar videojuegos (IGDB).</Text>
        ) : (
          <MediaRow title="Videojuegos" items={games} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingVertical: 12,
    paddingBottom: 28,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#F8FAFC',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    paddingHorizontal: 16,
  },
  subtitle: {
    fontSize: 14,
    color: '#475569',
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
  },
  section: {
    marginTop: 14,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  listContent: {
    paddingHorizontal: 12,
  },
  card: {
    width: 140,
    marginHorizontal: 4,
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
    color: '#0F172A',
    minHeight: 34,
  },
  ratingText: {
    marginTop: 2,
    fontSize: 12,
    color: '#64748B',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#334155',
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
});

export { HomeScreen };
export default HomeScreen;
