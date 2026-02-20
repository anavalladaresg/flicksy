import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
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
import MagicLoader from '@/components/loaders/MagicLoader';
import { Fonts } from '@/constants/theme';
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

const RECENT_SCROLL_MIN_OFFSET = 80;
const RECENT_SCROLL_MAX_AGE_MS = 1000 * 60 * 20;

const browseScrollMemory: Partial<Record<BrowseType, { offsetY: number; savedAt: number }>> = {};

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
  const isDark = useColorScheme() === 'dark';
  const isWeb = Platform.OS === 'web';
  const RootContainer = isWeb ? View : SafeAreaView;
  const entranceAnim = useState(new Animated.Value(0))[0];
  const auraAnim = useRef(new Animated.Value(0)).current;
  const [hoveredItemId, setHoveredItemId] = useState<number | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);
  const lastScrollOffsetRef = useRef(0);
  const [recentScrollOffset, setRecentScrollOffset] = useState<number | null>(null);

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
    const snapshot = browseScrollMemory[type];
    if (!snapshot) {
      setRecentScrollOffset(null);
      return;
    }
    const age = Date.now() - snapshot.savedAt;
    if (age > RECENT_SCROLL_MAX_AGE_MS || snapshot.offsetY < RECENT_SCROLL_MIN_OFFSET) {
      setRecentScrollOffset(null);
      return;
    }
    setRecentScrollOffset(snapshot.offsetY);
  }, [type]);

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

  useEffect(() => {
    Animated.timing(entranceAnim, {
      toValue: 1,
      duration: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [entranceAnim]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(auraAnim, {
          toValue: 1,
          duration: 4600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(auraAnim, {
          toValue: 0,
          duration: 4600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [auraAnim]);

  useEffect(() => {
    return () => {
      const currentOffset = lastScrollOffsetRef.current;
      if (currentOffset < RECENT_SCROLL_MIN_OFFSET) {
        delete browseScrollMemory[type];
        return;
      }
      browseScrollMemory[type] = {
        offsetY: currentOffset,
        savedAt: Date.now(),
      };
    };
  }, [type]);

  const title = type === 'movie' ? 'Películas' : type === 'tv' ? 'Series' : 'Videojuegos';
  const hasMore = activeQuery.data ? page < activeQuery.data.totalPages : false;

  const sortOptions = useMemo(() => {
    return type === 'movie' ? MOVIE_SORTS : type === 'tv' ? TV_SORTS : GAME_SORTS;
  }, [type]);

  function restoreRecentPosition() {
    if (recentScrollOffset == null) return;
    const targetOffset = Math.max(0, recentScrollOffset);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: targetOffset, animated: true });
      setTimeout(() => scrollRef.current?.scrollTo({ y: targetOffset, animated: true }), 150);
    });
    setRecentScrollOffset(null);
  }

  return (
    <RootContainer style={[styles.container, { backgroundColor: isDark ? '#0B1220' : '#F8FAFC' }]}>
      {isWeb ? (
        <>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.webAura,
              styles.webAuraA,
              {
                opacity: isDark ? 0.24 : 0.42,
                transform: [
                  {
                    translateY: auraAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-12, 12],
                    }),
                  },
                ],
              },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.webAura,
              styles.webAuraB,
              {
                opacity: isDark ? 0.2 : 0.26,
                transform: [
                  {
                    translateY: auraAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [10, -10],
                    }),
                  },
                ],
              },
            ]}
          />
        </>
      ) : null}

      <Animated.View
        style={[
          styles.topSection,
          isWeb && styles.topSectionWeb,
          {
            opacity: entranceAnim,
            transform: [
              {
                translateY: entranceAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [16, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View
          style={[
            styles.header,
            isWeb && {
              borderColor: isDark ? 'rgba(71,85,105,0.45)' : 'rgba(125,211,252,0.25)',
              backgroundColor: isDark ? 'rgba(15,23,42,0.72)' : 'rgba(255,255,255,0.6)',
              boxShadow: isDark ? '0 14px 28px rgba(2,6,23,0.36)' : '0 14px 28px rgba(2,6,23,0.12)',
            },
          ]}
        >
          <TouchableOpacity style={[styles.backButton, isDark && styles.backButtonDark]} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={18} color={isDark ? '#E5E7EB' : '#0F172A'} />
            <Text style={[styles.backButtonText, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>Volver</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>{title}</Text>
        </View>
      </Animated.View>

      <Animated.ScrollView
        ref={scrollRef as any}
        style={{ opacity: entranceAnim }}
        contentContainerStyle={[styles.content, isWeb && styles.contentWeb]}
        onScroll={(event) => {
          lastScrollOffsetRef.current = event.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
      >
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
                style={[styles.sortChip, isDark && styles.sortChipDark, isActive && styles.sortChipActive]}
                onPress={() => {
                  if (type === 'movie') setMovieSort(option.value as MovieSortOption);
                  if (type === 'tv') setTVSort(option.value as TVSortOption);
                  if (type === 'game') setGameSort(option.value as GameSortOption);
                }}
              >
                <Text style={[styles.sortChipText, { color: isDark ? '#CBD5E1' : '#334155' }, isActive && styles.sortChipTextActive]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {activeQuery.isLoading && page === 1 ? (
          <View style={styles.centeredInline}>
            <MagicLoader size={26} color="#0E7490" secondaryColor="#A5F3FC" />
          </View>
        ) : activeQuery.isError ? (
          <Text style={styles.errorLine}>No se pudo cargar el listado.</Text>
        ) : (
          <>
            {items.map((item, index) => {
              const start = Math.min(index * 0.05, 0.62);
              const end = Math.min(start + 0.26, 1);
              return (
                <Animated.View
                  key={item.id}
                  style={{
                    opacity: entranceAnim.interpolate({
                      inputRange: [start, end],
                      outputRange: [0, 1],
                      extrapolate: 'clamp',
                    }),
                    transform: [
                      {
                        translateY: entranceAnim.interpolate({
                          inputRange: [start, end],
                          outputRange: [14, 0],
                          extrapolate: 'clamp',
                        }),
                      },
                    ],
                  }}
                >
                  <TouchableOpacity
                    style={[
                      styles.item,
                      isDark && styles.itemDark,
                    ]}
                    activeOpacity={0.75}
                    onPress={() => router.push(`/${type}/${item.id}`)}
                    {...(isWeb
                      ? {
                          onMouseEnter: () => setHoveredItemId(item.id),
                          onMouseLeave: () => setHoveredItemId(null),
                        }
                      : {})}
                  >
                    <View style={[styles.posterFrame, isWeb && hoveredItemId === item.id && styles.posterFrameHovered]}>
                      <Image
                        source={item.imageUrl ? { uri: item.imageUrl } : FALLBACK_IMAGE}
                        style={styles.poster}
                        resizeMode="cover"
                      />
                    </View>
                    <View style={styles.itemTextWrap}>
                      <Text style={[styles.itemTitle, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>{item.name}</Text>
                      <Text style={[styles.itemMeta, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                        {item.rating ? `⭐ ${item.rating.toFixed(1)}` : 'Sin rating'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              );
            })}

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
      </Animated.ScrollView>
      {recentScrollOffset != null ? (
        <TouchableOpacity
          style={[styles.recentButton, isDark && styles.recentButtonDark]}
          onPress={restoreRecentPosition}
          activeOpacity={0.88}
        >
          <MaterialIcons name="history" size={14} color="#FFFFFF" />
          <Text style={styles.recentButtonText}>Visto justo ahora</Text>
        </TouchableOpacity>
      ) : null}
    </RootContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    position: 'relative',
    overflow: 'hidden',
  },
  webAura: {
    position: 'absolute',
    width: 420,
    height: 420,
    borderRadius: 999,
    zIndex: 0,
    filter: 'blur(56px)' as any,
  },
  webAuraA: {
    top: -160,
    right: -130,
    backgroundColor: 'rgba(56,189,248,0.42)',
  },
  webAuraB: {
    bottom: -190,
    left: -150,
    backgroundColor: 'rgba(20,184,166,0.36)',
  },
  topSection: {
    width: '100%',
  },
  topSectionWeb: {
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
    ...(Platform.OS === 'web' && {
      marginTop: 10,
      marginHorizontal: 16,
      borderRadius: 18,
      borderWidth: 1,
      backdropFilter: 'blur(14px)' as any,
    } as any),
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
  backButtonDark: {
    backgroundColor: '#1F2937',
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
    ...(Platform.OS === 'web' && {
      fontFamily: Fonts.web?.serif || "Georgia, 'Times New Roman', serif",
      letterSpacing: 0.2,
    }),
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    paddingTop: 10,
  },
  contentWeb: {
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center',
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
  sortChipDark: {
    borderColor: '#334155',
    backgroundColor: '#0F172A',
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
    ...(Platform.OS === 'web' && {
      boxShadow: '0 12px 24px rgba(2,6,23,0.08)',
      transitionDuration: '460ms',
      transitionProperty: 'box-shadow',
      transitionTimingFunction: 'cubic-bezier(0.4,0,0.2,1)',
      overflow: 'visible',
      willChange: 'box-shadow',
    } as any),
  },
  itemDark: {
    backgroundColor: '#111827',
    borderColor: '#1F2937',
  },
  poster: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E2E8F0',
    ...(Platform.OS === 'web' && {
      transitionDuration: '240ms',
      transitionProperty: 'box-shadow',
      transitionTimingFunction: 'cubic-bezier(0.22,1,0.36,1)',
    } as any),
  },
  posterFrame: {
    width: 58,
    height: 82,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
  },
  posterFrameHovered: {
    boxShadow: '0 12px 24px rgba(2,6,23,0.28)',
    zIndex: 8,
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
  recentButton: {
    position: 'absolute',
    right: 16,
    bottom: 18,
    zIndex: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(125,211,252,0.55)',
    backgroundColor: '#0E7490',
    paddingHorizontal: 12,
    paddingVertical: 9,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 10px 20px rgba(2,6,23,0.3)',
          transitionDuration: '240ms',
          transitionProperty: 'opacity',
        } as any)
      : null),
  },
  recentButtonDark: {
    borderColor: 'rgba(125,211,252,0.3)',
    backgroundColor: '#0E7490',
  },
  recentButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.15,
  },
});

export { BrowseSectionScreen };
export default BrowseSectionScreen;
