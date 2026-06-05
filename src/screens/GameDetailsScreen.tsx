/**
 * Pantalla de detalles de videojuego
 */

import { MaterialIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DetailBodyLayout from '../components/detail/DetailBodyLayout';
import DetailHero from '../components/detail/DetailHero';
import DetailMyLibraryCard from '../components/detail/DetailMyLibraryCard';
import { createDetailStyles } from '../components/detail/createDetailStyles';
import { getDetailPalette } from '../components/detail/detailTheme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import MagicLoader from '@/components/loaders/MagicLoader';
import CenteredOverlay from '@/components/layout/CenteredOverlay';
import {
    Alert,
    Image,
    Modal,
    Platform,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import FriendsRatingsBlock from '../components/common/FriendsRatingsBlock';
import { RatingPickerModal } from '../components/common/RatingPickerModal';
import { useGameDetails } from '../features/games/presentation/hooks';
import { getFriendLibraryItem, getFriendsRatingsForItem, type FriendItemRating } from '../services/social';
import { useTrackingStore } from '../store/tracking';
import type { TrackedItem } from '../types';

interface GameDetailsScreenProps {
  route: any;
  navigation: any;
}

const GameDetailsScreen: React.FC<GameDetailsScreenProps> = ({
  route,
  navigation,
}) => {
  const RootContainer = Platform.OS === 'web' ? View : SafeAreaView;
  const isDark = useColorScheme() === 'dark';
  const palette = getDetailPalette(isDark);
  const detailStyles = useMemo(() => createDetailStyles(palette), [palette]);
  const { gameId, fromFriendId, fromFriendName } = route.params;
  const { data: game, isLoading, isError, refetch } = useGameDetails(gameId);
  const addTrackedItem = useTrackingStore((state) => state.addItem);
  const updateTrackedItem = useTrackingStore((state) => state.updateItem);
  const removeTrackedItem = useTrackingStore((state) => state.removeItem);
  const trackedItems = useTrackingStore((state) => state.items);
  const [isRatingOpen, setIsRatingOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [status, setStatus] = useState<'planned' | 'playing' | 'completed'>('completed');
  const [startedAt, setStartedAt] = useState('');
  const [finishedAt, setFinishedAt] = useState('');
  const [startedAtApproximate, setStartedAtApproximate] = useState(false);
  const [finishedAtApproximate, setFinishedAtApproximate] = useState(false);
  const [friendTrackedItem, setFriendTrackedItem] = useState<TrackedItem | null>(null);
  const [friendsRatings, setFriendsRatings] = useState<FriendItemRating[]>([]);
  const [selectedScreenshotUrl, setSelectedScreenshotUrl] = useState<string | null>(null);
  const [screenshotZoom, setScreenshotZoom] = useState(1);
  const [screenshotViewport, setScreenshotViewport] = useState({ width: 0, height: 0 });
  const [screenshotNaturalSize, setScreenshotNaturalSize] = useState({ width: 0, height: 0 });
  const [screenshotPan, setScreenshotPan] = useState({ x: 0, y: 0 });
  const [isScreenshotDragging, setIsScreenshotDragging] = useState(false);
  const screenshotDragStartRef = useRef<{
    clientX: number;
    clientY: number;
    startX: number;
    startY: number;
  } | null>(null);

  const isTracked = trackedItems.some(
    (item) => item.externalId === gameId && item.mediaType === 'game'
  );
  const trackedGameItem = trackedItems.find(
    (item) => item.externalId === gameId && item.mediaType === 'game'
  );
  const visibleFriendsRatings = fromFriendId
    ? friendsRatings.filter((entry) => entry.friendId !== fromFriendId)
    : friendsRatings;

  useEffect(() => {
    if (!fromFriendId || !gameId) {
      setFriendTrackedItem(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const item = await getFriendLibraryItem(fromFriendId, 'game', gameId);
      if (!cancelled) setFriendTrackedItem(item);
    })();
    return () => {
      cancelled = true;
    };
  }, [fromFriendId, gameId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ratings = await getFriendsRatingsForItem('game', gameId);
      if (!cancelled) setFriendsRatings(ratings);
    })();
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  function statusLabel(value: 'planned' | 'playing' | 'completed') {
    if (value === 'planned') return 'Pendiente';
    if (value === 'playing') return 'Jugando';
    return 'Jugado';
  }

  function ratingValue(value: number) {
    if (!value) return '0.0/10';
    return `${value.toFixed(1)}/10`;
  }

  function statusTone(value: 'planned' | 'playing' | 'completed') {
    if (value === 'planned') return { color: '#64748B', bg: '#F1F5F9', border: '#CBD5E1' };
    if (value === 'playing') return { color: '#6D28D9', bg: '#F3E8FF', border: '#C4B5FD' };
    return { color: '#15803D', bg: '#DCFCE7', border: '#86EFAC' };
  }

  function formatShortDate(value?: string): string {
    if (!value) return 'sin fecha';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }
  const gameCoverUrl = game?.cover?.image_id
    ? `https://images.igdb.com/igdb/image/upload/t_1080p/${game.cover.image_id}.jpg`
    : game?.cover?.url
      ? `https:${game.cover.url}`.replace('/t_thumb/', '/t_1080p/')
      : null;
  const developerStudios = Array.from(
    new Set(
      (game?.involved_companies ?? [])
        .filter((entry) => entry.developer)
        .map((entry) => entry.company?.name)
        .filter((name): name is string => Boolean(name))
    )
  );
  const screenshotUrls = (game?.screenshots ?? [])
    .map((shot) =>
      shot.image_id
        ? `https://images.igdb.com/igdb/image/upload/t_screenshot_big/${shot.image_id}.jpg`
        : shot.url
          ? shot.url.startsWith('//')
            ? `https:${shot.url}`.replace('/t_thumb/', '/t_screenshot_big/')
            : shot.url.replace('/t_thumb/', '/t_screenshot_big/')
          : null
    )
    .filter((url): url is string => Boolean(url))
    .slice(0, 10);
  const summaryText = game?.summary?.trim() || 'Resumen no disponible en español por ahora.';
  const storylineText = game?.storyline?.trim() || 'Historia no disponible en español por ahora.';

  useEffect(() => {
    if (!selectedScreenshotUrl) return;
    setScreenshotZoom(1);
    setScreenshotNaturalSize({ width: 0, height: 0 });
    setScreenshotPan({ x: 0, y: 0 });
    screenshotDragStartRef.current = null;
    setIsScreenshotDragging(false);
  }, [selectedScreenshotUrl]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !selectedScreenshotUrl) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      (event as any).stopImmediatePropagation?.();
      setSelectedScreenshotUrl(null);
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [selectedScreenshotUrl]);

  const fittedScreenshotSize = (() => {
    if (!screenshotViewport.width || !screenshotViewport.height || !screenshotNaturalSize.width || !screenshotNaturalSize.height) {
      return {
        width: screenshotViewport.width || 0,
        height: screenshotViewport.height || 0,
      };
    }

    const viewportRatio = screenshotViewport.width / screenshotViewport.height;
    const imageRatio = screenshotNaturalSize.width / screenshotNaturalSize.height;
    if (imageRatio >= viewportRatio) {
      const width = screenshotViewport.width;
      return { width, height: width / imageRatio };
    }
    const height = screenshotViewport.height;
    return { width: height * imageRatio, height };
  })();

  const clampScreenshotPan = useCallback(
    (nextX: number, nextY: number, zoomValue: number) => {
      const scaledWidth = fittedScreenshotSize.width * zoomValue;
      const scaledHeight = fittedScreenshotSize.height * zoomValue;
      const maxX = Math.max(0, (scaledWidth - screenshotViewport.width) / 2);
      const maxY = Math.max(0, (scaledHeight - screenshotViewport.height) / 2);
      return {
        x: Math.max(-maxX, Math.min(maxX, nextX)),
        y: Math.max(-maxY, Math.min(maxY, nextY)),
      };
    },
    [fittedScreenshotSize.height, fittedScreenshotSize.width, screenshotViewport.height, screenshotViewport.width]
  );

  function applyScreenshotZoom(nextValue: number) {
    const clampedZoom = Math.max(1, Math.min(4, Number(nextValue.toFixed(2))));
    setScreenshotZoom(clampedZoom);
    setScreenshotPan((prev) => clampScreenshotPan(prev.x, prev.y, clampedZoom));
  }

  function requestDeleteTrackedGame() {
    if (!trackedGameItem) return;
    if (Platform.OS === 'web') {
      const shouldDelete =
        typeof window !== 'undefined' &&
        window.confirm('¿Seguro que quieres eliminar este juego de tu biblioteca?');
      if (shouldDelete) removeTrackedItem(trackedGameItem.id);
      return;
    }
    Alert.alert(
      'Eliminar juego',
      '¿Seguro que quieres eliminar este juego de tu biblioteca?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => removeTrackedItem(trackedGameItem.id),
        },
      ]
    );
  }

  useEffect(() => {
    setScreenshotPan((prev) => {
      const next = clampScreenshotPan(prev.x, prev.y, screenshotZoom);
      if (next.x === prev.x && next.y === prev.y) return prev;
      return next;
    });
  }, [
    clampScreenshotPan,
    screenshotZoom,
    screenshotViewport.width,
    screenshotViewport.height,
    screenshotNaturalSize.width,
    screenshotNaturalSize.height,
  ]);

  const screenshotScaledSize = {
    width: Math.max(1, fittedScreenshotSize.width * screenshotZoom),
    height: Math.max(1, fittedScreenshotSize.height * screenshotZoom),
  };

  const screenshotMediaWebHandlers =
    Platform.OS === 'web'
      ? ({
          onWheel: (event: any) => {
            event.preventDefault?.();
            const deltaY = event?.deltaY ?? event?.nativeEvent?.deltaY ?? 0;
            const zoomStep = deltaY > 0 ? -0.18 : 0.18;
            applyScreenshotZoom(screenshotZoom + zoomStep);
          },
          onMouseDown: (event: any) => {
            if (screenshotZoom <= 1) return;
            event.preventDefault?.();
            const clientX = event?.clientX ?? event?.nativeEvent?.clientX ?? 0;
            const clientY = event?.clientY ?? event?.nativeEvent?.clientY ?? 0;
            screenshotDragStartRef.current = {
              clientX,
              clientY,
              startX: screenshotPan.x,
              startY: screenshotPan.y,
            };
            setIsScreenshotDragging(true);
          },
          onMouseMove: (event: any) => {
            const dragStart = screenshotDragStartRef.current;
            if (!dragStart || screenshotZoom <= 1) return;
            const clientX = event?.clientX ?? event?.nativeEvent?.clientX ?? 0;
            const clientY = event?.clientY ?? event?.nativeEvent?.clientY ?? 0;
            const next = clampScreenshotPan(
              dragStart.startX + (clientX - dragStart.clientX),
              dragStart.startY + (clientY - dragStart.clientY),
              screenshotZoom
            );
            setScreenshotPan(next);
          },
          onMouseUp: () => {
            screenshotDragStartRef.current = null;
            setIsScreenshotDragging(false);
          },
          onMouseLeave: () => {
            screenshotDragStartRef.current = null;
            setIsScreenshotDragging(false);
          },
        } as any)
      : null;

  const handleConfirmAdd = () => {
    if (!game) return;
    const canSaveScore = status !== 'planned';
    const canSaveStart = status === 'playing' || status === 'completed';
    const canSaveEnd = status === 'completed';
    if (trackedGameItem) {
      updateTrackedItem(trackedGameItem.id, {
        rating: canSaveScore ? rating : undefined,
        status,
        startedAt: canSaveStart ? startedAt.trim() || undefined : undefined,
        finishedAt: canSaveEnd ? finishedAt.trim() || undefined : undefined,
        startedAtApproximate: canSaveStart ? startedAtApproximate : false,
        finishedAtApproximate: canSaveEnd ? finishedAtApproximate : false,
        releaseYear:
          game.release_dates && game.release_dates.length > 0
            ? new Date(game.release_dates[0].date * 1000).getFullYear()
            : undefined,
        genres: game.genres?.map((genre) => genre.name) ?? [],
        platforms: game.platforms?.map((platform) => platform.name) ?? [],
        estimatedHours: status === 'completed' ? 35 : status === 'playing' ? 18 : 7,
      });
      setIsRatingOpen(false);
      return;
    }
    if (game && !isTracked) {
      addTrackedItem({
        externalId: game.id,
        mediaType: 'game',
        title: game.name,
        posterPath: gameCoverUrl || undefined,
        rating: canSaveScore ? rating : undefined,
        status,
        startedAt: canSaveStart ? startedAt.trim() || undefined : undefined,
        finishedAt: canSaveEnd ? finishedAt.trim() || undefined : undefined,
        startedAtApproximate: canSaveStart ? startedAtApproximate : false,
        finishedAtApproximate: canSaveEnd ? finishedAtApproximate : false,
        releaseYear:
          game.release_dates && game.release_dates.length > 0
            ? new Date(game.release_dates[0].date * 1000).getFullYear()
            : undefined,
        genres: game.genres?.map((genre) => genre.name) ?? [],
        platforms: game.platforms?.map((platform) => platform.name) ?? [],
        estimatedHours: status === 'completed' ? 35 : status === 'playing' ? 18 : 7,
      });
      setIsRatingOpen(false);
    }
  };

  function openEditor() {
    if (!trackedGameItem) return;
    setRating(trackedGameItem.rating ?? 0);
    setStatus(
      (trackedGameItem.status as 'planned' | 'playing' | 'completed') || 'completed'
    );
    setStartedAt(trackedGameItem.startedAt ?? '');
    setFinishedAt(trackedGameItem.finishedAt ?? '');
    setStartedAtApproximate(Boolean(trackedGameItem.startedAtApproximate));
    setFinishedAtApproximate(Boolean(trackedGameItem.finishedAtApproximate));
    setIsRatingOpen(true);
  }

  if (isLoading) {
    return (
      <RootContainer style={detailStyles.container}>
        <CenteredOverlay>
          <MagicLoader size={54} text="Cargando detalles..." />
        </CenteredOverlay>
      </RootContainer>
    );
  }

  if (isError) {
    return (
      <RootContainer style={detailStyles.container}>
        <ErrorMessage
          message="No se pudo cargar los detalles del videojuego"
          onRetry={() => refetch()}
        />
      </RootContainer>
    );
  }

  if (!game) {
    return (
      <RootContainer style={detailStyles.container}>
        <Text style={{ color: palette.text }}>Videojuego no encontrado</Text>
      </RootContainer>
    );
  }

  return (
    <RootContainer style={detailStyles.container}>
      <ScrollView style={detailStyles.scrollView} contentContainerStyle={detailStyles.scrollContent} showsVerticalScrollIndicator={false}>
        <DetailHero
          imageUri={gameCoverUrl}
          onBack={() => navigation.goBack()}
          palette={palette}
          dark={isDark}
        />

        <View style={detailStyles.content}>
          <Text style={detailStyles.title}>{game.name}</Text>

          <TouchableOpacity
            style={[detailStyles.primaryAction, isTracked && detailStyles.primaryActionTracked]}
            activeOpacity={0.85}
            onPress={() => {
              if (isTracked && trackedGameItem) {
                requestDeleteTrackedGame();
                return;
              }
              setRating(0);
              setStatus('completed');
              setStartedAt('');
              setFinishedAt('');
              setStartedAtApproximate(false);
              setFinishedAtApproximate(false);
              setIsRatingOpen(true);
            }}
          >
            <MaterialIcons
              name={isTracked ? 'delete-outline' : 'add'}
              size={18}
              color={isTracked ? palette.danger : '#FFFFFF'}
            />
            <Text style={[detailStyles.primaryActionText, isTracked && detailStyles.primaryActionTextTracked]}>
              {isTracked ? 'Eliminar de biblioteca' : 'Añadir a biblioteca'}
            </Text>
          </TouchableOpacity>

          <DetailBodyLayout
            styles={detailStyles}
            hasSidebar={Boolean((isTracked && trackedGameItem) || visibleFriendsRatings.length > 0 || (!trackedGameItem && friendTrackedItem))}
            main={
              <>
          <View style={detailStyles.metaRow}>
            {game.rating ? (
              <View style={detailStyles.metaChip}>
                <MaterialIcons name="star-outline" size={14} color={palette.subtext} />
                <Text style={detailStyles.metaChipText}>{(game.rating / 10).toFixed(1)}/10</Text>
              </View>
            ) : null}
            {game.release_dates && game.release_dates.length > 0 ? (
              <View style={detailStyles.metaChip}>
                <MaterialIcons name="calendar-today" size={13} color={palette.subtext} />
                <Text style={detailStyles.metaChipText}>{new Date(game.release_dates[0].date * 1000).getFullYear()}</Text>
              </View>
            ) : null}
          </View>

          {game.genres && game.genres.length > 0 ? (
            <View style={detailStyles.sectionBlock}>
              <Text style={detailStyles.sectionTitle}>Géneros</Text>
              <View style={detailStyles.chipRow}>
                {game.genres.map((genre) => (
                  <View key={genre.id} style={detailStyles.genreTag}>
                    <Text style={detailStyles.genreText}>{genre.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {game.platforms && game.platforms.length > 0 ? (
            <View style={detailStyles.sectionBlock}>
              <Text style={detailStyles.sectionTitle}>Plataformas</Text>
              <View style={detailStyles.chipRow}>
                {game.platforms.map((platform) => (
                  <View key={platform.id} style={detailStyles.platformTag}>
                    <Text style={detailStyles.platformText}>{platform.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {developerStudios.length > 0 ? (
            <View style={detailStyles.sectionBlock}>
              <Text style={detailStyles.sectionTitle}>Estudio / Desarrollador</Text>
              <View style={detailStyles.chipRow}>
                {developerStudios.map((studio) => (
                  <View key={studio} style={detailStyles.platformTag}>
                    <Text style={detailStyles.platformText}>{studio}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {screenshotUrls.length > 0 ? (
            <View style={detailStyles.sectionBlock}>
              <Text style={detailStyles.sectionTitle}>Capturas</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={detailStyles.screenshotsRow}>
                {screenshotUrls.map((url, index) => (
                  <TouchableOpacity key={`${url}-${index}`} activeOpacity={0.85} onPress={() => setSelectedScreenshotUrl(url)}>
                    <Image source={{ uri: url }} style={detailStyles.screenshotImage} resizeMode="cover" />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ) : null}

          <View style={detailStyles.synopsisBlock}>
            <Text style={detailStyles.sectionTitle}>Resumen</Text>
            <Text style={detailStyles.synopsisText}>{summaryText}</Text>
          </View>

          <View style={detailStyles.synopsisBlock}>
            <Text style={detailStyles.sectionTitle}>Historia</Text>
            <Text style={detailStyles.synopsisText}>{storylineText}</Text>
          </View>
              </>
            }
            sidebar={
              <>
                {isTracked && trackedGameItem ? (
                  <DetailMyLibraryCard
                    palette={palette}
                    styles={detailStyles}
                    statusLabel={statusLabel((trackedGameItem.status as 'planned' | 'playing' | 'completed') || 'playing')}
                    statusTone={statusTone((trackedGameItem.status as 'planned' | 'playing' | 'completed') || 'playing')}
                    ratingText={ratingValue(trackedGameItem.rating ?? 0)}
                    dateText={`${formatShortDate(trackedGameItem.startedAt)} – ${formatShortDate(trackedGameItem.finishedAt)}`}
                    onEdit={openEditor}
                  />
                ) : null}
                {!trackedGameItem && friendTrackedItem ? (
                  <View style={detailStyles.friendHint}>
                    <Text style={detailStyles.friendHintText}>
                      {fromFriendName || 'Tu amigo/a'} ha puntuado este juego con{' '}
                      {typeof friendTrackedItem.rating === 'number' ? `${friendTrackedItem.rating.toFixed(1)} ⭐️` : 'sin puntuación'}.
                    </Text>
                  </View>
                ) : null}
                <FriendsRatingsBlock itemLabel="juego" ratings={visibleFriendsRatings} variant="sidebar" />
              </>
            }
          />
        </View>
      </ScrollView>
      <Modal
        visible={Boolean(selectedScreenshotUrl)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedScreenshotUrl(null)}
      >
        <Pressable style={styles.screenshotModalBackdrop} onPress={() => setSelectedScreenshotUrl(null)}>
          <Pressable style={styles.screenshotModalCard} onPress={(event) => event.stopPropagation()}>
            <TouchableOpacity style={styles.screenshotCloseButton} onPress={() => setSelectedScreenshotUrl(null)}>
              <MaterialIcons name="close" size={20} color="#E2E8F0" />
            </TouchableOpacity>
            <View style={styles.screenshotZoomControls}>
              <TouchableOpacity
                style={styles.screenshotZoomButton}
                onPress={() => applyScreenshotZoom(screenshotZoom - 0.25)}
              >
                <MaterialIcons name="remove" size={16} color="#E2E8F0" />
              </TouchableOpacity>
              <Text style={styles.screenshotZoomText}>{Math.round(screenshotZoom * 100)}%</Text>
              <TouchableOpacity
                style={styles.screenshotZoomButton}
                onPress={() => {
                  applyScreenshotZoom(1);
                  setScreenshotPan({ x: 0, y: 0 });
                }}
              >
                <MaterialIcons name="refresh" size={14} color="#E2E8F0" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.screenshotZoomButton}
                onPress={() => applyScreenshotZoom(screenshotZoom + 0.25)}
              >
                <MaterialIcons name="add" size={16} color="#E2E8F0" />
              </TouchableOpacity>
            </View>
            {selectedScreenshotUrl ? (
              <View
                style={[
                  styles.screenshotModalMedia,
                  Platform.OS === 'web'
                    ? ({
                        cursor: screenshotZoom > 1 ? (isScreenshotDragging ? 'grabbing' : 'grab') : 'zoom-in',
                      } as any)
                    : null,
                ]}
                onLayout={(event) => {
                  const { width, height } = event.nativeEvent.layout;
                  if (!width || !height) return;
                  setScreenshotViewport((prev) =>
                    prev.width === width && prev.height === height ? prev : { width, height }
                  );
                }}
                {...(screenshotMediaWebHandlers ?? {})}
              >
                <Image
                  source={{ uri: selectedScreenshotUrl }}
                  style={[
                    styles.screenshotModalImage,
                    {
                      width: screenshotScaledSize.width,
                      height: screenshotScaledSize.height,
                      transform: [{ translateX: screenshotPan.x }, { translateY: screenshotPan.y }],
                    },
                  ]}
                  resizeMode="contain"
                  onLoad={(event) => {
                    const source = event.nativeEvent?.source;
                    const width = source?.width ?? 0;
                    const height = source?.height ?? 0;
                    if (width && height) setScreenshotNaturalSize({ width, height });
                  }}
                />
              </View>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
      <RatingPickerModal
        visible={isRatingOpen}
        title={game.name}
        value={rating}
        status={status}
        statusOptions={[
          { value: 'planned', label: 'Pendiente', color: '#64748B' },
          { value: 'playing', label: 'Jugando', color: '#7C3AED' },
          { value: 'completed', label: 'Jugado', color: '#16A34A' },
        ]}
        startedAt={startedAt}
        finishedAt={finishedAt}
        startedAtApproximate={startedAtApproximate}
        finishedAtApproximate={finishedAtApproximate}
        onChange={setRating}
        onChangeStatus={(next) => setStatus(next as 'planned' | 'playing' | 'completed')}
        onChangeStartedAt={setStartedAt}
        onChangeFinishedAt={setFinishedAt}
        onChangeStartedAtApproximate={setStartedAtApproximate}
        onChangeFinishedAtApproximate={setFinishedAtApproximate}
        onCancel={() => setIsRatingOpen(false)}
        onConfirm={handleConfirmAdd}
        onConfirmAndGoBack={() => {
          setIsRatingOpen(false);
          navigation.goBack();
        }}
      />
    </RootContainer>
  );
};

const styles = StyleSheet.create({
  screenshotModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 24,
  },
  screenshotModalCard: {
    width: '92%',
    maxWidth: 820,
    height: '78%',
    maxHeight: 760,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A3545',
    backgroundColor: '#121821',
    overflow: 'hidden',
  },
  screenshotZoomControls: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    zIndex: 2,
  },
  screenshotZoomButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(26, 35, 48, 0.92)',
    borderWidth: 1,
    borderColor: '#2A3545',
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenshotZoomText: {
    color: '#9FB0C3',
    fontSize: 12,
    fontWeight: '700',
    minWidth: 42,
    textAlign: 'center',
  },
  screenshotModalMedia: {
    marginTop: 42,
    flex: 1,
    width: '100%',
    overflow: 'hidden',
    backgroundColor: '#0B0F14',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  screenshotCloseButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(26, 35, 48, 0.92)',
    borderWidth: 1,
    borderColor: '#2A3545',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  screenshotModalImage: {
    display: 'flex',
  },
});

export default GameDetailsScreen;
