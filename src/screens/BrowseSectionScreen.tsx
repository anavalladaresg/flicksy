import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { TMDB_IMAGE_BASE_URL } from '../constants/config';
import { useGamesBySort } from '../features/games/presentation/hooks';
import { GameSortOption } from '../features/games/domain/repositories';
import { useMoviesBySort } from '../features/movies/presentation/hooks';
import { MovieSortOption } from '../features/movies/domain/repositories';
import { useTVShowsBySort } from '../features/tv/presentation/hooks';
import { TVSortOption } from '../features/tv/domain/repositories';
import { Game, Movie, TVShow } from '../types';

type BrowseType = 'movie' | 'tv' | 'game';
type BrowseItem = { id: number; name: string; imageUrl: string | null; rating?: number };

const FALLBACK_IMAGE = require('../../assets/images/icon.png');

const MOVIE_SORTS: { value: MovieSortOption; label: string }[] = [
  { value: 'popularity.desc', label: 'Popularidad' },
  { value: 'vote_average.desc', label: 'Puntuación' },
  { value: 'primary_release_date.desc', label: 'Estreno reciente' },
];

const TV_SORTS: { value: TVSortOption; label: string }[] = [
  { value: 'popularity.desc', label: 'Popularidad' },
  { value: 'vote_average.desc', label: 'Puntuación' },
  { value: 'first_air_date.desc', label: 'Estreno reciente' },
];

const GAME_SORTS: { value: GameSortOption; label: string }[] = [
  { value: 'rating_count.desc', label: 'Popularidad' },
  { value: 'rating.desc', label: 'Puntuación' },
  { value: 'first_release_date.desc', label: 'Lanzamiento reciente' },
];

function dedupeItems(items: BrowseItem[]): BrowseItem[] {
  const seen = new Set<number>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

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

function mapMovieItems(items: Movie[]): BrowseItem[] {
  return items.map((movie) => ({
    id: movie.id,
    name: movie.title,
    imageUrl: movie.poster_path ? `${TMDB_IMAGE_BASE_URL}${movie.poster_path}` : null,
    rating: movie.vote_average,
  }));
}

function mapTVItems(items: TVShow[]): BrowseItem[] {
  return items.map((show) => ({
    id: show.id,
    name: show.name,
    imageUrl: show.poster_path ? `${TMDB_IMAGE_BASE_URL}${show.poster_path}` : null,
    rating: show.vote_average,
  }));
}

function mapGameItems(items: Game[]): BrowseItem[] {
  return items.map((game) => ({
    id: game.id,
    name: game.name,
    imageUrl: toGameImageUrl(game),
    rating: game.rating,
  }));
}

interface BrowseSectionScreenProps {
  type: BrowseType;
}

function BrowseSectionScreen({ type }: BrowseSectionScreenProps) {
  const router = useRouter();

  const [movieSort, setMovieSort] = useState<MovieSortOption>('popularity.desc');
  const [tvSort, setTVSort] = useState<TVSortOption>('popularity.desc');
  const [gameSort, setGameSort] = useState<GameSortOption>('rating_count.desc');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<BrowseItem[]>([]);

  const currentSort = type === 'movie' ? movieSort : type === 'tv' ? tvSort : gameSort;

  const movieQuery = useMoviesBySort(movieSort, page, type === 'movie');
  const tvQuery = useTVShowsBySort(tvSort, page, type === 'tv');
  const gameQuery = useGamesBySort(gameSort, page, type === 'game');

  const activeQuery = type === 'movie' ? movieQuery : type === 'tv' ? tvQuery : gameQuery;

  useEffect(() => {
    setPage(1);
    setItems([]);
  }, [type, currentSort]);

  useEffect(() => {
    if (!activeQuery.data) return;
    const mapped =
      type === 'movie'
        ? mapMovieItems(activeQuery.data.data as Movie[])
        : type === 'tv'
          ? mapTVItems(activeQuery.data.data as TVShow[])
          : mapGameItems(activeQuery.data.data as Game[]);
    setItems((prev) => dedupeItems([...prev, ...mapped]));
  }, [activeQuery.data, type]);

  const title = type === 'movie' ? 'Películas' : type === 'tv' ? 'Series' : 'Videojuegos';
  const hasMore = activeQuery.data ? page < activeQuery.data.totalPages : false;

  const sortOptions = useMemo(() => {
    return type === 'movie' ? MOVIE_SORTS : type === 'tv' ? TV_SORTS : GAME_SORTS;
  }, [type]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={18} color="#0F172A" />
          <Text style={styles.backButtonText}>Volver</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{title}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sortChips}
        >
          {sortOptions.map((option) => {
            const isActive = option.value === currentSort;
            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.sortChip, isActive && styles.sortChipActive]}
                onPress={() => {
                  if (type === 'movie') setMovieSort(option.value as MovieSortOption);
                  if (type === 'tv') setTVSort(option.value as TVSortOption);
                  if (type === 'game') setGameSort(option.value as GameSortOption);
                }}
              >
                <Text style={[styles.sortChipText, isActive && styles.sortChipTextActive]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {activeQuery.isLoading && page === 1 ? (
          <View style={styles.centeredInline}>
            <ActivityIndicator size="small" color="#0E7490" />
          </View>
        ) : activeQuery.isError ? (
          <Text style={styles.errorLine}>No se pudo cargar el listado.</Text>
        ) : (
          <>
            {items.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.item}
                activeOpacity={0.75}
                onPress={() => router.push(`/${type}/${item.id}`)}
              >
                <Image
                  source={item.imageUrl ? { uri: item.imageUrl } : FALLBACK_IMAGE}
                  style={styles.poster}
                  resizeMode="cover"
                />
                <View style={styles.itemTextWrap}>
                  <Text style={styles.itemTitle}>{item.name}</Text>
                  <Text style={styles.itemMeta}>
                    {item.rating ? `⭐ ${item.rating.toFixed(1)}` : 'Sin rating'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}

            {hasMore && (
              <TouchableOpacity
                style={styles.loadMoreButton}
                onPress={() => setPage((prev) => prev + 1)}
                disabled={activeQuery.isFetching}
              >
                <Text style={styles.loadMoreText}>
                  {activeQuery.isFetching ? 'Cargando...' : 'Cargar más'}
                </Text>
              </TouchableOpacity>
            )}
          </>
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
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
  },
  backButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    marginBottom: 8,
  },
  backButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  sortChips: {
    paddingVertical: 10,
    gap: 8,
  },
  sortChip: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sortChipActive: {
    backgroundColor: '#0E7490',
    borderColor: '#0E7490',
  },
  sortChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  sortChipTextActive: {
    color: '#FFFFFF',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  poster: {
    width: 58,
    height: 82,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  itemTextWrap: {
    marginLeft: 10,
    flex: 1,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  itemMeta: {
    marginTop: 4,
    fontSize: 12,
    color: '#64748B',
  },
  loadMoreButton: {
    marginTop: 8,
    borderRadius: 10,
    paddingVertical: 12,
    backgroundColor: '#0E7490',
    alignItems: 'center',
  },
  loadMoreText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#F8FAFC',
  },
  centeredInline: {
    paddingVertical: 16,
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
  errorLine: {
    fontSize: 14,
    color: '#991B1B',
    marginTop: 10,
  },
});

export { BrowseSectionScreen };
export default BrowseSectionScreen;
