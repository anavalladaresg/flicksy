import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
const DISCOVERY_ITEMS = ITEMS_PER_SECTION;
const SAFE_RATIO = 0.8;
const HOME_CARD_WIDTH = 148;
const HOME_CARD_GAP = 10;
const HOME_CARD_SNAP = HOME_CARD_WIDTH + HOME_CARD_GAP;
const FRIEND_CARD_WIDTH = 186;
const FRIEND_CARD_GAP = 10;
const FRIEND_CARD_SNAP = FRIEND_CARD_WIDTH + FRIEND_CARD_GAP;
const WEB_TOP_TABS_OFFSET = 72;
const HOME_WHEEL_DEBUG = false;

function logHomeWheel(section: string, event: string, payload?: Record<string, unknown>) {
  if (!HOME_WHEEL_DEBUG) return;
  console.log(`[home-wheel][${section}][${new Date().toISOString()}] ${event}`, payload ?? {});
}

function useWebHorizontalWheel(options: {
  enabled: boolean;
  section: string;
  flatListRef: React.RefObject<FlatList<any>>;
  scrollOffsetRef: React.MutableRefObject<number>;
}) {
  const { enabled, section, flatListRef, scrollOffsetRef } = options;
  const wheelAnimationRef = useRef<number | null>(null);
  const wheelVelocityRef = useRef(0);
  const wheelFrameCountRef = useRef(0);

  const stopWheel = useCallback(() => {
    if (wheelAnimationRef.current != null) {
      cancelAnimationFrame(wheelAnimationRef.current);
      wheelAnimationRef.current = null;
    }
    wheelVelocityRef.current = 0;
    wheelFrameCountRef.current = 0;
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;

    wheelVelocityRef.current = 0;
    wheelFrameCountRef.current = 0;
    logHomeWheel(section, 'listener-attached');

    const step = () => {
      const current = scrollOffsetRef.current;
      let velocity = wheelVelocityRef.current;
      wheelFrameCountRef.current += 1;

      if (Math.abs(velocity) < 0.08) {
        const settled = Math.max(0, current);
        wheelVelocityRef.current = 0;
        scrollOffsetRef.current = settled;
        flatListRef.current?.scrollToOffset({ offset: settled, animated: false });
        logHomeWheel(section, 'wheel-animation-end', {
          finalOffset: Number(settled.toFixed(2)),
          frames: wheelFrameCountRef.current,
          reason: 'velocity-settled',
        });
        wheelAnimationRef.current = null;
        wheelFrameCountRef.current = 0;
        return;
      }

      // Glide model: inertia + friction for a cleaner visual feel.
      let nextOffset = current + velocity;
      if (nextOffset < 0) {
        nextOffset = 0;
        velocity *= 0.32;
      }

      // Friction curve tuned for smooth decay without abrupt stops.
      velocity *= 0.88;
      if (Math.abs(velocity) < 0.08) velocity = 0;

      wheelVelocityRef.current = velocity;
      scrollOffsetRef.current = nextOffset;
      flatListRef.current?.scrollToOffset({
        offset: scrollOffsetRef.current,
        animated: false,
      });
      wheelAnimationRef.current = requestAnimationFrame(step);
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const rawDelta = Number(e.deltaY || 0);
      const normalizedDelta = Math.max(-120, Math.min(120, rawDelta));
      const impulse = normalizedDelta * 0.05;
      const currentOffset = scrollOffsetRef.current;

      // At left edge, ignore extra negative wheel to avoid noisy micro animations.
      if (currentOffset <= 0.5 && impulse < 0 && Math.abs(wheelVelocityRef.current) < 0.08) {
        logHomeWheel(section, 'wheel-ignored-at-left-edge', {
          deltaY: Number(rawDelta.toFixed(2)),
          normalizedDelta: Number(normalizedDelta.toFixed(2)),
        });
        return;
      }

      wheelVelocityRef.current = Math.max(
        -42,
        Math.min(42, wheelVelocityRef.current + impulse)
      );
      logHomeWheel(section, 'wheel-input', {
        deltaY: Number(rawDelta.toFixed(2)),
        normalizedDelta: Number(normalizedDelta.toFixed(2)),
        startOffset: Number(currentOffset.toFixed(2)),
        velocity: Number(wheelVelocityRef.current.toFixed(3)),
      });

      if (wheelAnimationRef.current == null) {
        wheelAnimationRef.current = requestAnimationFrame(step);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('wheel', handleWheel, { passive: false });
      return () => {
        logHomeWheel(section, 'listener-detached');
        window.removeEventListener('wheel', handleWheel);
        stopWheel();
      };
    }
  }, [enabled, flatListRef, scrollOffsetRef, section, stopWheel]);

  return { stopWheel };
}

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
  ownLibraryKeys,
}: {
  title: string;
  type: 'movie' | 'tv' | 'game';
  items: CardItem[];
  dark: boolean;
  ownLibraryKeys: Set<string>;
}) {
  const wheelSection = 'main-row';
  const router = useRouter();
  const suppressClickRef = useRef(false);
  const navigateAndBlur = (path: string) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
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
  const [isDraggingVisual, setIsDraggingVisual] = useState(false);
  const [hoveredCardId, setHoveredCardId] = useState<number | null>(null);
  const [hoveredLibraryKey, setHoveredLibraryKey] = useState<string | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartOffsetRef = useRef(0);
  const { stopWheel } = useWebHorizontalWheel({
    enabled: isHovering,
    section: wheelSection,
    flatListRef,
    scrollOffsetRef,
  });

  const setBodyDragCursor = useCallback((active: boolean) => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.body.style.cursor = active ? 'grabbing' : '';
  }, []);

  useEffect(() => {
    return () => setBodyDragCursor(false);
  }, [setBodyDragCursor]);

  useEffect(() => {
    Animated.timing(revealAnim, {
      toValue: 1,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [revealAnim]);

  return (
    <View 
      ref={sectionRef}
      style={[
        styles.section,
        styles.sectionCard,
        dark && styles.sectionCardDark,
        Platform.OS === 'web' ? ({ cursor: isDraggingVisual ? 'grabbing' : 'default' } as any) : null,
      ]}
      {...(Platform.OS === 'web' ? { 
        'data-section-row': true,
        onMouseEnter: () => {
          logHomeWheel(wheelSection, 'hover-enter');
          setIsHovering(true);
        },
        onMouseLeave: () => {
          logHomeWheel(wheelSection, 'hover-leave');
          setIsHovering(false);
          isDraggingRef.current = false;
          setIsDraggingVisual(false);
          setBodyDragCursor(false);
          stopWheel();
        },
        onMouseDown: (event: any) => {
          const button = event?.nativeEvent?.button ?? event?.button;
          if (button !== 0) return;
          event?.preventDefault?.();
          stopWheel();
          isDraggingRef.current = true;
          setIsDraggingVisual(true);
          setBodyDragCursor(true);
          suppressClickRef.current = false;
          dragStartXRef.current = event?.nativeEvent?.clientX ?? event?.clientX ?? 0;
          dragStartOffsetRef.current = scrollOffsetRef.current;
        },
        onMouseMove: (event: any) => {
          if (!isDraggingRef.current) return;
          const clientX = event?.nativeEvent?.clientX ?? event?.clientX ?? 0;
          const delta = dragStartXRef.current - clientX;
          if (Math.abs(delta) > 6) suppressClickRef.current = true;
          const nextOffset = Math.max(0, dragStartOffsetRef.current + delta);
          scrollOffsetRef.current = nextOffset;
          flatListRef.current?.scrollToOffset({ offset: nextOffset, animated: false });
        },
        onMouseUp: () => {
          isDraggingRef.current = false;
          setIsDraggingVisual(false);
          setBodyDragCursor(false);
        },
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
                style={[
                  styles.card,
                  Platform.OS === 'web' && styles.webPressableReset,
                  Platform.OS === 'web' && isDraggingVisual && styles.webGrabbingCursor,
                ]}
                activeOpacity={0.75}
                onPress={() => navigateAndBlur(`/${type}/${item.id}`)}
                {...(Platform.OS === 'web'
                  ? {
                      onMouseEnter: () => setHoveredCardId(item.id),
                      onMouseLeave: () => {
                        setHoveredCardId(null);
                        setHoveredLibraryKey(null);
                      },
                    }
                  : {})}
              >
                {ownLibraryKeys.has(`${type}-${item.id}`) ? (
                  <View
                    style={styles.inLibraryBadgeWrap}
                    {...(Platform.OS === 'web'
                      ? {
                          onMouseEnter: () => setHoveredLibraryKey(`${type}-${item.id}`),
                          onMouseLeave: () =>
                            setHoveredLibraryKey((prev) =>
                              prev === `${type}-${item.id}` ? null : prev
                            ),
                        }
                      : {})}
                  >
                    <View style={styles.inLibraryBadge}>
                      <MaterialIcons name="library-add-check" size={14} color="#E0F2FE" />
                    </View>
                    {Platform.OS === 'web' && hoveredLibraryKey === `${type}-${item.id}` ? (
                      <View style={styles.iconTooltip}>
                        <Text numberOfLines={1} style={styles.iconTooltipText}>Ya añadido</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
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
  ownLibraryKeys,
}: {
  title: string;
  items: RecommendationItem[];
  dark: boolean;
  onDismiss: (item: RecommendationItem) => void;
  ownLibraryKeys: Set<string>;
}) {
  const wheelSection = 'personalized-row';
  const router = useRouter();
  const suppressClickRef = useRef(false);
  const navigateAndBlur = (path: string) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
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
  const [isDraggingVisual, setIsDraggingVisual] = useState(false);
  const [hoveredCardKey, setHoveredCardKey] = useState<string | null>(null);
  const [hoveredDismissKey, setHoveredDismissKey] = useState<string | null>(null);
  const [hoveredLibraryKey, setHoveredLibraryKey] = useState<string | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartOffsetRef = useRef(0);
  const { stopWheel } = useWebHorizontalWheel({
    enabled: isHovering,
    section: wheelSection,
    flatListRef,
    scrollOffsetRef,
  });

  const setBodyDragCursor = useCallback((active: boolean) => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.body.style.cursor = active ? 'grabbing' : '';
  }, []);

  useEffect(() => {
    return () => setBodyDragCursor(false);
  }, [setBodyDragCursor]);

  useEffect(() => {
    Animated.timing(revealAnim, {
      toValue: 1,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [revealAnim]);

  if (items.length === 0) return null;

  return (
    <View 
      ref={sectionRef}
      style={[
        styles.section,
        styles.sectionCard,
        dark && styles.sectionCardDark,
        Platform.OS === 'web' ? ({ cursor: isDraggingVisual ? 'grabbing' : 'default' } as any) : null,
      ]}
      {...(Platform.OS === 'web' ? { 
        'data-section-row': true,
        onMouseEnter: () => {
          logHomeWheel(wheelSection, 'hover-enter');
          setIsHovering(true);
        },
        onMouseLeave: () => {
          logHomeWheel(wheelSection, 'hover-leave');
          setIsHovering(false);
          isDraggingRef.current = false;
          setIsDraggingVisual(false);
          setBodyDragCursor(false);
          stopWheel();
        },
        onMouseDown: (event: any) => {
          const button = event?.nativeEvent?.button ?? event?.button;
          if (button !== 0) return;
          event?.preventDefault?.();
          stopWheel();
          isDraggingRef.current = true;
          setIsDraggingVisual(true);
          setBodyDragCursor(true);
          suppressClickRef.current = false;
          dragStartXRef.current = event?.nativeEvent?.clientX ?? event?.clientX ?? 0;
          dragStartOffsetRef.current = scrollOffsetRef.current;
        },
        onMouseMove: (event: any) => {
          if (!isDraggingRef.current) return;
          const clientX = event?.nativeEvent?.clientX ?? event?.clientX ?? 0;
          const delta = dragStartXRef.current - clientX;
          if (Math.abs(delta) > 6) suppressClickRef.current = true;
          const nextOffset = Math.max(0, dragStartOffsetRef.current + delta);
          scrollOffsetRef.current = nextOffset;
          flatListRef.current?.scrollToOffset({ offset: nextOffset, animated: false });
        },
        onMouseUp: () => {
          isDraggingRef.current = false;
          setIsDraggingVisual(false);
          setBodyDragCursor(false);
        },
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
                style={[
                  styles.card,
                  Platform.OS === 'web' && styles.webPressableReset,
                  Platform.OS === 'web' && isDraggingVisual && styles.webGrabbingCursor,
                ]}
                activeOpacity={0.75}
                onPress={() => navigateAndBlur(`/${item.mediaType}/${item.id}`)}
                {...(Platform.OS === 'web'
                  ? {
                      onMouseEnter: () => setHoveredCardKey(key),
                      onMouseLeave: () => {
                        setHoveredCardKey(null);
                        setHoveredDismissKey(null);
                        setHoveredLibraryKey(null);
                      },
                    }
                  : {})}
              >
                {ownLibraryKeys.has(`${item.mediaType}-${item.id}`) ? (
                  <View
                    style={[styles.inLibraryBadgeWrap, styles.inLibraryBadgeWrapLeft]}
                    {...(Platform.OS === 'web'
                      ? {
                          onMouseEnter: () => setHoveredLibraryKey(key),
                          onMouseLeave: () =>
                            setHoveredLibraryKey((prev) => (prev === key ? null : prev)),
                        }
                      : {})}
                  >
                    <View style={styles.inLibraryBadge}>
                      <MaterialIcons name="library-add-check" size={14} color="#E0F2FE" />
                    </View>
                    {Platform.OS === 'web' && hoveredLibraryKey === key ? (
                      <View style={[styles.iconTooltip, styles.iconTooltipLeft]}>
                        <Text numberOfLines={1} style={styles.iconTooltipText}>Ya añadido</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
                <View style={[styles.posterFrame, Platform.OS === 'web' && hoveredCardKey === key && styles.posterFrameHovered]}>
                  <Image
                    source={item.imageUrl ? { uri: item.imageUrl } : FALLBACK_IMAGE}
                    style={styles.poster}
                    resizeMode="cover"
                  />
                </View>
                <TouchableOpacity
                  style={[
                    styles.dismissButton,
                    Platform.OS === 'web' && styles.webPressableReset,
                    Platform.OS === 'web' && isDraggingVisual && styles.webGrabbingCursor,
                  ]}
                  onPress={() => onDismiss(item)}
                  {...(Platform.OS === 'web'
                    ? {
                        onMouseEnter: () => setHoveredDismissKey(key),
                        onMouseLeave: () => setHoveredDismissKey((prev) => (prev === key ? null : prev)),
                      }
                    : {})}
                >
                  <MaterialIcons name="block" size={13} color="#7C2D12" />
                </TouchableOpacity>
                {Platform.OS === 'web' && hoveredDismissKey === key ? (
                  <View style={styles.actionTooltip}>
                    <Text numberOfLines={1} style={styles.actionTooltipText}>No sugerir</Text>
                  </View>
                ) : null}
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
  ownLibraryKeys,
}: {
  items: FriendActivityItem[];
  dark: boolean;
  ownLibraryKeys: Set<string>;
}) {
  const wheelSection = 'friends-row';
  const router = useRouter();
  const suppressClickRef = useRef(false);
  const navigateAndBlur = (path: string) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
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
  const [isDraggingVisual, setIsDraggingVisual] = useState(false);
  const [hoveredLibraryKey, setHoveredLibraryKey] = useState<string | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartOffsetRef = useRef(0);
  const { stopWheel } = useWebHorizontalWheel({
    enabled: isHovering,
    section: wheelSection,
    flatListRef,
    scrollOffsetRef,
  });

  const setBodyDragCursor = useCallback((active: boolean) => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.body.style.cursor = active ? 'grabbing' : '';
  }, []);

  useEffect(() => {
    return () => setBodyDragCursor(false);
  }, [setBodyDragCursor]);

  useEffect(() => {
    Animated.timing(revealAnim, {
      toValue: 1,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [revealAnim]);

  return (
    <View 
      ref={sectionRef}
      style={[
        styles.section,
        styles.sectionCard,
        dark && styles.sectionCardDark,
        Platform.OS === 'web' ? ({ cursor: isDraggingVisual ? 'grabbing' : 'default' } as any) : null,
      ]}
      {...(Platform.OS === 'web' ? { 
        'data-section-row': true,
        onMouseEnter: () => {
          logHomeWheel(wheelSection, 'hover-enter');
          setIsHovering(true);
        },
        onMouseLeave: () => {
          logHomeWheel(wheelSection, 'hover-leave');
          setIsHovering(false);
          isDraggingRef.current = false;
          setIsDraggingVisual(false);
          setBodyDragCursor(false);
          stopWheel();
        },
        onMouseDown: (event: any) => {
          const button = event?.nativeEvent?.button ?? event?.button;
          if (button !== 0) return;
          event?.preventDefault?.();
          stopWheel();
          isDraggingRef.current = true;
          setIsDraggingVisual(true);
          setBodyDragCursor(true);
          suppressClickRef.current = false;
          dragStartXRef.current = event?.nativeEvent?.clientX ?? event?.clientX ?? 0;
          dragStartOffsetRef.current = scrollOffsetRef.current;
        },
        onMouseMove: (event: any) => {
          if (!isDraggingRef.current) return;
          const clientX = event?.nativeEvent?.clientX ?? event?.clientX ?? 0;
          const delta = dragStartXRef.current - clientX;
          if (Math.abs(delta) > 6) suppressClickRef.current = true;
          const nextOffset = Math.max(0, dragStartOffsetRef.current + delta);
          scrollOffsetRef.current = nextOffset;
          flatListRef.current?.scrollToOffset({ offset: nextOffset, animated: false });
        },
        onMouseUp: () => {
          isDraggingRef.current = false;
          setIsDraggingVisual(false);
          setBodyDragCursor(false);
        },
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
                  style={[
                    styles.friendCard,
                    dark && styles.friendCardDark,
                    Platform.OS === 'web' && styles.webPressableReset,
                    Platform.OS === 'web' && isDraggingVisual && styles.webGrabbingCursor,
                  ]}
                  activeOpacity={0.8}
                  onPress={() => navigateAndBlur(`/${item.mediaType}/${item.externalId}`)}
                  {...(Platform.OS === 'web'
                    ? {
                        onMouseLeave: () => setHoveredLibraryKey(null),
                      }
                    : {})}
                >
                  {ownLibraryKeys.has(`${item.mediaType}-${item.externalId}`) ? (
                    <View
                      style={styles.inLibraryBadgeWrap}
                      {...(Platform.OS === 'web'
                        ? {
                            onMouseEnter: () =>
                              setHoveredLibraryKey(`${item.mediaType}-${item.externalId}`),
                            onMouseLeave: () =>
                              setHoveredLibraryKey((prev) =>
                                prev === `${item.mediaType}-${item.externalId}` ? null : prev
                              ),
                          }
                        : {})}
                    >
                      <View style={styles.inLibraryBadge}>
                        <MaterialIcons name="library-add-check" size={14} color="#E0F2FE" />
                      </View>
                      {Platform.OS === 'web' &&
                      hoveredLibraryKey === `${item.mediaType}-${item.externalId}` ? (
                        <View style={styles.iconTooltip}>
                          <Text numberOfLines={1} style={styles.iconTooltipText}>Ya añadido</Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
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
  const RootContainer = isWeb ? View : SafeAreaView;
  const heroEntrance = useRef(new Animated.Value(0)).current;
  const glowPulse = useRef(new Animated.Value(0)).current;
  const trackedItems = useTrackingStore((state) => state.items);
  const ownLibraryKeys = useMemo(
    () => new Set(trackedItems.map((item) => `${item.mediaType}-${item.externalId}`)),
    [trackedItems]
  );
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
    const discovery = discoveryPool.slice(0, DISCOVERY_ITEMS);

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
      <RootContainer style={[styles.centered, { backgroundColor: isDark ? '#0B1220' : '#F8FAFC' }]}>
        <MagicLoader size={58} text="Cargando populares..." />
      </RootContainer>
    );
  }

  if (allFailed) {
    return (
      <RootContainer style={[styles.centered, { backgroundColor: isDark ? '#0B1220' : '#F8FAFC' }]}>
        <Text style={styles.errorTitle}>No pudimos cargar el contenido</Text>
        <Text style={styles.errorSubtitle}>Verifica tus claves de TMDB e IGDB y recarga la app.</Text>
      </RootContainer>
    );
  }

  return (
    <RootContainer style={[styles.container, { backgroundColor: isDark ? '#0B1220' : '#F8FAFC' }]}> 
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
              isWeb && styles.heroGlowAWebAligned,
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
            {isWeb ? <Image source={{ uri: '/icon-192.png' }} style={styles.heroPillLogo} resizeMode="contain" /> : null}
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
          ownLibraryKeys={ownLibraryKeys}
        />
        <FriendsActivityRow items={friendsActivity} dark={isDark} ownLibraryKeys={ownLibraryKeys} />
        <PersonalizedRow
          title="Descubrimiento"
          items={personalized.discovery}
          dark={isDark}
          onDismiss={handleDismissRecommendation}
          ownLibraryKeys={ownLibraryKeys}
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
          <SectionRow title="Películas más vistas" type="movie" items={movies} dark={isDark} ownLibraryKeys={ownLibraryKeys} />
        )}

        {tvQuery.isError ? (
          <Text style={styles.sectionError}>No se pudieron cargar series.</Text>
        ) : (
          <SectionRow title="Series más vistas" type="tv" items={tvShows} dark={isDark} ownLibraryKeys={ownLibraryKeys} />
        )}

        {gamesQuery.isError ? (
          <Text style={styles.sectionError}>No se pudieron cargar videojuegos.</Text>
        ) : (
          <SectionRow title="Juegos más jugados" type="game" items={games} dark={isDark} ownLibraryKeys={ownLibraryKeys} />
        )}
      </ScrollView>
    </RootContainer>
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
    paddingTop: WEB_TOP_TABS_OFFSET,
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
  heroGlowAWebAligned: {
    top: -47,
    right: -40,
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
    position: 'absolute',
    top: 14,
    right: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderRadius: 999,
    paddingHorizontal: 0,
    paddingVertical: 0,
    zIndex: 2,
  },
  heroPillDark: {
    backgroundColor: 'rgba(15,23,42,0.7)',
    borderColor: 'rgba(125,211,252,0.3)',
  },
  heroPillLogo: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
    marginHorizontal: 16,
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
  inLibraryBadgeWrap: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 24,
    overflow: 'visible',
  },
  inLibraryBadgeWrapLeft: {
    left: 6,
    right: 'auto',
  },
  inLibraryBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0E7490',
    borderWidth: 1,
    borderColor: '#67E8F9',
    boxShadow: '0 4px 12px rgba(14,116,144,0.28)',
  },
  iconTooltip: {
    position: 'absolute',
    top: 26,
    right: 0,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#0F172A',
    minWidth: 74,
    alignItems: 'center',
  },
  iconTooltipLeft: {
    left: 0,
    right: 'auto',
  },
  iconTooltipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#E2E8F0',
    ...(Platform.OS === 'web' ? ({ whiteSpace: 'nowrap' } as any) : null),
  },
  actionTooltip: {
    position: 'absolute',
    top: 32,
    right: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#0F172A',
    zIndex: 30,
  },
  actionTooltipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#E2E8F0',
    ...(Platform.OS === 'web' ? ({ whiteSpace: 'nowrap' } as any) : null),
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
  webGrabbingCursor: {
    ...(Platform.OS === 'web' ? ({ cursor: 'grabbing' } as any) : null),
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
