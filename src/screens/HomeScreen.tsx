import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
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
import { Fonts } from '@/constants/theme';
import MagicLoader from '@/components/loaders/MagicLoader';
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
const HOME_CARD_WIDTH = 148;
const HOME_CARD_GAP = 10;
const HOME_CARD_SNAP = HOME_CARD_WIDTH + HOME_CARD_GAP;
const FRIEND_CARD_WIDTH = 186;
const FRIEND_CARD_GAP = 10;
const FRIEND_CARD_SNAP = FRIEND_CARD_WIDTH + FRIEND_CARD_GAP;

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
  const navigateAndBlur = (path: string) => {
    router.push(path as any);
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      (document.activeElement as HTMLElement | null)?.blur?.();
    }
  };
  const flatListRef = useRef<FlatList>(null);
  const sectionRef = useRef<View>(null);
  const scrollOffsetRef = useRef(0);
  const revealAnim = useRef(new Animated.Value(0)).current;

  // Manejar scroll con rueda del ratón en web
  const [isHovering, setIsHovering] = useState(false);
  const [hoveredCardId, setHoveredCardId] = useState<number | null>(null);
  const scrollAnimationRef = useRef<number | null>(null);

  useEffect(() => {
    Animated.timing(revealAnim, {
      toValue: 1,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [revealAnim]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !isHovering) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Cancelar animación anterior si existe
      if (scrollAnimationRef.current) {
        cancelAnimationFrame(scrollAnimationRef.current);
      }
      
      // Convertir scroll vertical en horizontal con factor de velocidad suave
      const scrollAmount = e.deltaY * 1.5; // Factor de velocidad ajustado para movimiento más fluido
      const targetOffset = Math.max(0, scrollOffsetRef.current + scrollAmount);
      
      // Usar requestAnimationFrame para animación suave y profesional
      const startOffset = scrollOffsetRef.current;
      const distance = targetOffset - startOffset;
      const duration = 350; // Duración aumentada para movimiento más suave
      const startTime = performance.now();
      
      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Función de easing suave mejorada (ease-out-cubic con mejor curva)
        const easeOutCubic = 1 - Math.pow(1 - progress, 3);
        // Aplicar curva adicional para movimiento más natural
        const smoothProgress = easeOutCubic * (2 - easeOutCubic);
        
        scrollOffsetRef.current = startOffset + distance * smoothProgress;
        
        if (flatListRef.current) {
          flatListRef.current.scrollToOffset({
            offset: scrollOffsetRef.current,
            animated: false,
          });
        }
        
        if (progress < 1) {
          scrollAnimationRef.current = requestAnimationFrame(animate);
        } else {
          scrollAnimationRef.current = null;
        }
      };
      
      scrollAnimationRef.current = requestAnimationFrame(animate);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('wheel', handleWheel, { passive: false });
      return () => {
        window.removeEventListener('wheel', handleWheel);
        if (scrollAnimationRef.current) {
          cancelAnimationFrame(scrollAnimationRef.current);
        }
      };
    }
  }, [isHovering]);

  return (
    <View 
      ref={sectionRef}
      style={[styles.section, styles.sectionCard, dark && styles.sectionCardDark]}
      {...(Platform.OS === 'web' ? { 
        'data-section-row': true,
        onMouseEnter: () => setIsHovering(true),
        onMouseLeave: () => setIsHovering(false),
      } : {})}
    >
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: dark ? '#E5E7EB' : '#0F172A' }]}>{title}</Text>
        <TouchableOpacity onPress={() => navigateAndBlur(`/browse/${type}`)} style={[styles.moreButton, dark && styles.moreButtonDark, Platform.OS === 'web' && styles.webPressableReset]}>
          <MaterialIcons name="chevron-right" size={20} color={dark ? '#E5E7EB' : '#0F172A'} />
        </TouchableOpacity>
      </View>
      <FlatList
        ref={flatListRef}
        horizontal
        data={items.slice(0, ITEMS_PER_SECTION)}
        keyExtractor={(item) => item.id.toString()}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        snapToInterval={HOME_CARD_SNAP}
        snapToAlignment="start"
        disableIntervalMomentum
        bounces={false}
        onScroll={(event) => {
          // Guardar el offset actual para el scroll con rueda
          if (Platform.OS === 'web') {
            scrollOffsetRef.current = event.nativeEvent.contentOffset.x;
          }
        }}
        scrollEventThrottle={8}
        decelerationRate="fast"
        {...(Platform.OS === 'web' ? {
          // Mejorar el scroll suave en web
          style: { 
            WebkitOverflowScrolling: 'touch' as any,
          },
        } : {})}
        renderItem={({ item, index }) => {
          const start = Math.min(index * 0.06, 0.62);
          const end = Math.min(start + 0.3, 1);
          return (
            <Animated.View
              style={{
                opacity: revealAnim.interpolate({
                  inputRange: [start, end],
                  outputRange: [0, 1],
                  extrapolate: 'clamp',
                }),
                transform: [
                  {
                    translateY: revealAnim.interpolate({
                      inputRange: [start, end],
                      outputRange: [14, 0],
                      extrapolate: 'clamp',
                    }),
                  },
                ],
              }}
            >
              <TouchableOpacity
                style={[styles.card, Platform.OS === 'web' && styles.webPressableReset]}
                activeOpacity={0.75}
                onPress={() => navigateAndBlur(`/${type}/${item.id}`)}
                {...(Platform.OS === 'web'
                  ? {
                      onMouseEnter: () => setHoveredCardId(item.id),
                      onMouseLeave: () => setHoveredCardId(null),
                    }
                  : {})}
              >
                <View style={[styles.posterFrame, Platform.OS === 'web' && hoveredCardId === item.id && styles.posterFrameHovered]}>
                  <Image
                    source={item.imageUrl ? { uri: item.imageUrl } : FALLBACK_IMAGE}
                    style={styles.poster}
                    resizeMode="cover"
                  />
                </View>
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
            </Animated.View>
          );
        }}
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
  const navigateAndBlur = (path: string) => {
    router.push(path as any);
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      (document.activeElement as HTMLElement | null)?.blur?.();
    }
  };
  const flatListRef = useRef<FlatList>(null);
  const sectionRef = useRef<View>(null);
  const scrollOffsetRef = useRef(0);
  const revealAnim = useRef(new Animated.Value(0)).current;

  // Manejar scroll con rueda del ratón en web
  const [isHovering, setIsHovering] = useState(false);
  const [hoveredCardKey, setHoveredCardKey] = useState<string | null>(null);
  const scrollAnimationRef = useRef<number | null>(null);

  useEffect(() => {
    Animated.timing(revealAnim, {
      toValue: 1,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [revealAnim]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !isHovering) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Cancelar animación anterior si existe
      if (scrollAnimationRef.current) {
        cancelAnimationFrame(scrollAnimationRef.current);
      }
      
      // Convertir scroll vertical en horizontal con factor de velocidad suave
      const scrollAmount = e.deltaY * 1.5; // Factor de velocidad ajustado para movimiento más fluido
      const targetOffset = Math.max(0, scrollOffsetRef.current + scrollAmount);
      
      // Usar requestAnimationFrame para animación suave y profesional
      const startOffset = scrollOffsetRef.current;
      const distance = targetOffset - startOffset;
      const duration = 350; // Duración aumentada para movimiento más suave
      const startTime = performance.now();
      
      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Función de easing suave mejorada (ease-out-cubic con mejor curva)
        const easeOutCubic = 1 - Math.pow(1 - progress, 3);
        // Aplicar curva adicional para movimiento más natural
        const smoothProgress = easeOutCubic * (2 - easeOutCubic);
        
        scrollOffsetRef.current = startOffset + distance * smoothProgress;
        
        if (flatListRef.current) {
          flatListRef.current.scrollToOffset({
            offset: scrollOffsetRef.current,
            animated: false,
          });
        }
        
        if (progress < 1) {
          scrollAnimationRef.current = requestAnimationFrame(animate);
        } else {
          scrollAnimationRef.current = null;
        }
      };
      
      scrollAnimationRef.current = requestAnimationFrame(animate);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('wheel', handleWheel, { passive: false });
      return () => {
        window.removeEventListener('wheel', handleWheel);
        if (scrollAnimationRef.current) {
          cancelAnimationFrame(scrollAnimationRef.current);
        }
      };
    }
  }, [isHovering]);

  if (items.length === 0) return null;

  return (
    <View 
      ref={sectionRef}
      style={[styles.section, styles.sectionCard, dark && styles.sectionCardDark]}
      {...(Platform.OS === 'web' ? { 
        'data-section-row': true,
        onMouseEnter: () => setIsHovering(true),
        onMouseLeave: () => setIsHovering(false),
      } : {})}
    >
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: dark ? '#E5E7EB' : '#0F172A' }]}>
          {title}
        </Text>
      </View>
      <FlatList
        ref={flatListRef}
        horizontal
        data={items}
        keyExtractor={(item) => `${item.mediaType}-${item.id}`}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        snapToInterval={HOME_CARD_SNAP}
        snapToAlignment="start"
        disableIntervalMomentum
        bounces={false}
        onScroll={(event) => {
          // Guardar el offset actual para el scroll con rueda
          if (Platform.OS === 'web') {
            scrollOffsetRef.current = event.nativeEvent.contentOffset.x;
          }
        }}
        scrollEventThrottle={8}
        decelerationRate="fast"
        {...(Platform.OS === 'web' ? {
          // Mejorar el scroll suave en web
          style: { 
            WebkitOverflowScrolling: 'touch' as any,
          },
        } : {})}
        renderItem={({ item, index }) => {
          const key = `${item.mediaType}-${item.id}`;
          const start = Math.min(index * 0.06, 0.62);
          const end = Math.min(start + 0.3, 1);
          return (
            <Animated.View
              style={{
                opacity: revealAnim.interpolate({
                  inputRange: [start, end],
                  outputRange: [0, 1],
                  extrapolate: 'clamp',
                }),
                transform: [
                  {
                    translateY: revealAnim.interpolate({
                      inputRange: [start, end],
                      outputRange: [14, 0],
                      extrapolate: 'clamp',
                    }),
                  },
                ],
              }}
            >
              <TouchableOpacity
                style={[styles.card, Platform.OS === 'web' && styles.webPressableReset]}
                activeOpacity={0.75}
                onPress={() => navigateAndBlur(`/${item.mediaType}/${item.id}`)}
                {...(Platform.OS === 'web'
                  ? {
                      onMouseEnter: () => setHoveredCardKey(key),
                      onMouseLeave: () => setHoveredCardKey(null),
                    }
                  : {})}
              >
                <View style={[styles.posterFrame, Platform.OS === 'web' && hoveredCardKey === key && styles.posterFrameHovered]}>
                  <Image
                    source={item.imageUrl ? { uri: item.imageUrl } : FALLBACK_IMAGE}
                    style={styles.poster}
                    resizeMode="cover"
                  />
                </View>
                <TouchableOpacity style={[styles.dismissButton, Platform.OS === 'web' && styles.webPressableReset]} onPress={() => onDismiss(item)}>
                  <MaterialIcons name="block" size={13} color="#7C2D12" />
                </TouchableOpacity>
                <Text numberOfLines={2} style={[styles.cardTitle, { color: dark ? '#E5E7EB' : '#0F172A' }]}>
                  {item.name}
                </Text>
                <Text numberOfLines={2} style={[styles.recommendationReason, { color: dark ? '#93C5FD' : '#0369A1' }]}>
                  {item.reason}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          );
        }}
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
  const navigateAndBlur = (path: string) => {
    router.push(path as any);
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      (document.activeElement as HTMLElement | null)?.blur?.();
    }
  };
  const flatListRef = useRef<FlatList>(null);
  const sectionRef = useRef<View>(null);
  const scrollOffsetRef = useRef(0);
  const revealAnim = useRef(new Animated.Value(0)).current;

  // Manejar scroll con rueda del ratón en web
  const [isHovering, setIsHovering] = useState(false);
  const scrollAnimationRef = useRef<number | null>(null);

  useEffect(() => {
    Animated.timing(revealAnim, {
      toValue: 1,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [revealAnim]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !isHovering) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Cancelar animación anterior si existe
      if (scrollAnimationRef.current) {
        cancelAnimationFrame(scrollAnimationRef.current);
      }
      
      // Convertir scroll vertical en horizontal con factor de velocidad suave
      const scrollAmount = e.deltaY * 1.5; // Factor de velocidad ajustado para movimiento más fluido
      const targetOffset = Math.max(0, scrollOffsetRef.current + scrollAmount);
      
      // Usar requestAnimationFrame para animación suave y profesional
      const startOffset = scrollOffsetRef.current;
      const distance = targetOffset - startOffset;
      const duration = 350; // Duración aumentada para movimiento más suave
      const startTime = performance.now();
      
      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Función de easing suave mejorada (ease-out-cubic con mejor curva)
        const easeOutCubic = 1 - Math.pow(1 - progress, 3);
        // Aplicar curva adicional para movimiento más natural
        const smoothProgress = easeOutCubic * (2 - easeOutCubic);
        
        scrollOffsetRef.current = startOffset + distance * smoothProgress;
        
        if (flatListRef.current) {
          flatListRef.current.scrollToOffset({
            offset: scrollOffsetRef.current,
            animated: false,
          });
        }
        
        if (progress < 1) {
          scrollAnimationRef.current = requestAnimationFrame(animate);
        } else {
          scrollAnimationRef.current = null;
        }
      };
      
      scrollAnimationRef.current = requestAnimationFrame(animate);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('wheel', handleWheel, { passive: false });
      return () => {
        window.removeEventListener('wheel', handleWheel);
        if (scrollAnimationRef.current) {
          cancelAnimationFrame(scrollAnimationRef.current);
        }
      };
    }
  }, [isHovering]);

  return (
    <View 
      ref={sectionRef}
      style={[styles.section, styles.sectionCard, dark && styles.sectionCardDark]}
      {...(Platform.OS === 'web' ? { 
        'data-section-row': true,
        onMouseEnter: () => setIsHovering(true),
        onMouseLeave: () => setIsHovering(false),
      } : {})}
    >
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: dark ? '#E5E7EB' : '#0F172A' }]}>Lo que hacen tus amigos</Text>
      </View>
      {items.length === 0 ? (
        <Text style={[styles.friendEmptyText, { color: dark ? '#94A3B8' : '#64748B' }]}>
          Añade amigas/os en Perfil para ver su actividad aquí.
        </Text>
      ) : (
        <FlatList
          ref={flatListRef}
          horizontal
          data={items}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          snapToInterval={FRIEND_CARD_SNAP}
          snapToAlignment="start"
          disableIntervalMomentum
          bounces={false}
          onScroll={(event) => {
            // Guardar el offset actual para el scroll con rueda
            if (Platform.OS === 'web') {
              scrollOffsetRef.current = event.nativeEvent.contentOffset.x;
            }
          }}
          scrollEventThrottle={16}
          renderItem={({ item, index }) => {
            const start = Math.min(index * 0.08, 0.62);
            const end = Math.min(start + 0.3, 1);
            return (
              <Animated.View
                style={{
                  opacity: revealAnim.interpolate({
                    inputRange: [start, end],
                    outputRange: [0, 1],
                    extrapolate: 'clamp',
                  }),
                  transform: [
                    {
                      translateY: revealAnim.interpolate({
                        inputRange: [start, end],
                        outputRange: [14, 0],
                        extrapolate: 'clamp',
                      }),
                    },
                  ],
                }}
              >
                <TouchableOpacity
                  style={[styles.friendCard, dark && styles.friendCardDark, Platform.OS === 'web' && styles.webPressableReset]}
                  activeOpacity={0.8}
                  onPress={() => navigateAndBlur(`/${item.mediaType}/${item.externalId}`)}
                >
                  <Text numberOfLines={1} style={[styles.friendName, { color: dark ? '#93C5FD' : '#0E7490' }]}>{item.friendName}</Text>
                  <Text numberOfLines={2} style={[styles.friendTitle, { color: dark ? '#E5E7EB' : '#0F172A' }]}>{item.title}</Text>
                  <Text numberOfLines={1} style={[styles.friendMeta, { color: dark ? '#94A3B8' : '#64748B' }]}>{new Date(item.activityDate).toLocaleDateString('es-ES')}</Text>
                </TouchableOpacity>
              </Animated.View>
            );
          }}
        />
      )}
    </View>
  );
}

function HomeScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const isWeb = Platform.OS === 'web';
  const heroEntrance = useRef(new Animated.Value(0)).current;
  const glowPulse = useRef(new Animated.Value(0)).current;
  const trackedItems = useTrackingStore((state) => state.items);
  const dismissedRecommendationKeys = usePreferencesStore((state) => state.dismissedRecommendationKeys);
  const dismissRecommendation = usePreferencesStore((state) => state.dismissRecommendation);
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
    let cancelled = false;
    (async () => {
      const feed = await getFriendsActivity(10);
      if (!cancelled) setFriendsActivity(feed);
    })();
    return () => {
      cancelled = true;
    };
  }, [trackedItems.length]);

  useEffect(() => {
    Animated.timing(heroEntrance, {
      toValue: 1,
      duration: 620,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [heroEntrance]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, {
          toValue: 1,
          duration: 2400,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(glowPulse, {
          toValue: 0,
          duration: 2400,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [glowPulse]);

  function handleDismissRecommendation(item: RecommendationItem) {
    dismissRecommendation(`${item.mediaType}-${item.id}`);
  }

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: isDark ? '#0B1220' : '#F8FAFC' }]}>
        <MagicLoader size={58} text="Cargando populares..." />
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
        <Animated.View
          style={[
            styles.hero,
            isDark && styles.heroDark,
            {
              opacity: heroEntrance,
              transform: [
                {
                  translateY: heroEntrance.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Animated.View
            style={[
              styles.heroGlowA,
              {
                opacity: glowPulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.6, 1],
                }),
                transform: [
                  {
                    scale: glowPulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.1],
                    }),
                  },
                ],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.heroGlowB,
              {
                opacity: glowPulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 0.55],
                }),
                transform: [
                  {
                    scale: glowPulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1.04, 0.92],
                    }),
                  },
                ],
              },
            ]}
          />
          <View style={[styles.heroPill, isDark && styles.heroPillDark]}>
            <Text style={[styles.heroPillText, { color: isDark ? '#7DD3FC' : '#0E7490' }]}>Flicksy Picks</Text>
          </View>
          <Text style={[styles.heroTitle, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>Flicksy</Text>
          <Text style={[styles.heroSubtitle, { color: isDark ? '#CBD5E1' : '#334155' }]}>Lo más popular del catálogo mundial</Text>
          <View style={styles.heroBadgesRow}>
            <View style={[styles.heroBadge, isDark && styles.heroBadgeDark]}>
              <Text style={[styles.heroBadgeText, { color: isDark ? '#CFFAFE' : '#0C4A6E' }]}>🎬 Películas</Text>
            </View>
            <View style={[styles.heroBadge, isDark && styles.heroBadgeDark]}>
              <Text style={[styles.heroBadgeText, { color: isDark ? '#CFFAFE' : '#0C4A6E' }]}>📺 Series</Text>
            </View>
            <View style={[styles.heroBadge, isDark && styles.heroBadgeDark]}>
              <Text style={[styles.heroBadgeText, { color: isDark ? '#CFFAFE' : '#0C4A6E' }]}>🎮 Juegos</Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View
          style={[
            styles.sectionLabelRow,
            isDark && styles.sectionLabelRowDark,
            {
              opacity: heroEntrance,
              transform: [
                {
                  translateY: heroEntrance.interpolate({
                    inputRange: [0, 1],
                    outputRange: [12, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.sectionEmoji}>❤️</Text>
          <Text style={[styles.sectionLabelText, { color: isDark ? '#E2E8F0' : '#0F172A' }]}>Para ti</Text>
        </Animated.View>
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

        <Animated.View
          style={[
            styles.sectionLabelRow,
            isDark && styles.sectionLabelRowDark,
            {
              opacity: heroEntrance,
              transform: [
                {
                  translateY: heroEntrance.interpolate({
                    inputRange: [0, 1],
                    outputRange: [12, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.sectionEmoji}>🔥</Text>
          <Text style={[styles.sectionLabelText, { color: isDark ? '#E2E8F0' : '#0F172A' }]}>Tendencias mundiales</Text>
        </Animated.View>

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
    maxWidth: 1160,
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
    marginBottom: 10,
    borderRadius: 24,
    backgroundColor: '#ECFEFF',
    borderWidth: 1,
    borderColor: '#A5F3FC',
    paddingHorizontal: 18,
    paddingVertical: 16,
    overflow: 'hidden',
    boxShadow: '0 14px 32px rgba(6, 95, 120, 0.16)',
  },
  heroDark: {
    backgroundColor: '#0F172A',
    borderColor: '#1F2937',
    boxShadow: '0 14px 30px rgba(2, 6, 23, 0.5)',
  },
  heroGlowA: {
    position: 'absolute',
    width: 156,
    height: 156,
    borderRadius: 78,
    backgroundColor: 'rgba(34, 211, 238, 0.24)',
    top: -40,
    right: -20,
  },
  heroGlowB: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(59, 130, 246, 0.18)',
    bottom: -30,
    left: -20,
  },
  heroPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderColor: 'rgba(14,116,144,0.25)',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 10,
  },
  heroPillDark: {
    backgroundColor: 'rgba(15,23,42,0.7)',
    borderColor: 'rgba(125,211,252,0.3)',
  },
  heroPillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: 36,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.3,
    ...(Platform.OS === 'web' && {
      fontFamily: Fonts.web?.serif || "Georgia, 'Times New Roman', serif",
    }),
  },
  heroSubtitle: {
    marginTop: 4,
    fontSize: 15,
    color: '#334155',
    fontWeight: '700',
  },
  heroBadgesRow: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  heroBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(8,145,178,0.2)',
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  heroBadgeDark: {
    borderColor: 'rgba(125,211,252,0.28)',
    backgroundColor: 'rgba(15,23,42,0.75)',
  },
  heroBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    marginTop: 14,
    marginBottom: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
  },
  sectionLabelRowDark: {
    borderColor: '#334155',
    backgroundColor: '#0F172A',
  },
  sectionLabelText: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.2,
    lineHeight: 22,
  },
  sectionEmoji: {
    fontSize: 18,
    lineHeight: 22,
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
    ...(Platform.OS === 'web' && {
      boxShadow: '0 14px 30px rgba(2,6,23,0.08)',
      backdropFilter: 'blur(6px)' as any,
      overflow: 'visible',
    } as any),
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
    ...(Platform.OS === 'web' && {
      fontFamily: Fonts.web?.serif || "Georgia, 'Times New Roman', serif",
      letterSpacing: 0.15,
    }),
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
    paddingRight: 18,
  },
  card: {
    width: HOME_CARD_WIDTH,
    marginHorizontal: HOME_CARD_GAP / 2,
    position: 'relative',
    overflow: 'visible',
  },
  friendCard: {
    width: FRIEND_CARD_WIDTH,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 10,
    marginHorizontal: FRIEND_CARD_GAP / 2,
    backgroundColor: '#FFFFFF',
    overflow: 'visible',
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
    width: HOME_CARD_WIDTH,
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
  },
  posterFrameHovered: {
    boxShadow: '0 14px 30px rgba(2,6,23,0.3)',
    zIndex: 8,
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
  webPressableReset: {
    ...(Platform.OS === 'web'
      ? ({
          outlineStyle: 'none',
          WebkitTapHighlightColor: 'transparent',
          userSelect: 'none',
          cursor: 'pointer',
        } as any)
      : null),
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
});

export default HomeScreen;
