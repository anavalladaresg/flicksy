import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  useWindowDimensions,
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
import { useTrackingStore } from '../store/tracking';
import { Game, Movie, TVShow } from '../types';

type BrowseType = 'movie' | 'tv' | 'game';
type BrowseItem = { id: number; name: string; imageUrl: string | null; rating?: number };
type ViewMode = 'list' | 'gallery';

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

const VIEW_MODE_OPTIONS: { value: ViewMode; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { value: 'list', label: 'Lista', icon: 'view-agenda' },
  { value: 'gallery', label: 'Galería', icon: 'grid-view' },
];

const RECENT_SCROLL_MIN_OFFSET = 80;
const RECENT_SCROLL_MAX_AGE_MS = 1000 * 60 * 20;
const RECENT_SCROLL_DEBUG = false;
const WHEEL_SCROLL_DEBUG = false;

const browseScrollMemory: Partial<
  Record<
    BrowseType,
    {
      offsetY: number;
      savedAt: number;
      anchorItemId?: number | null;
    }
  >
> = {};

function logRecentScroll(type: BrowseType, event: string, payload?: Record<string, unknown>) {
  if (!RECENT_SCROLL_DEBUG) return;
  console.log(`[recent-scroll][${type}][${new Date().toISOString()}] ${event}`, payload ?? {});
}

function logWheelScroll(type: BrowseType, event: string, payload?: Record<string, unknown>) {
  if (!WHEEL_SCROLL_DEBUG) return;
  console.log(`[wheel-scroll][${type}][${new Date().toISOString()}] ${event}`, payload ?? {});
}

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
  const { width: windowWidth } = useWindowDimensions();
  const isWebMobile = isWeb && windowWidth < 860;
  const RootContainer = isWeb ? View : SafeAreaView;
  const entranceAnim = useState(new Animated.Value(0))[0];
  const auraAnim = useRef(new Animated.Value(0)).current;
  const [hoveredItemId, setHoveredItemId] = useState<number | null>(null);
  const [hoveredLibraryKey, setHoveredLibraryKey] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);
  const lastScrollOffsetRef = useRef(0);
  const smoothScrollFrameRef = useRef<number | null>(null);
  const smoothScrollStartAtRef = useRef<number | null>(null);
  const wheelSmoothFrameRef = useRef<number | null>(null);
  const wheelVelocityRef = useRef(0);
  const wheelViewportHeightRef = useRef(0);
  const wheelContentHeightRef = useRef(0);
  const itemLayoutsRef = useRef<Map<number, { y: number; height: number }>>(new Map());
  const lastAnchorItemIdRef = useRef<number | null>(null);
  const pendingRestoreStartedAtRef = useRef<number | null>(null);
  const restoreRetryCountRef = useRef(0);
  const [recentSnapshot, setRecentSnapshot] = useState<{ offsetY: number; anchorItemId?: number | null } | null>(null);
  const [pendingRestoreItemId, setPendingRestoreItemId] = useState<number | null>(null);
  const [restoreRetryTick, setRestoreRetryTick] = useState(0);

  const [movieSort, setMovieSort] = useState<MovieSortOption>('popularity.desc');
  const [tvSort, setTVSort] = useState<TVSortOption>('popularity.desc');
  const [gameSort, setGameSort] = useState<GameSortOption>('rating_count.desc');
  const [viewMode, setViewMode] = useState<ViewMode>('gallery');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<BrowseItem[]>([]);
  const ownLibraryItems = useTrackingStore((state) => state.items);
  const ownLibraryKeys = useMemo(
    () => new Set(ownLibraryItems.map((item) => `${item.mediaType}-${item.externalId}`)),
    [ownLibraryItems]
  );

  const currentSort = type === 'movie' ? movieSort : type === 'tv' ? tvSort : gameSort;

  const movieQuery = useMoviesBySort(movieSort, page, type === 'movie');
  const tvQuery = useTVShowsBySort(tvSort, page, type === 'tv');
  const gameQuery = useGamesBySort(gameSort, page, type === 'game');

  const activeQuery = type === 'movie' ? movieQuery : type === 'tv' ? tvQuery : gameQuery;

  useEffect(() => {
    setPage(1);
    setItems([]);
    itemLayoutsRef.current.clear();
    setPendingRestoreItemId(null);
    pendingRestoreStartedAtRef.current = null;
    restoreRetryCountRef.current = 0;
    logRecentScroll(type, 'reset-on-type-or-sort-change', { currentSort });
  }, [type, currentSort]);

  useEffect(() => {
    const snapshot = browseScrollMemory[type];
    if (!snapshot) {
      setRecentSnapshot(null);
      logRecentScroll(type, 'snapshot-not-found');
      return;
    }
    const age = Date.now() - snapshot.savedAt;
    if (age > RECENT_SCROLL_MAX_AGE_MS || snapshot.offsetY < RECENT_SCROLL_MIN_OFFSET) {
      setRecentSnapshot(null);
      logRecentScroll(type, 'snapshot-discarded', {
        ageMs: age,
        offsetY: snapshot.offsetY,
        anchorItemId: snapshot.anchorItemId ?? null,
      });
      return;
    }
    setRecentSnapshot({ offsetY: snapshot.offsetY, anchorItemId: snapshot.anchorItemId ?? null });
    logRecentScroll(type, 'snapshot-restored', {
      ageMs: age,
      offsetY: snapshot.offsetY,
      anchorItemId: snapshot.anchorItemId ?? null,
    });
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

  function stopSmoothScroll() {
    if (smoothScrollFrameRef.current != null) {
      cancelAnimationFrame(smoothScrollFrameRef.current);
      smoothScrollFrameRef.current = null;
    }
    if (wheelSmoothFrameRef.current != null) {
      cancelAnimationFrame(wheelSmoothFrameRef.current);
      wheelSmoothFrameRef.current = null;
    }
    wheelVelocityRef.current = 0;
    smoothScrollStartAtRef.current = null;
  }

  useEffect(() => {
    return () => stopSmoothScroll();
  }, []);

  useEffect(() => {
    return () => {
      const currentOffset = lastScrollOffsetRef.current;
      if (currentOffset < RECENT_SCROLL_MIN_OFFSET) {
        delete browseScrollMemory[type];
        logRecentScroll(type, 'snapshot-cleared-on-unmount', {
          currentOffset,
          reason: 'offset-below-min',
        });
        return;
      }
      browseScrollMemory[type] = {
        offsetY: currentOffset,
        savedAt: Date.now(),
        anchorItemId: lastAnchorItemIdRef.current,
      };
      logRecentScroll(type, 'snapshot-saved-on-unmount', {
        offsetY: currentOffset,
        anchorItemId: lastAnchorItemIdRef.current,
      });
    };
  }, [type]);

  const title = type === 'movie' ? 'Películas' : type === 'tv' ? 'Series' : 'Videojuegos';
  const hasMore = activeQuery.data ? page < activeQuery.data.totalPages : false;
  const loadedItemIds = useMemo(() => new Set(items.map((item) => item.id)), [items]);

  const sortOptions = useMemo(() => {
    return type === 'movie' ? MOVIE_SORTS : type === 'tv' ? TV_SORTS : GAME_SORTS;
  }, [type]);

  const activeView = VIEW_MODE_OPTIONS.find((option) => option.value === viewMode) ?? VIEW_MODE_OPTIONS[0];

  function cycleViewMode() {
    const index = VIEW_MODE_OPTIONS.findIndex((option) => option.value === viewMode);
    const next = VIEW_MODE_OPTIONS[(index + 1) % VIEW_MODE_OPTIONS.length];
    setViewMode(next.value);
  }

  const getWheelMaxOffset = useCallback(() => {
    return Math.max(0, wheelContentHeightRef.current - wheelViewportHeightRef.current);
  }, []);

  const runWheelSmoothStep = useCallback(() => {
    let velocity = wheelVelocityRef.current;
    if (Math.abs(velocity) < 0.08) {
      wheelVelocityRef.current = 0;
      wheelSmoothFrameRef.current = null;
      return;
    }

    const maxOffset = getWheelMaxOffset();
    const current = lastScrollOffsetRef.current;
    let nextOffset = current + velocity;

    if (nextOffset < 0) {
      nextOffset = 0;
      velocity *= 0.32;
    } else if (nextOffset > maxOffset) {
      nextOffset = maxOffset;
      velocity *= 0.32;
    }

    velocity *= 0.88;
    if (Math.abs(velocity) < 0.08) velocity = 0;
    wheelVelocityRef.current = velocity;

    if (Math.abs(nextOffset - current) > 0.01) {
      scrollRef.current?.scrollTo({ y: nextOffset, animated: false });
      lastScrollOffsetRef.current = nextOffset;
    }

    wheelSmoothFrameRef.current = requestAnimationFrame(runWheelSmoothStep);
  }, [getWheelMaxOffset]);

  const handleWheelSmoothScroll = useCallback(
    (event: any) => {
      if (!isWeb) return;
      const deltaY = Number(event?.deltaY ?? event?.nativeEvent?.deltaY ?? 0);
      if (!Number.isFinite(deltaY) || deltaY === 0) return;
      const cancelable = Boolean(event?.nativeEvent?.cancelable ?? event?.cancelable);
      if (cancelable) event.preventDefault?.();

      // Stop any active programmatic jump and continue with an inertial wheel motion.
      if (smoothScrollFrameRef.current != null) {
        cancelAnimationFrame(smoothScrollFrameRef.current);
        smoothScrollFrameRef.current = null;
      }
      smoothScrollStartAtRef.current = null;

      const normalizedDelta = Math.max(-120, Math.min(120, deltaY));
      const impulse = normalizedDelta * 0.09;
      wheelVelocityRef.current = Math.max(-52, Math.min(52, wheelVelocityRef.current + impulse));

      if (wheelSmoothFrameRef.current == null) {
        wheelSmoothFrameRef.current = requestAnimationFrame(runWheelSmoothStep);
      }
    },
    [isWeb, runWheelSmoothStep]
  );

  function easeInOutCubic(value: number) {
    if (value < 0.5) return 4 * value * value * value;
    return 1 - Math.pow(-2 * value + 2, 3) / 2;
  }

  const smoothScrollToOffset = useCallback(
    (offsetY: number, reason = 'unknown') => {
      const targetOffset = Math.max(0, offsetY);
      const startOffset = lastScrollOffsetRef.current;
      const distance = Math.abs(targetOffset - startOffset);

      stopSmoothScroll();

      if (distance < 10) {
        scrollRef.current?.scrollTo({ y: targetOffset, animated: false });
        lastScrollOffsetRef.current = targetOffset;
        logRecentScroll(type, 'smooth-scroll-skip-short-distance', {
          reason,
          targetOffset,
          startOffset,
          distance,
        });
        return;
      }

      const durationMs = Math.max(420, Math.min(1300, 420 + distance * 0.065));
      logRecentScroll(type, 'smooth-scroll-start', {
        reason,
        startOffset,
        targetOffset,
        distance,
        durationMs,
      });

      smoothScrollStartAtRef.current = Date.now();
      const step = () => {
        if (smoothScrollStartAtRef.current == null) return;
        const elapsed = Date.now() - smoothScrollStartAtRef.current;
        const progress = Math.min(1, elapsed / durationMs);
        const eased = easeInOutCubic(progress);
        const nextOffset = startOffset + (targetOffset - startOffset) * eased;
        scrollRef.current?.scrollTo({ y: nextOffset, animated: false });
        lastScrollOffsetRef.current = nextOffset;
        if (progress < 1) {
          smoothScrollFrameRef.current = requestAnimationFrame(step);
          return;
        }
        smoothScrollFrameRef.current = null;
        smoothScrollStartAtRef.current = null;
        logRecentScroll(type, 'smooth-scroll-end', {
          reason,
          targetOffset,
          elapsedMs: elapsed,
        });
      };

      smoothScrollFrameRef.current = requestAnimationFrame(step);
    },
    [type]
  );

  function resolveAnchorItemId(offsetY: number): number | null {
    const layouts = Array.from(itemLayoutsRef.current.entries());
    if (layouts.length === 0) return null;
    const targetY = offsetY + 24;
    let bestBefore: { id: number; y: number } | null = null;
    for (const [id, layout] of layouts) {
      if (layout.y <= targetY && (!bestBefore || layout.y > bestBefore.y)) {
        bestBefore = { id, y: layout.y };
      }
    }
    if (bestBefore) return bestBefore.id;
    let nearest: { id: number; dist: number } | null = null;
    for (const [id, layout] of layouts) {
      const dist = Math.abs(layout.y - targetY);
      if (!nearest || dist < nearest.dist) nearest = { id, dist };
    }
    return nearest?.id ?? null;
  }

  const scrollToStoredOffset = useCallback(
    (offsetY: number, reason = 'unknown') => {
      const targetOffset = Math.max(0, offsetY);
      logRecentScroll(type, 'scroll-to-offset', { reason, requestedOffsetY: offsetY, targetOffset });
      smoothScrollToOffset(targetOffset, reason);
    },
    [smoothScrollToOffset, type]
  );

  const tryScrollToAnchor = useCallback(
    (anchorItemId: number, reason = 'unknown'): boolean => {
      const layout = itemLayoutsRef.current.get(anchorItemId);
      if (!layout) {
        logRecentScroll(type, 'anchor-layout-missing', {
          reason,
          anchorItemId,
          loadedItems: items.length,
        });
        return false;
      }
      const targetY = Math.max(0, layout.y - 8);
      smoothScrollToOffset(targetY, `${reason}-anchor`);
      logRecentScroll(type, 'anchor-scroll-success', {
        reason,
        anchorItemId,
        y: layout.y,
        height: layout.height,
        targetY,
      });
      return true;
    },
    [items.length, smoothScrollToOffset, type]
  );

  useEffect(() => {
    if (pendingRestoreItemId == null) return;

    if (pendingRestoreStartedAtRef.current == null) {
      pendingRestoreStartedAtRef.current = Date.now();
      logRecentScroll(type, 'restore-started', {
        pendingRestoreItemId,
        snapshotOffsetY: recentSnapshot?.offsetY ?? null,
        snapshotAnchorItemId: recentSnapshot?.anchorItemId ?? null,
        loadedItems: items.length,
      });
    }

    if (pendingRestoreStartedAtRef.current && Date.now() - pendingRestoreStartedAtRef.current > 10000) {
      logRecentScroll(type, 'restore-timeout-fallback', {
        pendingRestoreItemId,
        elapsedMs: Date.now() - pendingRestoreStartedAtRef.current,
        retries: restoreRetryCountRef.current,
      });
      if (recentSnapshot) scrollToStoredOffset(recentSnapshot.offsetY, 'timeout-fallback');
      setPendingRestoreItemId(null);
      setRecentSnapshot(null);
      pendingRestoreStartedAtRef.current = null;
      restoreRetryCountRef.current = 0;
      return;
    }

    if (tryScrollToAnchor(pendingRestoreItemId, 'effect-immediate-check')) {
      setPendingRestoreItemId(null);
      setRecentSnapshot(null);
      pendingRestoreStartedAtRef.current = null;
      restoreRetryCountRef.current = 0;
      return;
    }

    if (!loadedItemIds.has(pendingRestoreItemId)) {
      if (hasMore && !activeQuery.isFetching) {
        logRecentScroll(type, 'restore-anchor-not-loaded-load-next-page', {
          pendingRestoreItemId,
          currentPage: page,
          nextPage: page + 1,
          loadedItems: items.length,
        });
        setPage((prev) => prev + 1);
      } else if (!hasMore && !activeQuery.isFetching && recentSnapshot) {
        logRecentScroll(type, 'restore-anchor-not-found-no-more-pages', {
          pendingRestoreItemId,
          loadedItems: items.length,
          retries: restoreRetryCountRef.current,
        });
        scrollToStoredOffset(recentSnapshot.offsetY, 'anchor-not-found-no-more-pages');
        setPendingRestoreItemId(null);
        setRecentSnapshot(null);
        pendingRestoreStartedAtRef.current = null;
        restoreRetryCountRef.current = 0;
      }
      return;
    }

    if (restoreRetryCountRef.current >= 45) {
      logRecentScroll(type, 'restore-max-retries-fallback', {
        pendingRestoreItemId,
        retries: restoreRetryCountRef.current,
      });
      if (recentSnapshot) scrollToStoredOffset(recentSnapshot.offsetY, 'max-retries-fallback');
      setPendingRestoreItemId(null);
      setRecentSnapshot(null);
      pendingRestoreStartedAtRef.current = null;
      restoreRetryCountRef.current = 0;
      return;
    }

    restoreRetryCountRef.current += 1;
    logRecentScroll(type, 'restore-retry-scheduled', {
      pendingRestoreItemId,
      retryCount: restoreRetryCountRef.current,
      loadedItems: items.length,
      isFetching: activeQuery.isFetching,
    });
    const timer = setTimeout(() => {
      if (tryScrollToAnchor(pendingRestoreItemId, 'retry-timer')) {
        setPendingRestoreItemId(null);
        setRecentSnapshot(null);
        pendingRestoreStartedAtRef.current = null;
        restoreRetryCountRef.current = 0;
      } else {
        logRecentScroll(type, 'restore-retry-failed', {
          pendingRestoreItemId,
          retryCount: restoreRetryCountRef.current,
        });
        setRestoreRetryTick((prev) => prev + 1);
      }
    }, 85);
    return () => clearTimeout(timer);
  }, [
    activeQuery.isFetching,
    hasMore,
    loadedItemIds,
    pendingRestoreItemId,
    recentSnapshot,
    restoreRetryTick,
    items.length,
    page,
    scrollToStoredOffset,
    tryScrollToAnchor,
    type,
  ]);

  function restoreRecentPosition() {
    if (!recentSnapshot) return;
    logRecentScroll(type, 'restore-button-pressed', {
      snapshotOffsetY: recentSnapshot.offsetY,
      snapshotAnchorItemId: recentSnapshot.anchorItemId ?? null,
      loadedItems: items.length,
      currentPage: page,
    });
    const anchorItemId = recentSnapshot.anchorItemId ?? null;
    if (anchorItemId != null) {
      if (tryScrollToAnchor(anchorItemId, 'button-direct-anchor-restore')) {
        setRecentSnapshot(null);
        pendingRestoreStartedAtRef.current = null;
        restoreRetryCountRef.current = 0;
        return;
      }
      pendingRestoreStartedAtRef.current = Date.now();
      restoreRetryCountRef.current = 0;
      setPendingRestoreItemId(anchorItemId);
      return;
    }
    scrollToStoredOffset(recentSnapshot.offsetY, 'button-offset-restore');
    setRecentSnapshot(null);
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
        onLayout={(event) => {
          wheelViewportHeightRef.current = event.nativeEvent.layout.height ?? 0;
          logWheelScroll(type, 'viewport-layout', {
            viewportHeight: Number(wheelViewportHeightRef.current.toFixed(2)),
          });
        }}
        onContentSizeChange={(_, contentHeight) => {
          wheelContentHeightRef.current = contentHeight ?? 0;
          logWheelScroll(type, 'content-size-change', {
            contentHeight: Number(wheelContentHeightRef.current.toFixed(2)),
            maxOffset: Number(getWheelMaxOffset().toFixed(2)),
          });
        }}
        onScrollBeginDrag={() => {
          stopSmoothScroll();
          logRecentScroll(type, 'smooth-scroll-cancelled-by-user-drag');
          logWheelScroll(type, 'wheel-cancelled-by-drag', {
            currentOffset: Number(lastScrollOffsetRef.current.toFixed(2)),
          });
        }}
        onScroll={(event) => {
          const offsetY = event.nativeEvent.contentOffset.y;
          lastScrollOffsetRef.current = offsetY;
          lastAnchorItemIdRef.current = resolveAnchorItemId(offsetY);
        }}
        scrollEventThrottle={16}
        {...(isWeb
          ? ({
              onWheel: handleWheelSmoothScroll,
            } as any)
          : null)}
      >
        <View style={styles.controlsRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.sortScroll}
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
          <TouchableOpacity style={[styles.viewModeButton, isDark && styles.viewModeButtonDark]} onPress={cycleViewMode}>
            <MaterialIcons name={activeView.icon} size={14} color={isDark ? '#E5E7EB' : '#0F172A'} />
            <Text style={[styles.viewModeText, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>{activeView.label}</Text>
          </TouchableOpacity>
        </View>

        {activeQuery.isLoading && page === 1 ? (
          <View style={styles.centeredInline}>
            <MagicLoader size={26} color="#0E7490" secondaryColor="#A5F3FC" />
          </View>
        ) : activeQuery.isError ? (
          <Text style={styles.errorLine}>No se pudo cargar el listado.</Text>
        ) : (
          <>
            {viewMode === 'gallery' ? (
              <View style={styles.galleryGrid}>
                {items.map((item, index) => {
                  const itemKey = `${type}-${item.id}`;
                  const isInOwnLibrary = ownLibraryKeys.has(itemKey);
                  const start = Math.min(index * 0.05, 0.62);
                  const end = Math.min(start + 0.26, 1);
                  return (
                    <Animated.View
                      key={item.id}
                      style={[
                        styles.galleryItemWrap,
                        isWebMobile && styles.galleryItemWrapWebMobile,
                        {
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
                        },
                      ]}
                      onLayout={(event) => {
                        const { y, height } = event.nativeEvent.layout;
                        const previous = itemLayoutsRef.current.get(item.id);
                        itemLayoutsRef.current.set(item.id, { y, height });
                        if (
                          pendingRestoreItemId != null &&
                          item.id === pendingRestoreItemId &&
                          (!previous || previous.y !== y || previous.height !== height)
                        ) {
                          setRestoreRetryTick((prev) => prev + 1);
                        }
                      }}
                    >
                      <TouchableOpacity
                        style={[
                          styles.galleryCard,
                          isWebMobile && styles.galleryCardWebMobile,
                          isDark && styles.galleryCardDark,
                        ]}
                        activeOpacity={0.8}
                        onPress={() => router.push(`/${type}/${item.id}`)}
                        {...(isWeb
                          ? {
                              onMouseEnter: () => setHoveredLibraryKey(itemKey),
                              onMouseLeave: () => setHoveredLibraryKey((prev) => (prev === itemKey ? null : prev)),
                            }
                          : {})}
                      >
                        {isInOwnLibrary ? (
                          <View style={styles.inLibraryBadgeWrap}>
                            <View style={styles.inLibraryBadge}>
                              <MaterialIcons name="library-add-check" size={14} color="#E0F2FE" />
                            </View>
                            {isWeb && hoveredLibraryKey === itemKey ? (
                              <View style={styles.iconTooltip}>
                                <Text numberOfLines={1} style={styles.iconTooltipText}>Ya añadido</Text>
                              </View>
                            ) : null}
                          </View>
                        ) : null}
                        <Image
                          source={item.imageUrl ? { uri: item.imageUrl } : FALLBACK_IMAGE}
                          style={[styles.galleryPoster, isWebMobile && styles.galleryPosterWebMobile]}
                          resizeMode="cover"
                        />
                        <Text
                          numberOfLines={2}
                          style={[
                            styles.galleryTitle,
                            isWebMobile && styles.galleryTitleWebMobile,
                            { color: isDark ? '#E5E7EB' : '#0F172A' },
                          ]}
                        >
                          {item.name}
                        </Text>
                        <Text style={[styles.galleryMeta, isWebMobile && styles.galleryMetaWebMobile, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                          {item.rating ? `⭐ ${item.rating.toFixed(1)}` : 'Sin rating'}
                        </Text>
                      </TouchableOpacity>
                    </Animated.View>
                  );
                })}
              </View>
            ) : (
              items.map((item, index) => {
                const itemKey = `${type}-${item.id}`;
                const isInOwnLibrary = ownLibraryKeys.has(itemKey);
                const start = Math.min(index * 0.05, 0.62);
                const end = Math.min(start + 0.26, 1);
                return (
                  <Animated.View
                    key={item.id}
                    onLayout={(event) => {
                      const { y, height } = event.nativeEvent.layout;
                      const previous = itemLayoutsRef.current.get(item.id);
                      itemLayoutsRef.current.set(item.id, { y, height });
                      if (
                        pendingRestoreItemId != null &&
                        item.id === pendingRestoreItemId &&
                        (!previous || previous.y !== y || previous.height !== height)
                      ) {
                        logRecentScroll(type, 'pending-anchor-layout-updated', {
                          pendingRestoreItemId,
                          itemId: item.id,
                          y,
                          height,
                        });
                        setRestoreRetryTick((prev) => prev + 1);
                      }
                    }}
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
                            onMouseLeave: () => {
                              setHoveredItemId(null);
                              setHoveredLibraryKey(null);
                            },
                          }
                        : {})}
                    >
                      {isInOwnLibrary ? (
                        <View
                          style={styles.inLibraryBadgeWrap}
                          {...(isWeb
                            ? {
                                onMouseEnter: () => setHoveredLibraryKey(itemKey),
                                onMouseLeave: () =>
                                  setHoveredLibraryKey((prev) => (prev === itemKey ? null : prev)),
                              }
                            : {})}
                        >
                          <View style={styles.inLibraryBadge}>
                            <MaterialIcons name="library-add-check" size={14} color="#E0F2FE" />
                          </View>
                          {isWeb && hoveredLibraryKey === itemKey ? (
                            <View style={styles.iconTooltip}>
                              <Text numberOfLines={1} style={styles.iconTooltipText}>Ya añadido</Text>
                            </View>
                          ) : null}
                        </View>
                      ) : null}
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
              })
            )}

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
      {recentSnapshot != null ? (
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
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  viewModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  viewModeButtonDark: {
    borderColor: '#334155',
    backgroundColor: '#0F172A',
  },
  viewModeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  sortChips: {
    paddingVertical: 10,
    gap: 8,
  },
  sortScroll: {
    flex: 1,
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
    position: 'relative',
    overflow: 'visible',
    ...(Platform.OS === 'web' && {
      boxShadow: '0 12px 24px rgba(2,6,23,0.08)',
      transitionDuration: '460ms',
      transitionProperty: 'box-shadow',
      transitionTimingFunction: 'cubic-bezier(0.4,0,0.2,1)',
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
  galleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  galleryCard: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    padding: 10,
    position: 'relative',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 12px 22px rgba(2,6,23,0.08)',
        } as any)
      : null),
  },
  galleryCardWebMobile: {
    padding: 8,
  },
  galleryItemWrap: {
    width: Platform.OS === 'web' ? '18.9%' : '48.4%',
    marginBottom: 12,
  },
  galleryItemWrapWebMobile: {
    width: '48.4%',
  },
  galleryCardDark: {
    backgroundColor: '#111827',
    borderColor: '#1F2937',
  },
  galleryPoster: {
    width: '100%',
    aspectRatio: 0.67,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  galleryPosterWebMobile: {
    aspectRatio: 0.72,
  },
  galleryTitle: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    minHeight: 36,
  },
  galleryTitleWebMobile: {
    fontSize: 12,
    lineHeight: 16,
    minHeight: 32,
  },
  galleryMeta: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
  },
  galleryMetaWebMobile: {
    marginTop: 5,
    fontSize: 11,
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
  inLibraryBadgeWrap: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 30,
    overflow: 'visible',
  },
  inLibraryBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0E7490',
    borderWidth: 1,
    borderColor: '#67E8F9',
    boxShadow: '0 4px 12px rgba(14,116,144,0.28)',
  },
  iconTooltip: {
    position: 'absolute',
    top: 28,
    right: 0,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#0F172A',
    minWidth: 74,
    alignItems: 'center',
  },
  iconTooltipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#E2E8F0',
    ...(Platform.OS === 'web' ? ({ whiteSpace: 'nowrap' } as any) : null),
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
