import React, { useEffect, useMemo, useState } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ActivityIndicator,
  Image,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { STORAGE_KEYS, TMDB_IMAGE_BASE_URL } from '../constants/config';
import { useSearchGames } from '../features/games/presentation/hooks';
import { useSearchMovies } from '../features/movies/presentation/hooks';
import { useSearchTVShows } from '../features/tv/presentation/hooks';
import { Game, Movie, TVShow } from '../types';

const FALLBACK_IMAGE = require('../../assets/images/icon.png');

type SearchType = 'all' | 'movie' | 'tv' | 'game';

type MixedResult = {
  id: number;
  mediaType: 'movie' | 'tv' | 'game';
  title: string;
  imageUrl: string | null;
  rating: number | null;
  popularity: number;
};

function stripDiacritics(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeText(value: string): string {
  return stripDiacritics(value).toLowerCase().trim();
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

function dedupeById<T extends { id: number }>(items: T[]): T[] {
  const seen = new Set<number>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function containsAllWords(value: string, normalizedQuery: string): boolean {
  const words = normalizedQuery.split(/\s+/).filter(Boolean);
  const normalizedValue = normalizeText(value);
  return words.every((word) => normalizedValue.includes(word));
}

function containsAllWordsInAny(values: (string | undefined | null)[], normalizedQuery: string): boolean {
  const candidates = values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
  return candidates.some((value) => containsAllWords(value, normalizedQuery));
}

function SearchScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const isWeb = Platform.OS === 'web';

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedType, setSelectedType] = useState<SearchType>('all');
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [isInputFocused, setIsInputFocused] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEYS.SEARCH_HISTORY);
        if (!raw || !mounted) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setSearchHistory(parsed.filter((item): item is string => typeof item === 'string').slice(0, 5));
        }
      } catch {
        // ignore malformed storage data
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function saveSearchTerm(term: string) {
    const cleaned = term.trim();
    if (!cleaned) return;
    const updated = [cleaned, ...searchHistory.filter((item) => normalizeText(item) !== normalizeText(cleaned))].slice(0, 5);
    setSearchHistory(updated);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SEARCH_HISTORY, JSON.stringify(updated));
    } catch {
      // ignore storage write errors
    }
  }

  function applySuggestedQuery(term: string) {
    const next = term.trim();
    if (!next) return;
    // Reemplaza lo escrito y ejecuta búsqueda inmediatamente.
    setQuery(next);
    setDebouncedQuery(next);
    void saveSearchTerm(next);
  }

  const primaryQuery = debouncedQuery.trim();
  const typedQuery = query.trim();
  const hasTypedQuery = typedQuery.length > 0;
  const accentlessQuery = stripDiacritics(primaryQuery);
  const normalizedQuery = normalizeText(primaryQuery);
  const normalizedTypedQuery = normalizeText(typedQuery);
  const hasQuery = primaryQuery.length > 0;

  const moviesEnabled = hasQuery && (selectedType === 'all' || selectedType === 'movie');
  const tvEnabled = hasQuery && (selectedType === 'all' || selectedType === 'tv');
  const gamesEnabled = hasQuery && (selectedType === 'all' || selectedType === 'game');

  const useAccentlessMovies = moviesEnabled && accentlessQuery !== primaryQuery;
  const useAccentlessTV = tvEnabled && accentlessQuery !== primaryQuery;
  const useAccentlessGames = gamesEnabled && accentlessQuery !== primaryQuery;

  const moviesPrimary = useSearchMovies({ query: primaryQuery, page: 1 }, moviesEnabled);
  const moviesAccentless = useSearchMovies(
    { query: accentlessQuery, page: 1 },
    useAccentlessMovies
  );

  const tvPrimary = useSearchTVShows({ query: primaryQuery, page: 1 }, tvEnabled);
  const tvAccentless = useSearchTVShows({ query: accentlessQuery, page: 1 }, useAccentlessTV);

  const gamesPrimary = useSearchGames(primaryQuery, 1, gamesEnabled);
  const gamesAccentless = useSearchGames(accentlessQuery, 1, useAccentlessGames);

  const movies = useMemo(() => {
    if (!moviesEnabled) return [];
    const merged = dedupeById<Movie>([
      ...(moviesPrimary.data?.data ?? []),
      ...(moviesAccentless.data?.data ?? []),
    ]);
    return merged.filter((item) =>
      containsAllWordsInAny([item.title, (item as any).original_title], normalizedQuery)
    );
  }, [moviesPrimary.data, moviesAccentless.data, normalizedQuery, moviesEnabled]);

  const tvShows = useMemo(() => {
    if (!tvEnabled) return [];
    const merged = dedupeById<TVShow>([
      ...(tvPrimary.data?.data ?? []),
      ...(tvAccentless.data?.data ?? []),
    ]);
    return merged.filter((item) =>
      containsAllWordsInAny([item.name, (item as any).original_name], normalizedQuery)
    );
  }, [tvPrimary.data, tvAccentless.data, normalizedQuery, tvEnabled]);

  const games = useMemo(() => {
    if (!gamesEnabled) return [];
    const merged = dedupeById<Game>([
      ...(gamesPrimary.data?.data ?? []),
      ...(gamesAccentless.data?.data ?? []),
    ]);
    return merged.filter((item) => containsAllWords(item.name, normalizedQuery));
  }, [gamesPrimary.data, gamesAccentless.data, normalizedQuery, gamesEnabled]);

  const mixedResults = useMemo<MixedResult[]>(() => {
    const mixed: MixedResult[] = [
      ...movies.map((movie) => ({
        id: movie.id,
        mediaType: 'movie' as const,
        title: movie.title,
        imageUrl: movie.poster_path ? `${TMDB_IMAGE_BASE_URL}${movie.poster_path}` : null,
        rating: movie.vote_average,
        popularity: (movie as any).vote_count ?? 0,
      })),
      ...tvShows.map((show) => ({
        id: show.id,
        mediaType: 'tv' as const,
        title: show.name,
        imageUrl: show.poster_path ? `${TMDB_IMAGE_BASE_URL}${show.poster_path}` : null,
        rating: show.vote_average,
        popularity: (show as any).vote_count ?? 0,
      })),
      ...games.map((game) => ({
        id: game.id,
        mediaType: 'game' as const,
        title: game.name,
        imageUrl: toGameImageUrl(game),
        rating: game.rating ? game.rating / 10 : null,
        popularity: (game as any).rating_count ?? 0,
      })),
    ];

    return mixed.sort((a, b) => {
      if (b.popularity !== a.popularity) return b.popularity - a.popularity;
      const rb = b.rating ?? -1;
      const ra = a.rating ?? -1;
      if (rb !== ra) return rb - ra;
      return a.title.localeCompare(b.title, 'es', { sensitivity: 'base' });
    });
  }, [movies, tvShows, games]);

  const isLoading =
    (moviesEnabled && (moviesPrimary.isFetching || moviesAccentless.isFetching)) ||
    (tvEnabled && (tvPrimary.isFetching || tvAccentless.isFetching)) ||
    (gamesEnabled && (gamesPrimary.isFetching || gamesAccentless.isFetching));

  const noResults = hasQuery && !isLoading && mixedResults.length === 0;
  const completionSuggestions = useMemo(() => {
    if (!hasTypedQuery) return [];
    const scored = new Map<string, { title: string; popularity: number; startsWith: boolean }>();

    mixedResults.forEach((item) => {
      const normalizedTitle = normalizeText(item.title);
      if (!normalizedTitle.includes(normalizedTypedQuery)) return;
      const key = normalizedTitle;
      const startsWith = normalizedTitle.startsWith(normalizedTypedQuery);
      const current = scored.get(key);
      if (!current || item.popularity > current.popularity) {
        scored.set(key, { title: item.title, popularity: item.popularity, startsWith });
      }
    });

    // History matches are fallback if there are not enough API suggestions.
    searchHistory.forEach((term) => {
      const normalizedTerm = normalizeText(term);
      if (!normalizedTerm.includes(normalizedTypedQuery)) return;
      if (!scored.has(normalizedTerm)) {
        scored.set(normalizedTerm, {
          title: term,
          popularity: -1,
          startsWith: normalizedTerm.startsWith(normalizedTypedQuery),
        });
      }
    });

    return [...scored.values()]
      .sort((a, b) => {
        if (a.popularity !== b.popularity) return b.popularity - a.popularity;
        if (a.startsWith !== b.startsWith) return a.startsWith ? -1 : 1;
        return a.title.localeCompare(b.title, 'es', { sensitivity: 'base' });
      })
      .map((item) => item.title)
      .slice(0, 5);
  }, [hasTypedQuery, mixedResults, normalizedTypedQuery, searchHistory]);

  function toggleType(type: Exclude<SearchType, 'all'>) {
    setSelectedType((prev) => (prev === type ? 'all' : type));
  }

  function mediaIcon(type: MixedResult['mediaType']) {
    if (type === 'movie') return 'movie';
    if (type === 'tv') return 'tv';
    return 'sports-esports';
  }

  function mediaRoute(item: MixedResult) {
    if (item.mediaType === 'movie') return `/movie/${item.id}` as const;
    if (item.mediaType === 'tv') return `/tv/${item.id}` as const;
    return `/game/${item.id}` as const;
  }

  const palette = {
    background: isDark ? '#0B1220' : '#F8FAFC',
    panel: isDark ? '#111827' : '#FFFFFF',
    panelBorder: isDark ? '#1F2937' : '#E2E8F0',
    text: isDark ? '#E5E7EB' : '#0F172A',
    subtext: isDark ? '#94A3B8' : '#475569',
    inputBg: isDark ? '#0F172A' : '#FFFFFF',
    inputBorder: isDark ? '#334155' : '#CBD5E1',
    chipBg: isDark ? '#111827' : '#FFFFFF',
    chipBorder: isDark ? '#334155' : '#CBD5E1',
    clearBg: isDark ? '#1F2937' : '#E2E8F0',
    clearIcon: isDark ? '#CBD5E1' : '#334155',
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]}> 
      <View style={[styles.header, { backgroundColor: palette.background }, isWeb && styles.headerWeb]}> 
        <Text style={[styles.title, { color: palette.text }]}>Buscar</Text>
        <View style={styles.inputWrap}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Ej: señor de los anillos, zelda, dark..."
            placeholderTextColor={palette.subtext}
            style={[
              styles.input,
              {
                color: palette.text,
                backgroundColor: palette.inputBg,
                borderColor: palette.inputBorder,
              },
            ]}
            autoCorrect={false}
            autoCapitalize="none"
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
            onSubmitEditing={() => void saveSearchTerm(query)}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} style={styles.clearButton}>
              <View style={[styles.clearButtonInner, { backgroundColor: palette.clearBg }]}>
                <MaterialIcons name="close" size={16} color={palette.clearIcon} />
              </View>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.filtersRow}>
          <TouchableOpacity
            onPress={() => toggleType('movie')}
            style={[
              styles.filterChip,
              {
                backgroundColor: palette.chipBg,
                borderColor: palette.chipBorder,
              },
              selectedType === 'movie' && styles.filterChipActive,
            ]}
          >
            <MaterialIcons
              name="movie"
              size={16}
              color={selectedType === 'movie' ? '#FFFFFF' : palette.subtext}
            />
            <Text style={[styles.filterText, { color: selectedType === 'movie' ? '#FFFFFF' : palette.subtext }]}>Películas</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => toggleType('tv')}
            style={[
              styles.filterChip,
              {
                backgroundColor: palette.chipBg,
                borderColor: palette.chipBorder,
              },
              selectedType === 'tv' && styles.filterChipActive,
            ]}
          >
            <MaterialIcons
              name="tv"
              size={16}
              color={selectedType === 'tv' ? '#FFFFFF' : palette.subtext}
            />
            <Text style={[styles.filterText, { color: selectedType === 'tv' ? '#FFFFFF' : palette.subtext }]}>Series</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => toggleType('game')}
            style={[
              styles.filterChip,
              {
                backgroundColor: palette.chipBg,
                borderColor: palette.chipBorder,
              },
              selectedType === 'game' && styles.filterChipActive,
            ]}
          >
            <MaterialIcons
              name="sports-esports"
              size={16}
              color={selectedType === 'game' ? '#FFFFFF' : palette.subtext}
            />
            <Text style={[styles.filterText, { color: selectedType === 'game' ? '#FFFFFF' : palette.subtext }]}>Juegos</Text>
          </TouchableOpacity>
        </View>
      </View>

      {!hasTypedQuery ? (
        <ScrollView contentContainerStyle={[styles.content, isWeb && styles.contentWeb]} keyboardShouldPersistTaps="handled">
          {isInputFocused && searchHistory.length > 0 ? (
            <View style={[styles.suggestBlock, { backgroundColor: palette.panel, borderColor: palette.panelBorder }]}>
              <Text style={[styles.suggestTitle, { color: palette.text }]}>Últimas búsquedas</Text>
              {searchHistory.map((term) => (
                <TouchableOpacity
                  key={term}
                  style={styles.suggestRow}
                  onPress={() => applySuggestedQuery(term)}
                >
                  <MaterialIcons name="history" size={16} color={palette.subtext} />
                  <Text style={[styles.suggestText, { color: palette.text }]}>{term}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          <View style={styles.centered}>
            <Text style={[styles.helperText, { color: palette.text }]}>Escribe para buscar todo el catálogo.</Text>
            <Text style={[styles.helperSubtext, { color: palette.subtext }]}>Si marcas un tipo arriba, filtramos solo por ese tipo.</Text>
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, isWeb && styles.contentWeb]}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          {completionSuggestions.length > 0 && (
            <View style={[styles.suggestBlock, { backgroundColor: palette.panel, borderColor: palette.panelBorder }]}>
              <Text style={[styles.suggestTitle, { color: palette.text }]}>Sugerencias</Text>
              {completionSuggestions.map((title) => (
                <TouchableOpacity
                  key={title}
                  style={styles.suggestRow}
                  onPress={() => applySuggestedQuery(title)}
                >
                  <MaterialIcons name="search" size={16} color={palette.subtext} />
                  <Text style={[styles.suggestText, { color: palette.text }]}>{title}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {isLoading && (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#0E7490" />
              <Text style={[styles.loadingText, { color: palette.text }]}>Buscando...</Text>
            </View>
          )}

          {mixedResults.map((item) => (
            <TouchableOpacity
              key={`${item.mediaType}-${item.id}`}
              style={[styles.item, { backgroundColor: palette.panel, borderColor: palette.panelBorder }]}
              activeOpacity={0.75}
              onPress={() => {
                void saveSearchTerm(query || item.title);
                router.push(mediaRoute(item));
              }}
            >
              <Image
                source={item.imageUrl ? { uri: item.imageUrl } : FALLBACK_IMAGE}
                style={styles.poster}
                resizeMode="cover"
              />
              <View style={styles.itemTextWrap}>
                <Text style={[styles.itemTitle, { color: palette.text }]}>{item.title}</Text>
                <View style={styles.metaRow}>
                  <View style={styles.typeBadge}>
                    <MaterialIcons name={mediaIcon(item.mediaType)} size={12} color="#0E7490" />
                  </View>
                  <Text style={[styles.itemMeta, { color: palette.subtext }]}> 
                    {item.rating ? `★ ${item.rating.toFixed(1)}` : 'Sin rating'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}

          {noResults && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No encontramos resultados</Text>
              <Text style={styles.emptySubtitle}>Prueba con otra palabra o quitando el filtro.</Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerWeb: {
    width: '100%',
    maxWidth: 1160,
    alignSelf: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingRight: 40,
    fontSize: 16,
  },
  inputWrap: {
    position: 'relative',
  },
  filtersRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  filterChipActive: {
    backgroundColor: '#0E7490',
    borderColor: '#0E7490',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
  },
  clearButton: {
    position: 'absolute',
    right: 8,
    top: '50%',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateY: -12 }],
  },
  clearButtonInner: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  helperText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  helperSubtext: {
    marginTop: 8,
    fontSize: 14,
    textAlign: 'center',
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  contentWeb: {
    width: '100%',
    maxWidth: 1160,
    alignSelf: 'center',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
  },
  suggestBlock: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  suggestTitle: {
    fontSize: 13,
    fontWeight: '800',
    paddingHorizontal: 10,
    paddingBottom: 4,
  },
  suggestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  suggestText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 8,
    marginBottom: 8,
    borderWidth: 1,
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
  },
  metaRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFEFF',
    borderWidth: 1,
    borderColor: '#67E8F9',
  },
  itemMeta: {
    fontSize: 12,
  },
  webWarning: {
    fontSize: 13,
    color: '#991B1B',
    marginBottom: 8,
  },
  emptyState: {
    marginTop: 18,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#312E81',
  },
  emptySubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#4338CA',
  },
});

export default SearchScreen;
