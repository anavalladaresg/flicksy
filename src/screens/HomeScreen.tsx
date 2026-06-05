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
  useWindowDimensions,
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
const HOME_CARD_WIDTH = 152;
const HOME_CARD_GAP = 12;
const HOME_CARD_SNAP = HOME_CARD_WIDTH + HOME_CARD_GAP;
// Friends activity is now a popover, no sidebar breakpoint needed
const FRIEND_ACTIVITY_PREVIEW_LIMIT = 8;
const WEB_TOP_TABS_OFFSET = 72;
const HOME_WHEEL_DEBUG = false;

const HOME_COLORS = {
  dark: {
    bg: '#0B0F14',
    surface: '#121821',
    elevated: '#1A2330',
    text: '#E6EDF3',
    subtext: '#9FB0C3',
    border: '#2A3545',
    positive: '#5BE7A9',
    red: '#FF7A7A',
    yellow: '#FFD166',
    purple: '#B388FF',
    error: '#FF5C8A',
    success: '#4ADE80',
    brand: '#7C9EFF',
  },
  light: {
    bg: '#F1EFEA',
    surface: '#F8F6F1',
    elevated: '#ECE8E0',
    text: '#0F172A',
    subtext: '#625F59',
    border: '#DED8CC',
    positive: '#0F9F6E',
    red: '#DC2626',
    yellow: '#B45309',
    purple: '#7C3AED',
    error: '#BE123C',
    success: '#16A34A',
    brand: '#0A7EA4',
  },
} as const;

type HomePalette = (typeof HOME_COLORS)[keyof typeof HOME_COLORS];
const WEB_SERIF_FONT = (Fonts as any).web?.serif || "Georgia, 'Times New Roman', serif";

function getHomePalette(dark: boolean): HomePalette {
  return dark ? HOME_COLORS.dark : HOME_COLORS.light;
}

function logHomeWheel(section: string, event: string, payload?: Record<string, unknown>) {
  if (!HOME_WHEEL_DEBUG) return;
  console.log(`[home-wheel][${section}][${new Date().toISOString()}] ${event}`, payload ?? {});
}

function useWebHorizontalWheel(options: {
  enabled: boolean;
  section: string;
  flatListRef: React.RefObject<FlatList<any> | null>;
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
  palette,
}: {
  title: string;
  type: 'movie' | 'tv' | 'game';
  items: CardItem[];
  dark: boolean;
  ownLibraryKeys: Set<string>;
  palette: HomePalette;
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
        <View>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>{title}</Text>
          <Text style={[styles.sectionEyebrow, { color: palette.subtext }]}>
            {type === 'movie' ? 'Películas' : type === 'tv' ? 'Series' : 'Videojuegos'}
          </Text>
        </View>
        <TouchableOpacity onPress={() => navigateAndBlur(`/browse/${type}`)} style={[styles.moreButton, dark && styles.moreButtonDark, Platform.OS === 'web' && styles.webPressableReset]}>
          <MaterialIcons name="chevron-right" size={20} color={dark ? palette.brand : palette.text} />
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
        {...(Platform.OS === 'web' ? ({
          // Mejorar el scroll suave en web
          style: { 
            WebkitOverflowScrolling: 'touch' as any,
          },
        } as any) : {})}
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
                <View
                  style={[
                    styles.posterFrame,
                    dark && styles.posterFrameDark,
                    Platform.OS === 'web' && hoveredCardId === item.id && styles.posterFrameHovered,
                  ]}
                >
                  <Image
                    source={item.imageUrl ? { uri: item.imageUrl } : FALLBACK_IMAGE}
                    style={styles.poster}
                    resizeMode="cover"
                  />
                </View>
                <Text numberOfLines={2} style={[styles.cardTitle, { color: palette.text }]}>
                  {item.name}
                </Text>
                <View style={[styles.cardMetaRow, dark && styles.cardMetaRowDark]}>
                  <MaterialIcons name="star-rate" size={13} color={dark ? palette.yellow : '#D97706'} />
                  <Text style={[styles.ratingText, { color: palette.subtext }]}>
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
  palette,
}: {
  title: string;
  items: RecommendationItem[];
  dark: boolean;
  onDismiss: (item: RecommendationItem) => void;
  ownLibraryKeys: Set<string>;
  palette: HomePalette;
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
        <View>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>{title}</Text>
          <Text style={[styles.sectionEyebrow, { color: palette.subtext }]}>
            Basado en tu biblioteca
          </Text>
        </View>
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
        {...(Platform.OS === 'web' ? ({
          // Mejorar el scroll suave en web
          style: { 
            WebkitOverflowScrolling: 'touch' as any,
          },
        } as any) : {})}
        renderItem={({ item, index }) => {
          const key = `${item.mediaType}-${item.id}`;
          const showDismiss = Platform.OS !== 'web' || hoveredCardKey === key || hoveredDismissKey === key;
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
                <View
                  style={[
                    styles.posterFrame,
                    dark && styles.posterFrameDark,
                    Platform.OS === 'web' && hoveredCardKey === key && styles.posterFrameHovered,
                  ]}
                >
                  <Image
                    source={item.imageUrl ? { uri: item.imageUrl } : FALLBACK_IMAGE}
                    style={styles.poster}
                    resizeMode="cover"
                  />
                </View>
                {showDismiss ? (
                  <TouchableOpacity
                    style={[
                      styles.dismissButton,
                      dark && styles.dismissButtonDark,
                      Platform.OS !== 'web' && styles.dismissButtonMobile,
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
                    <MaterialIcons name="visibility-off" size={12} color={dark ? palette.subtext : '#64748B'} />
                  </TouchableOpacity>
                ) : null}
                {Platform.OS === 'web' && hoveredDismissKey === key ? (
                  <View style={styles.actionTooltip}>
                    <Text numberOfLines={1} style={styles.actionTooltipText}>No sugerir</Text>
                  </View>
                ) : null}
                <Text numberOfLines={2} style={[styles.cardTitle, { color: palette.text }]}>
                  {item.name}
                </Text>
                <View style={styles.reasonPill}>
                  <Text numberOfLines={1} style={[styles.recommendationReason, { color: palette.subtext }]}>
                    {item.reason}
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

function statusBoost(status: TrackedItem['status']): number {
  if (status === 'completed') return 2;
  if (status === 'watching' || status === 'playing') return 1;
  if (status === 'planned') return 0.5;
  return 0;
}

function friendActionLabel(status: string, mediaType: MediaType): string {
  if (status === 'completed') return mediaType === 'game' ? 'Completó' : 'Vio';
  if (status === 'watching') return 'Está viendo';
  if (status === 'playing') return 'Está jugando';
  if (status === 'planned') return 'Añadió a su lista';
  return 'Actualizó';
}

function mediaTypeLabel(mediaType: MediaType): string {
  if (mediaType === 'movie') return 'Película';
  if (mediaType === 'tv') return 'Serie';
  return 'Juego';
}

function mediaTypeIcon(mediaType: MediaType): keyof typeof MaterialIcons.glyphMap {
  if (mediaType === 'movie') return 'movie-filter';
  if (mediaType === 'tv') return 'live-tv';
  return 'sports-esports';
}

function FriendActivityListItem({
  item,
  dark,
  ownLibraryKeys,
  palette,
  compact = false,
}: {
  item: FriendActivityItem;
  dark: boolean;
  ownLibraryKeys: Set<string>;
  palette: HomePalette;
  compact?: boolean;
}) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);
  const [hoveredLibrary, setHoveredLibrary] = useState(false);
  const libraryKey = `${item.mediaType}-${item.externalId}`;
  const isInLibrary = ownLibraryKeys.has(libraryKey);
  const actionText = friendActionLabel(item.status, item.mediaType).toLowerCase();
  const activityDate = new Date(item.activityDate).toLocaleDateString('es-ES');

  const navigateAndBlur = () => {
    router.push(`/${item.mediaType}/${item.externalId}` as any);
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      (document.activeElement as HTMLElement | null)?.blur?.();
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.friendActivityItem,
        dark && styles.friendActivityItemDark,
        compact && styles.friendActivityItemCompact,
        Platform.OS === 'web' && hovered && styles.friendActivityItemHovered,
        Platform.OS === 'web' && styles.webPressableReset,
      ]}
      activeOpacity={0.82}
      onPress={navigateAndBlur}
      {...(Platform.OS === 'web'
        ? {
            onMouseEnter: () => setHovered(true),
            onMouseLeave: () => {
              setHovered(false);
              setHoveredLibrary(false);
            },
          }
        : {})}
    >
      <View style={[styles.friendActivityIcon, dark && styles.friendActivityIconDark]}>
        <MaterialIcons name={mediaTypeIcon(item.mediaType)} size={compact ? 15 : 16} color={palette.brand} />
      </View>
      <View style={styles.friendActivityCopy}>
        <Text numberOfLines={1} style={[styles.friendActivityPrimary, { color: palette.subtext }]}>
          <Text style={[styles.friendActivityName, { color: palette.text }]}>{item.friendName}</Text>
          <Text> {actionText} </Text>
          <Text style={[styles.friendActivityTitle, { color: palette.text }]}>{item.title}</Text>
        </Text>
        <Text numberOfLines={1} style={[styles.friendActivityMeta, { color: palette.subtext }]}>
          {mediaTypeLabel(item.mediaType)} · {activityDate}
        </Text>
      </View>
      {isInLibrary ? (
        <View
          style={styles.friendActivityBadgeWrap}
          {...(Platform.OS === 'web'
            ? {
                onMouseEnter: () => setHoveredLibrary(true),
                onMouseLeave: () => setHoveredLibrary(false),
              }
            : {})}
        >
          <View style={styles.friendActivityBadge}>
            <MaterialIcons name="library-add-check" size={10} color="#E0F2FE" />
          </View>
          {Platform.OS === 'web' && hoveredLibrary ? (
            <View style={[styles.iconTooltip, styles.friendActivityTooltip]}>
              <Text numberOfLines={1} style={styles.iconTooltipText}>Ya añadido</Text>
            </View>
          ) : null}
        </View>
      ) : null}
      <MaterialIcons name="chevron-right" size={15} color={palette.subtext} />
    </TouchableOpacity>
  );
}

function FriendsActivityPopover({
  items,
  dark,
  ownLibraryKeys,
  palette,
  isOpen,
  onClose,
  buttonLayout,
  windowWidth,
  isMobile,
}: {
  items: FriendActivityItem[];
  dark: boolean;
  ownLibraryKeys: Set<string>;
  palette: HomePalette;
  isOpen: boolean;
  onClose: () => void;
  buttonLayout: { x: number; y: number; width: number; height: number } | null;
  windowWidth: number;
  isMobile: boolean;
}) {
  const visibleItems = items.slice(0, FRIEND_ACTIVITY_PREVIEW_LIMIT);

  if (!isOpen) return null;

  // Calcula posición del popover justo debajo del botón
  const POPOVER_WIDTH = isMobile ? Math.min(windowWidth - 32, 310) : 300;
  const POPOVER_GAP = 8; // espacio entre botón y popover

  // top: justo debajo del botón
  const popoverTop = buttonLayout ? buttonLayout.y + buttonLayout.height + POPOVER_GAP : 120;

  // right: alineado al borde derecho del botón, sin salirse de pantalla
  let popoverRight = 16;
  if (buttonLayout && !isMobile) {
    // windowWidth - (buttonLayout.x + buttonLayout.width) es la distancia del borde del botón al borde derecho de la ventana
    const rightEdge = windowWidth - (buttonLayout.x + buttonLayout.width);
    popoverRight = Math.max(8, rightEdge - 2); // -2 para alinear visualmente
  }

  const popoverStyle = isMobile
    ? [styles.friendPopoverMobile, dark && styles.friendPopoverDark, { top: popoverTop }]
    : [
        styles.friendPopover,
        dark && styles.friendPopoverDark,
        { top: popoverTop, right: popoverRight, width: POPOVER_WIDTH },
      ];

  const panelContent = (
    <View
      style={popoverStyle as any}
      {...(Platform.OS === 'web' ? ({ role: 'dialog', 'aria-label': 'Actividad de amigos' } as any) : {})}
    >
      {/* Cabecera compacta del popover */}
      <View style={styles.friendPopoverHeader}>
        <MaterialIcons name="groups" size={14} color={palette.brand} style={{ flexShrink: 0 } as any} />
        <View style={styles.friendPopoverHeaderText}>
          <Text style={[styles.friendPopoverTitle, { color: palette.text }]} numberOfLines={1}>
            Actividad de amigos
          </Text>
          {items.length > 0 ? (
            <Text numberOfLines={1} style={[styles.friendPopoverSubtitle, { color: palette.subtext }]}>
              {items.length} movimientos recientes
            </Text>
          ) : null}
        </View>
        <TouchableOpacity
          onPress={onClose}
          style={[styles.friendPopoverClose, dark && styles.friendPopoverCloseDark, Platform.OS === 'web' && styles.webPressableReset]}
          activeOpacity={0.7}
        >
          <MaterialIcons name="close" size={13} color={palette.subtext} />
        </TouchableOpacity>
      </View>
      {/* Lista con scroll interno */}
      {visibleItems.length === 0 ? (
        <Text style={[styles.friendPanelEmptyText, { color: palette.subtext }]}>
          Añade amigas/os en Perfil para ver su actividad aquí.
        </Text>
      ) : (
        <ScrollView
          style={styles.friendPopoverScroll}
          contentContainerStyle={styles.friendPopoverList}
          showsVerticalScrollIndicator={false}
          bounces={false}
          keyboardShouldPersistTaps="handled"
        >
          {visibleItems.map((item) => (
            <FriendActivityListItem
              key={item.id}
              item={item}
              dark={dark}
              ownLibraryKeys={ownLibraryKeys}
              palette={palette}
              compact
            />
          ))}
        </ScrollView>
      )}
    </View>
  );

  return (
    <>
      {/* Overlay invisible para cerrar al pulsar fuera */}
      <TouchableOpacity
        style={styles.popoverOverlay}
        activeOpacity={1}
        onPress={onClose}
        {...(Platform.OS === 'web' ? ({ 'aria-label': 'Cerrar actividad de amigos' } as any) : {})}
      />
      {panelContent}
    </>
  );
}

function HomeScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const palette = getHomePalette(isDark);
  const isWeb = Platform.OS === 'web';
  const { width: windowWidth } = useWindowDimensions();
  const isWebMobile = isWeb && windowWidth < 860;
  const isMobilePopover = !isWeb || isWebMobile;
  const RootContainer = isWeb ? View : SafeAreaView;
  const [friendsPopoverOpen, setFriendsPopoverOpen] = useState(false);
  const [buttonLayout, setButtonLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const friendsButtonRef = useRef<View | null>(null);
  const heroEntrance = useRef(new Animated.Value(0)).current;
  const glowPulse = useRef(new Animated.Value(0)).current;
  const trackedItems = (useTrackingStore((state: any) => state.items) ?? []) as TrackedItem[];
  const ownLibraryKeys = useMemo(
    () => new Set<string>(trackedItems.map((item) => `${item.mediaType}-${item.externalId}`)),
    [trackedItems]
  );
  const dismissedRecommendationKeys = usePreferencesStore(
    (state: any) => state.dismissedRecommendationKeys as string[]
  );
  const dismissRecommendation = usePreferencesStore(
    (state: any) => state.dismissRecommendation as (key: string) => void
  );
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
      <RootContainer style={[styles.centered, { backgroundColor: palette.bg }]}>
        <MagicLoader size={58} text="Cargando populares..." />
      </RootContainer>
    );
  }

  if (allFailed) {
    return (
      <RootContainer style={[styles.centered, { backgroundColor: palette.bg }]}>
        <Text style={[styles.errorTitle, { color: palette.error }]}>No pudimos cargar el contenido</Text>
        <Text style={[styles.errorSubtitle, { color: palette.subtext }]}>Verifica tus claves de TMDB e IGDB y recarga la app.</Text>
      </RootContainer>
    );
  }

  return (
    <RootContainer style={[styles.container, { backgroundColor: palette.bg }]}>
      <View pointerEvents="none" style={styles.backgroundLayer}>
        <View style={[styles.backgroundGlowA, !isDark && styles.backgroundGlowALight]} />
        <View style={[styles.backgroundGlowB, !isDark && styles.backgroundGlowBLight]} />
        <View style={[styles.backgroundShade, !isDark && styles.backgroundShadeLight]} />
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isWeb && styles.scrollContentWeb,
          isWebMobile && styles.scrollContentWebMobile,
        ]}
      >
        <View style={styles.homeLayout}>
          <View style={styles.homeMainColumn}>
            <Animated.View
              style={[
                styles.hero,
                isDark && styles.heroDark,
                isWebMobile && styles.heroMobile,
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
                  outputRange: [0.28, 0.44],
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
                      outputRange: [0.34, 0.18],
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
              <View pointerEvents="none" style={[styles.heroSheen, !isDark && styles.heroSheenLight]} />
              <View style={styles.heroKickerRow}>
                <View style={[styles.heroSignalDot, { backgroundColor: palette.positive }]} />
                <Text style={[styles.heroKickerText, { color: palette.subtext }]}>Catálogo vivo</Text>
              </View>
              <View style={styles.heroMainRow}>
                <View style={styles.heroCopy}>
                  <Text style={[styles.heroTitle, { color: palette.text }]}>Flicksy</Text>
                  <Text style={[styles.heroSubtitle, { color: palette.subtext }]}>Películas, series y videojuegos en un radar personal.</Text>
                </View>
                <View style={[styles.heroPill, isDark && styles.heroPillDark]}>
                  {isWeb ? (
                    <Image source={{ uri: '/icon-192.png' }} style={styles.heroPillLogo} resizeMode="contain" />
                  ) : (
                    <MaterialIcons name="auto-awesome" size={26} color={palette.brand} />
                  )}
                </View>
              </View>
              <View style={styles.heroBadgesRow}>
                <View style={[styles.heroBadge, isDark && styles.heroBadgeDark]}>
                  <MaterialIcons name="movie-filter" size={13} color={isDark ? palette.brand : palette.brand} />
                  <Text style={[styles.heroBadgeText, { color: palette.text }]}>Películas</Text>
                </View>
                <View style={[styles.heroBadge, isDark && styles.heroBadgeDark]}>
                  <MaterialIcons name="live-tv" size={13} color={isDark ? palette.purple : palette.brand} />
                  <Text style={[styles.heroBadgeText, { color: palette.text }]}>Series</Text>
                </View>
                <View style={[styles.heroBadge, isDark && styles.heroBadgeDark]}>
                  <MaterialIcons name="sports-esports" size={13} color={isDark ? palette.positive : palette.brand} />
                  <Text style={[styles.heroBadgeText, { color: palette.text }]}>Juegos</Text>
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
              <View style={[styles.sectionLabelMark, { backgroundColor: isDark ? 'rgba(91,231,169,0.1)' : 'rgba(15,159,110,0.09)' }]}>
                <MaterialIcons name="auto-awesome" size={17} color={palette.positive} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.sectionLabelText, { color: palette.text }]}>Para ti</Text>
                <Text style={[styles.sectionLabelSubtext, { color: palette.subtext }]}>Recomendaciones y descubrimiento personal</Text>
              </View>
              {/* Pill-botón de actividad de amigos — abre popover flotante */}
              <TouchableOpacity
                ref={friendsButtonRef}
                style={[
                  styles.friendsPopoverButton,
                  isDark && styles.friendsPopoverButtonDark,
                  friendsPopoverOpen && styles.friendsPopoverButtonActive,
                  friendsPopoverOpen && isDark && styles.friendsPopoverButtonActiveDark,
                  Platform.OS === 'web' && styles.webPressableReset,
                ]}
                activeOpacity={0.78}
                onPress={() => {
                  // Medir posición real en el momento del press para posicionar el popover correctamente
                  if (friendsButtonRef.current && typeof friendsButtonRef.current.measure === 'function') {
                    friendsButtonRef.current.measure((_x, _y, w, h, px, py) => {
                      setButtonLayout({ x: px, y: py, width: w, height: h });
                      setFriendsPopoverOpen((prev) => !prev);
                    });
                  } else {
                    setFriendsPopoverOpen((prev) => !prev);
                  }
                }}
                accessibilityLabel="Actividad de amigos"
                onLayout={(e) => {
                  // Medida inicial de respaldo (sin scroll relativo)
                  const { x, y, width, height } = e.nativeEvent.layout;
                  if (!buttonLayout) {
                    setButtonLayout({ x, y, width, height });
                  }
                }}
              >
                <MaterialIcons
                  name="groups"
                  size={14}
                  color={friendsPopoverOpen ? palette.brand : palette.subtext}
                />
                <Text
                  style={[
                    styles.friendsPillText,
                    { color: friendsPopoverOpen ? palette.brand : palette.subtext },
                  ]}
                  numberOfLines={1}
                >
                  {'Amigos'}{friendsActivity.length > 0 ? ` · ${friendsActivity.length}` : ''}
                </Text>
                {friendsActivity.length > 0 && !friendsPopoverOpen ? (
                  <View style={[styles.friendsBadgeDot, { backgroundColor: palette.positive }]} />
                ) : null}
              </TouchableOpacity>
            </Animated.View>
            <PersonalizedRow
              title="Recomendaciones"
              items={personalized.safe}
              dark={isDark}
              onDismiss={handleDismissRecommendation}
              ownLibraryKeys={ownLibraryKeys}
              palette={palette}
            />
            <PersonalizedRow
              title="Descubrimiento"
              items={personalized.discovery}
              dark={isDark}
              onDismiss={handleDismissRecommendation}
              ownLibraryKeys={ownLibraryKeys}
              palette={palette}
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
              <View style={[styles.sectionLabelMark, { backgroundColor: isDark ? 'rgba(124,158,255,0.11)' : 'rgba(10,126,164,0.08)' }]}>
                <MaterialIcons name="local-fire-department" size={17} color={palette.brand} />
              </View>
              <View>
                <Text style={[styles.sectionLabelText, { color: palette.text }]}>Tendencias mundiales</Text>
                <Text style={[styles.sectionLabelSubtext, { color: palette.subtext }]}>Lo que más se está moviendo ahora</Text>
              </View>
            </Animated.View>

            {moviesQuery.isError ? (
              <Text style={[styles.sectionError, { color: palette.error }]}>No se pudieron cargar películas.</Text>
            ) : (
              <SectionRow title="Películas más vistas" type="movie" items={movies} dark={isDark} ownLibraryKeys={ownLibraryKeys} palette={palette} />
            )}

            {tvQuery.isError ? (
              <Text style={[styles.sectionError, { color: palette.error }]}>No se pudieron cargar series.</Text>
            ) : (
              <SectionRow title="Series más vistas" type="tv" items={tvShows} dark={isDark} ownLibraryKeys={ownLibraryKeys} palette={palette} />
            )}

            {gamesQuery.isError ? (
              <Text style={[styles.sectionError, { color: palette.error }]}>No se pudieron cargar videojuegos.</Text>
            ) : (
              <SectionRow title="Juegos más jugados" type="game" items={games} dark={isDark} ownLibraryKeys={ownLibraryKeys} palette={palette} />
            )}
          </View>
        </View>
      </ScrollView>
      {/* Popover flotante de actividad de amigos — se superpone sin afectar al layout */}
      <FriendsActivityPopover
        items={friendsActivity}
        dark={isDark}
        ownLibraryKeys={ownLibraryKeys}
        palette={palette}
        isOpen={friendsPopoverOpen}
        onClose={() => setFriendsPopoverOpen(false)}
        buttonLayout={buttonLayout}
        windowWidth={windowWidth}
        isMobile={isMobilePopover}
      />
    </RootContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    // overflow hidden en nativo para los glows decorativos; en web lo desactivamos
    // para que el popover flotante no quede recortado
    ...(Platform.OS === 'web' ? { overflow: 'visible' } : { overflow: 'hidden' }),
  },
  scrollContent: {
    paddingBottom: 36,
  },
  scrollContentWeb: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    paddingTop: WEB_TOP_TABS_OFFSET,
    paddingHorizontal: 10,
  },
  scrollContentWebMobile: {
    paddingTop: 0,
    paddingHorizontal: 0,
  },
  homeLayout: {
    width: '100%',
  },
  homeMainColumn: {
    flex: 1,
    minWidth: 0,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  backgroundLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
  },
  backgroundGlowA: {
    position: 'absolute',
    width: 780,
    height: 780,
    borderRadius: 390,
    backgroundColor: 'rgba(124, 158, 255, 0.035)',
    top: -430,
    right: -340,
  },
  backgroundGlowALight: {
    backgroundColor: 'rgba(122, 112, 96, 0.035)',
  },
  backgroundGlowB: {
    position: 'absolute',
    width: 620,
    height: 620,
    borderRadius: 310,
    backgroundColor: 'rgba(91, 231, 169, 0.024)',
    top: 220,
    left: -310,
  },
  backgroundGlowBLight: {
    backgroundColor: 'rgba(10, 126, 164, 0.026)',
  },
  backgroundShade: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(11,15,20,0.12)',
  },
  backgroundShadeLight: {
    backgroundColor: 'rgba(241,239,234,0.58)',
  },
  hero: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 10,
    borderRadius: 26,
    backgroundColor: 'rgba(248,246,241,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(222,216,204,0.72)',
    paddingHorizontal: 22,
    paddingVertical: 17,
    overflow: 'hidden',
    ...(Platform.OS === 'web' && {
      backgroundImage: 'linear-gradient(135deg, rgba(248,246,241,0.96), rgba(236,232,224,0.68) 54%, rgba(248,246,241,0.9))',
      boxShadow: '0 20px 52px rgba(67, 56, 39, 0.1), inset 0 1px 0 rgba(255,255,255,0.58)',
    } as any),
  },
  heroDark: {
    backgroundColor: 'rgba(18, 24, 33, 0.72)',
    borderColor: 'rgba(42, 53, 69, 0.46)',
    ...(Platform.OS === 'web' && {
      backgroundImage: 'linear-gradient(135deg, rgba(18,24,33,0.9), rgba(26,35,48,0.56) 52%, rgba(11,15,20,0.88))',
      boxShadow: '0 22px 58px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(230,237,243,0.04)',
      backdropFilter: 'blur(18px)' as any,
    } as any),
  },
  heroMobile: {
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  heroGlowA: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(124, 158, 255, 0.08)',
    top: -82,
    right: -64,
  },
  heroGlowAWebAligned: {
    top: -92,
    right: -82,
  },
  heroGlowB: {
    position: 'absolute',
    width: 148,
    height: 148,
    borderRadius: 74,
    backgroundColor: 'rgba(91, 231, 169, 0.038)',
    bottom: -82,
    left: -46,
  },
  heroSheen: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: '52%',
    opacity: 0.78,
    ...(Platform.OS === 'web' && {
      backgroundImage: 'linear-gradient(118deg, rgba(124,158,255,0) 0%, rgba(124,158,255,0.055) 48%, rgba(91,231,169,0.018) 100%)',
    } as any),
  },
  heroSheenLight: {
    opacity: 0.58,
    ...(Platform.OS === 'web' && {
      backgroundImage: 'linear-gradient(118deg, rgba(122,112,96,0) 0%, rgba(122,112,96,0.06) 48%, rgba(10,126,164,0.018) 100%)',
    } as any),
  },
  heroKickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  heroSignalDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    boxShadow: '0 0 12px rgba(91,231,169,0.56)',
  },
  heroKickerText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  heroMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 18,
  },
  heroCopy: {
    flex: 1,
  },
  heroPill: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 52,
    height: 52,
    backgroundColor: 'rgba(248,246,241,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(124,158,255,0.22)',
    borderRadius: 999,
    zIndex: 2,
    ...(Platform.OS === 'web' && {
      boxShadow: '0 12px 28px rgba(67,56,39,0.12)',
    } as any),
  },
  heroPillDark: {
    backgroundColor: 'rgba(26,35,48,0.68)',
    borderColor: 'rgba(124,158,255,0.28)',
    ...(Platform.OS === 'web' && {
      boxShadow: '0 13px 32px rgba(0,0,0,0.28), 0 0 22px rgba(124,158,255,0.08)',
    } as any),
  },
  heroPillLogo: {
    width: 41,
    height: 41,
    borderRadius: 20.5,
  },
  heroTitle: {
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: 0,
    ...(Platform.OS === 'web' && {
      fontFamily: WEB_SERIF_FONT,
    }),
  },
  heroSubtitle: {
    marginTop: 5,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    maxWidth: 560,
  },
  heroBadgesRow: {
    marginTop: 14,
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
    backgroundColor: 'rgba(248,246,241,0.58)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroBadgeDark: {
    borderColor: 'rgba(42,53,69,0.42)',
    backgroundColor: 'rgba(26,35,48,0.34)',
  },
  heroBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    paddingHorizontal: 4,
    marginTop: 20,
    marginBottom: 10,
    paddingVertical: 4,
  },
  sectionLabelRowDark: {
    backgroundColor: 'transparent',
  },
  sectionLabelMark: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(124,158,255,0.18)',
  },
  sectionLabelText: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 24,
  },
  sectionLabelSubtext: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '700',
  },
  section: {
    marginTop: 16,
    marginHorizontal: 16,
  },
  sectionCard: {
    borderRadius: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    paddingVertical: 4,
    ...(Platform.OS === 'web' && {
      boxShadow: 'none',
      backdropFilter: 'none' as any,
      overflow: 'visible',
    } as any),
  },
  sectionCardDark: {
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    ...(Platform.OS === 'web' && {
      boxShadow: 'none',
      backdropFilter: 'none' as any,
    } as any),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '900',
    ...(Platform.OS === 'web' && {
      fontFamily: WEB_SERIF_FONT,
      letterSpacing: 0,
    }),
  },
  sectionEyebrow: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  // ── Pill-botón de amigos (junto al label "Para ti") ──────────────────────
  friendsPopoverButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(236,232,224,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(122,112,96,0.16)',
    position: 'relative',
    flexShrink: 0,
    ...(Platform.OS === 'web' && {
      transitionDuration: '150ms',
      transitionProperty: 'background-color, border-color, box-shadow',
      transitionTimingFunction: 'cubic-bezier(0.22,1,0.36,1)',
      cursor: 'pointer',
    } as any),
  },
  friendsPopoverButtonDark: {
    backgroundColor: 'rgba(26,35,48,0.68)',
    borderColor: 'rgba(42,53,69,0.55)',
  },
  friendsPopoverButtonActive: {
    borderColor: 'rgba(10,126,164,0.36)',
    backgroundColor: 'rgba(10,126,164,0.08)',
    ...(Platform.OS === 'web' && {
      boxShadow: '0 0 0 2px rgba(10,126,164,0.1)',
    } as any),
  },
  friendsPopoverButtonActiveDark: {
    borderColor: 'rgba(124,158,255,0.42)',
    backgroundColor: 'rgba(124,158,255,0.08)',
    ...(Platform.OS === 'web' && {
      boxShadow: '0 0 0 2px rgba(124,158,255,0.08)',
    } as any),
  },
  friendsPillText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  friendsBadgeDot: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    borderWidth: 1,
    borderColor: 'rgba(248,246,241,0.9)',
  },
  // ── Overlay y popover flotante ───────────────────────────────────────────
  popoverOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 90,
  },
  // Popover desktop: flotante, posición calculada dinámicamente
  friendPopover: {
    position: 'absolute',
    // top y right se inyectan inline dinámicamente
    zIndex: 100,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(122,112,96,0.12)',
    backgroundColor: 'rgba(250,248,244,0.97)',
    padding: 10,
    ...(Platform.OS === 'web' && {
      boxShadow: '0 6px 24px rgba(67,56,39,0.11), 0 1px 4px rgba(67,56,39,0.06)',
      backdropFilter: 'blur(28px)' as any,
      WebkitBackdropFilter: 'blur(28px)' as any,
    } as any),
  },
  // Popover móvil: ocupa casi todo el ancho, alineado al borde izquierdo
  friendPopoverMobile: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 100,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(122,112,96,0.12)',
    backgroundColor: 'rgba(250,248,244,0.98)',
    padding: 10,
    ...(Platform.OS === 'web' && {
      boxShadow: '0 6px 20px rgba(67,56,39,0.1)',
      backdropFilter: 'blur(24px)' as any,
    } as any),
  },
  friendPopoverDark: {
    borderColor: 'rgba(42,53,69,0.44)',
    backgroundColor: 'rgba(18,24,33,0.97)',
    ...(Platform.OS === 'web' && {
      boxShadow: '0 6px 28px rgba(0,0,0,0.42), inset 0 1px 0 rgba(230,237,243,0.03)',
    } as any),
  },
  friendPopoverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(122,112,96,0.08)',
  },
  // (friendPopoverIcon y friendPopoverIconDark ya no se usan en la cabecera pero se mantienen por si acaso)
  friendPopoverIcon: {
    flexShrink: 0,
  },
  friendPopoverIconDark: {},
  friendPopoverHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  friendPopoverTitle: {
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 15,
  },
  friendPopoverSubtitle: {
    marginTop: 1,
    fontSize: 9,
    fontWeight: '600',
    lineHeight: 12,
    opacity: 0.6,
  },
  friendPopoverClose: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(236,232,224,0.54)',
    borderWidth: 1,
    borderColor: 'rgba(122,112,96,0.12)',
    flexShrink: 0,
  },
  friendPopoverCloseDark: {
    backgroundColor: 'rgba(42,53,69,0.45)',
    borderColor: 'rgba(42,53,69,0.48)',
  },
  friendPopoverScroll: {
    maxHeight: 300,
  },
  friendPopoverList: {
    gap: 1,
    paddingBottom: 1,
  },
  friendPanelEmptyText: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
    paddingVertical: 6,
    opacity: 0.65,
  },
  friendActivityItem: {
    minHeight: 0,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 5,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    position: 'relative',
    overflow: 'visible',
    ...(Platform.OS === 'web' && {
      transitionDuration: '140ms',
      transitionProperty: 'background-color',
      transitionTimingFunction: 'ease',
    } as any),
  },
  friendActivityItemDark: {
    backgroundColor: 'transparent',
  },
  friendActivityItemCompact: {
    minHeight: 0,
    borderRadius: 8,
    paddingVertical: 4,
  },
  friendActivityItemHovered: {
    backgroundColor: 'rgba(124,158,255,0.07)',
  },
  friendActivityIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    flexShrink: 0,
  },
  friendActivityIconDark: {
    backgroundColor: 'transparent',
  },
  friendActivityCopy: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  friendActivityPrimary: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 14,
  },
  friendActivityName: {
    fontWeight: '800',
  },
  friendActivityTitle: {
    fontWeight: '700',
  },
  friendActivityMeta: {
    marginTop: 1,
    fontSize: 9,
    fontWeight: '500',
    lineHeight: 11,
    opacity: 0.55,
  },
  friendActivityBadgeWrap: {
    position: 'relative',
    flexShrink: 0,
    overflow: 'visible',
  },
  friendActivityBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(26,35,48,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(91,231,169,0.42)',
  },
  friendActivityTooltip: {
    top: 24,
    right: -10,
  },
  moreButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(236,232,224,0.68)',
    borderWidth: 1,
    borderColor: 'rgba(122,112,96,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreButtonDark: {
    backgroundColor: 'rgba(26,35,48,0.72)',
    borderColor: 'rgba(124,158,255,0.18)',
  },
  listContent: {
    paddingHorizontal: 0,
    paddingRight: 18,
    paddingTop: 2,
    paddingBottom: 8,
  },
  card: {
    width: HOME_CARD_WIDTH,
    marginHorizontal: HOME_CARD_GAP / 2,
    position: 'relative',
    overflow: 'visible',
  },
  poster: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1A2330',
    ...(Platform.OS === 'web' && {
      transitionDuration: '220ms',
      transitionProperty: 'transform, opacity',
      transitionTimingFunction: 'cubic-bezier(0.22,1,0.36,1)',
    } as any),
  },
  posterFrame: {
    width: HOME_CARD_WIDTH,
    height: 228,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#E8E2D8',
    borderWidth: 1,
    borderColor: 'rgba(122,112,96,0.14)',
    ...(Platform.OS === 'web' && {
      transitionDuration: '220ms',
      transitionProperty: 'transform, box-shadow, border-color',
      transitionTimingFunction: 'cubic-bezier(0.22,1,0.36,1)',
    } as any),
  },
  posterFrameDark: {
    backgroundColor: '#1A2330',
    borderColor: 'rgba(42,53,69,0.48)',
  },
  posterFrameHovered: {
    boxShadow: '0 18px 36px rgba(0,0,0,0.34), 0 0 0 1px rgba(124,158,255,0.16)',
    borderColor: 'rgba(124,158,255,0.28)',
    transform: [{ scale: 1.018 }],
    zIndex: 8,
  },
  cardTitle: {
    width: HOME_CARD_WIDTH,
    marginTop: 8,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17,
    minHeight: 34,
    paddingRight: 0,
    textAlign: 'left',
  },
  cardMetaRow: {
    alignSelf: 'flex-start',
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: 'rgba(236,232,224,0.68)',
    gap: 4,
  },
  cardMetaRowDark: {
    backgroundColor: 'rgba(26,35,48,0.58)',
    borderWidth: 1,
    borderColor: 'rgba(42,53,69,0.46)',
  },
  reasonPill: {
    alignSelf: 'flex-start',
    marginTop: 1,
    width: HOME_CARD_WIDTH,
    paddingRight: 0,
  },
  recommendationReason: {
    width: '100%',
    fontSize: 9,
    fontWeight: '600',
    lineHeight: 12,
    opacity: 0.58,
    textAlign: 'left',
  },
  dismissButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(248,246,241,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(122,112,96,0.12)',
    zIndex: 20,
    opacity: 0.58,
  },
  dismissButtonDark: {
    backgroundColor: 'rgba(11,15,20,0.34)',
    borderColor: 'rgba(159,176,195,0.12)',
    opacity: 0.48,
  },
  dismissButtonMobile: {
    opacity: 0.3,
  },
  inLibraryBadgeWrap: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 24,
    overflow: 'visible',
  },
  inLibraryBadgeWrapLeft: {
    left: 8,
    right: 'auto',
  },
  inLibraryBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A2330',
    borderWidth: 1,
    borderColor: 'rgba(91,231,169,0.55)',
    boxShadow: '0 8px 18px rgba(0,0,0,0.28)',
  },
  iconTooltip: {
    position: 'absolute',
    top: 31,
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
    top: 39,
    right: 2,
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
    fontSize: 11,
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
