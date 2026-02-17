import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
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
  TouchableOpacity,
  View,
} from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { TMDB_IMAGE_BASE_URL } from '../constants/config';
import { useGamesBySort } from '../features/games/presentation/hooks';
import { useMoviesBySort } from '../features/movies/presentation/hooks';
import { useTVShowsBySort } from '../features/tv/presentation/hooks';
import { Game, Movie, TVShow } from '../types';

const FALLBACK_IMAGE = require('../../assets/images/icon.png');
const ITEMS_PER_SECTION = 10;

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
  items: { id: number; name: string; imageUrl: string | null; rating?: number }[];
  dark: boolean;
}) {
  const router = useRouter();
  return (
    <View style={styles.section}>
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
              <MaterialIcons name="public" size={12} color={dark ? '#93C5FD' : '#0369A1'} />
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

function HomeScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const isWeb = Platform.OS === 'web';
  const moviesQuery = useMoviesBySort('vote_count.desc', 1);
  const tvQuery = useTVShowsBySort('vote_count.desc', 1);
  const gamesQuery = useGamesBySort('rating_count.desc', 1, !isWeb);

  const movies = useMemo(
    () =>
      (moviesQuery.data?.data ?? []).map((movie: Movie) => ({
        id: movie.id,
        name: movie.title,
        imageUrl: movie.poster_path ? `${TMDB_IMAGE_BASE_URL}${movie.poster_path}` : null,
        rating: movie.vote_average,
      })),
    [moviesQuery.data]
  );

  const tvShows = useMemo(
    () =>
      (tvQuery.data?.data ?? []).map((show: TVShow) => ({
        id: show.id,
        name: show.name,
        imageUrl: show.poster_path ? `${TMDB_IMAGE_BASE_URL}${show.poster_path}` : null,
        rating: show.vote_average,
      })),
    [tvQuery.data]
  );

  const games = useMemo(
    () =>
      (gamesQuery.data?.data ?? []).map((game: Game) => ({
        id: game.id,
        name: game.name,
        imageUrl: toGameImageUrl(game),
        rating: game.rating,
      })),
    [gamesQuery.data]
  );

  const isLoading = moviesQuery.isLoading || tvQuery.isLoading || gamesQuery.isLoading;
  const allFailed = moviesQuery.isError && tvQuery.isError && (isWeb || gamesQuery.isError);

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
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.hero, isDark && styles.heroDark]}>
          <View style={styles.heroGlowA} />
          <View style={styles.heroGlowB} />
          <Text style={[styles.heroTitle, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>Flicksy</Text>
          <Text style={[styles.heroSubtitle, { color: isDark ? '#CBD5E1' : '#334155' }]}>Lo más popular del catálogo mundial</Text>
          <View style={styles.heroBadges}>
            <View style={styles.heroBadge}><MaterialIcons name="movie" size={12} color="#0E7490" /><Text style={styles.heroBadgeText}>Pelis</Text></View>
            <View style={styles.heroBadge}><MaterialIcons name="tv" size={12} color="#0E7490" /><Text style={styles.heroBadgeText}>Series</Text></View>
            <View style={styles.heroBadge}><MaterialIcons name="sports-esports" size={12} color="#0E7490" /><Text style={styles.heroBadgeText}>Juegos</Text></View>
          </View>
        </View>

        {moviesQuery.isError ? (
          <Text style={styles.sectionError}>No se pudieron cargar películas.</Text>
        ) : (
          <SectionRow title="Películas" type="movie" items={movies} dark={isDark} />
        )}

        {tvQuery.isError ? (
          <Text style={styles.sectionError}>No se pudieron cargar series.</Text>
        ) : (
          <SectionRow title="Series" type="tv" items={tvShows} dark={isDark} />
        )}

        {isWeb ? (
          <Text style={styles.sectionError}>
            Videojuegos (IGDB) no disponibles en web por CORS. Pruébalo en iOS/Android.
          </Text>
        ) : gamesQuery.isError ? (
          <Text style={styles.sectionError}>No se pudieron cargar videojuegos.</Text>
        ) : (
          <SectionRow title="Videojuegos" type="game" items={games} dark={isDark} />
        )}
      </ScrollView>
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  hero: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 10,
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
  heroBadges: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  heroBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0E7490',
  },
  section: {
    marginTop: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 20,
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
  ratingText: {
    fontSize: 12,
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
});

export { HomeScreen };
export default HomeScreen;
