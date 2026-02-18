/**
 * Pantalla de detalles de película
 */

import { MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { useColorScheme } from '@/hooks/use-color-scheme';
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
import { ErrorMessage } from '../components/ui/ErrorMessage';
import FriendsRatingsBlock from '../components/common/FriendsRatingsBlock';
import { RatingPickerModal } from '../components/common/RatingPickerModal';
import { TMDB_IMAGE_BASE_URL } from '../constants/config';
import { useMovieDetails } from '../features/movies/presentation/hooks';
import { getFriendLibraryItem, getFriendsRatingsForItem, type FriendItemRating } from '../services/social';
import { useTrackingStore } from '../store/tracking';
import type { TrackedItem } from '../types';

interface MovieDetailsScreenProps {
  route: any;
  navigation: any;
}

const MovieDetailsScreen: React.FC<MovieDetailsScreenProps> = ({
  route,
  navigation,
}) => {
  const isDark = useColorScheme() === 'dark';
  const { movieId, fromFriendId, fromFriendName } = route.params;
  const { data: movie, isLoading, isError, refetch } = useMovieDetails(movieId);
  const addTrackedItem = useTrackingStore((state) => state.addItem);
  const updateTrackedItem = useTrackingStore((state) => state.updateItem);
  const removeTrackedItem = useTrackingStore((state) => state.removeItem);
  const trackedItems = useTrackingStore((state) => state.items);
  const [isRatingOpen, setIsRatingOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [status, setStatus] = useState<'planned' | 'watching' | 'completed'>('watching');
  const [watchedAt, setWatchedAt] = useState('');
  const [friendTrackedItem, setFriendTrackedItem] = useState<TrackedItem | null>(null);
  const [friendsRatings, setFriendsRatings] = useState<FriendItemRating[]>([]);

  const isTracked = trackedItems.some(
    (item) => item.externalId === movieId && item.mediaType === 'movie'
  );
  const trackedMovieItem = trackedItems.find(
    (item) => item.externalId === movieId && item.mediaType === 'movie'
  );
  const visibleFriendsRatings = fromFriendId
    ? friendsRatings.filter((entry) => entry.friendId !== fromFriendId)
    : friendsRatings;

  useEffect(() => {
    if (!fromFriendId || !movieId) {
      setFriendTrackedItem(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const item = await getFriendLibraryItem(fromFriendId, 'movie', movieId);
      if (!cancelled) setFriendTrackedItem(item);
    })();
    return () => {
      cancelled = true;
    };
  }, [fromFriendId, movieId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ratings = await getFriendsRatingsForItem('movie', movieId);
      if (!cancelled) setFriendsRatings(ratings);
    })();
    return () => {
      cancelled = true;
    };
  }, [movieId]);

  function statusLabel(value: 'planned' | 'watching' | 'completed') {
    if (value === 'planned') return 'Pendiente';
    if (value === 'watching') return 'Viendo';
    return 'Vista';
  }

  function ratingValue(value: number) {
    if (!value) return '0.0/10';
    return `${value.toFixed(1)}/10`;
  }

  function statusTone(value: 'planned' | 'watching' | 'completed') {
    if (value === 'planned') return { color: '#64748B', bg: '#F1F5F9', border: '#CBD5E1' };
    if (value === 'watching') return { color: '#0369A1', bg: '#E0F2FE', border: '#7DD3FC' };
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

  const handleConfirmAdd = () => {
    if (!movie) return;
    if (trackedMovieItem) {
      updateTrackedItem(trackedMovieItem.id, {
        rating,
        status,
        watchedAt: watchedAt.trim() || undefined,
        startedAt: undefined,
        finishedAt: undefined,
        releaseYear: movie.release_date ? new Date(movie.release_date).getFullYear() : undefined,
        genres: movie.genres?.map((genre) => genre.name) ?? [],
        runtimeMinutes: movie.runtime ?? undefined,
        estimatedHours: movie.runtime ? Math.round((movie.runtime / 60) * 10) / 10 : undefined,
      });
      setIsRatingOpen(false);
      return;
    }
    if (movie && !isTracked) {
      addTrackedItem({
        externalId: movie.id,
        mediaType: 'movie',
        title: movie.title,
        posterPath: movie.poster_path || undefined,
        rating,
        status,
        watchedAt: watchedAt.trim() || undefined,
        startedAt: undefined,
        finishedAt: undefined,
        releaseYear: movie.release_date ? new Date(movie.release_date).getFullYear() : undefined,
        genres: movie.genres?.map((genre) => genre.name) ?? [],
        runtimeMinutes: movie.runtime ?? undefined,
        estimatedHours: movie.runtime ? Math.round((movie.runtime / 60) * 10) / 10 : undefined,
      });
      setIsRatingOpen(false);
    }
  };

  function openEditor() {
    if (!trackedMovieItem) return;
    setRating(trackedMovieItem.rating ?? 0);
    setStatus(
      (trackedMovieItem.status as 'planned' | 'watching' | 'completed') || 'watching'
    );
    setWatchedAt(trackedMovieItem.watchedAt ?? '');
    setIsRatingOpen(true);
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#2196F3" />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView style={styles.container}>
        <ErrorMessage
          message="No se pudo cargar los detalles de la película"
          onRetry={() => refetch()}
        />
      </SafeAreaView>
    );
  }

  if (!movie) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>Película no encontrada</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#0B1220' : '#fff' }]}>
      <ScrollView>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <MaterialIcons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {movie.poster_path && (
          <View style={styles.backdropWrap}>
            <Image
              source={{
                uri: `${TMDB_IMAGE_BASE_URL}${movie.backdrop_path || movie.poster_path}`,
              }}
              style={styles.backdrop}
              resizeMode="cover"
            />
          </View>
        )}

        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: isDark ? '#E5E7EB' : '#333' }]}>{movie.title}</Text>
            <TouchableOpacity
              style={[styles.inlineAddButton, isTracked && styles.inlineAddButtonTracked]}
              onPress={() => {
                if (trackedMovieItem) {
                  removeTrackedItem(trackedMovieItem.id);
                } else {
                  setRating(0);
                  setStatus('watching');
                  setWatchedAt('');
                  setIsRatingOpen(true);
                }
              }}
            >
              <MaterialIcons
                name={isTracked ? 'delete' : 'add'}
                size={18}
                color={isTracked ? '#B91C1C' : '#FFFFFF'}
              />
              <Text style={[styles.inlineAddText, isTracked && styles.inlineAddTextTracked]}>
                {isTracked ? 'Eliminar' : 'Añadir'}
              </Text>
            </TouchableOpacity>
          </View>
          {trackedMovieItem && (
            <View style={[styles.myDataCard, isDark && styles.myDataCardDark]}>
              <TouchableOpacity style={[styles.editDataButton, isDark && styles.editDataButtonDark]} onPress={openEditor}>
                <MaterialIcons name="edit" size={14} color="#0E7490" />
              </TouchableOpacity>
              <View style={styles.myDataTopRow}>
                <View
                  style={[
                    styles.statusPill,
                    isDark && styles.statusPillDark,
                    {
                      borderColor: statusTone((trackedMovieItem.status as 'planned' | 'watching' | 'completed') || 'watching').border,
                      backgroundColor: statusTone((trackedMovieItem.status as 'planned' | 'watching' | 'completed') || 'watching').bg,
                    },
                  ]}
                >
                  <MaterialIcons
                    name="flag"
                    size={13}
                    color={statusTone((trackedMovieItem.status as 'planned' | 'watching' | 'completed') || 'watching').color}
                  />
                  <Text
                    style={[
                      styles.statusPillText,
                      { color: statusTone((trackedMovieItem.status as 'planned' | 'watching' | 'completed') || 'watching').color },
                    ]}
                  >
                    {statusLabel((trackedMovieItem.status as 'planned' | 'watching' | 'completed') || 'watching')}
                  </Text>
                </View>
                <Text style={[styles.ratingLine, { color: isDark ? '#E5E7EB' : '#1E293B' }]}>⭐️ {ratingValue(trackedMovieItem.rating ?? 0)}</Text>
              </View>
              <Text style={[styles.myDataDate, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                Visto: {formatShortDate(trackedMovieItem.watchedAt)}
              </Text>
            </View>
          )}
          {!trackedMovieItem && friendTrackedItem && (
            <View style={[styles.friendDataCard, isDark && styles.friendDataCardDark]}>
              <Text style={[styles.friendDataText, { color: isDark ? '#E5E7EB' : '#1E293B' }]}>
                {fromFriendName || 'Tu amigo/a'} ha puntuado esta película con{' '}
                {typeof friendTrackedItem.rating === 'number' ? `${friendTrackedItem.rating.toFixed(1)} ⭐️` : 'sin puntuación'}.
              </Text>
            </View>
          )}
          <FriendsRatingsBlock itemLabel="película" ratings={visibleFriendsRatings} />

          <View style={styles.info}>
            {movie.runtime && (
              <Text style={[styles.infoText, { color: isDark ? '#CBD5E1' : '#666' }]}>
                ⏱️ {movie.runtime} min
              </Text>
            )}
            <Text style={[styles.infoText, { color: isDark ? '#CBD5E1' : '#666' }]}>
              🌐 {movie.vote_average.toFixed(1)}/10
            </Text>
            <Text style={[styles.infoText, { color: isDark ? '#CBD5E1' : '#666' }]}>
              📅 {new Date(movie.release_date).getFullYear()}
            </Text>
          </View>

          {movie.genres && movie.genres.length > 0 && (
            <View style={styles.genres}>
              {movie.genres.map((genre) => (
                <View key={genre.id} style={styles.genreTag}>
                  <Text style={styles.genreText}>{genre.name}</Text>
                </View>
              ))}
            </View>
          )}

          <Text style={[styles.sectionTitle, { color: isDark ? '#E5E7EB' : '#333' }]}>Sinopsis</Text>
          <Text style={[styles.description, { color: isDark ? '#CBD5E1' : '#666' }]}>{movie.overview}</Text>

        </View>
      </ScrollView>
      <RatingPickerModal
        visible={isRatingOpen}
        title={movie.title}
        value={rating}
        status={status}
        statusOptions={[
          { value: 'planned', label: 'Pendiente', color: '#64748B' },
          { value: 'watching', label: 'Viendo', color: '#0284C7' },
          { value: 'completed', label: 'Visto', color: '#16A34A' },
        ]}
        dateMode="single"
        watchedAt={watchedAt}
        startedAt=""
        finishedAt=""
        onChange={setRating}
        onChangeStatus={(next) => setStatus(next as 'planned' | 'watching' | 'completed')}
        onChangeWatchedAt={setWatchedAt}
        onChangeStartedAt={() => undefined}
        onChangeFinishedAt={() => undefined}
        onCancel={() => setIsRatingOpen(false)}
        onConfirm={handleConfirmAdd}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    width: '100%',
    height: 300,
  },
  backdropWrap: {
    position: 'relative',
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },
  title: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
  },
  inlineAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0E7490',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  inlineAddButtonTracked: {
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#B91C1C',
  },
  inlineAddText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  inlineAddTextTracked: {
    color: '#B91C1C',
  },
  myDataCard: {
    marginTop: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 10,
    gap: 8,
  },
  myDataCardDark: {
    backgroundColor: '#111827',
    borderColor: '#334155',
  },
  friendDataCard: {
    marginTop: 4,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#FCD34D',
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  friendDataCardDark: {
    backgroundColor: '#1F2937',
    borderColor: '#92400E',
  },
  friendDataText: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  editDataButton: {
    position: 'absolute',
    top: -10,
    right: -10,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFEFF',
    borderWidth: 1,
    borderColor: '#A5F3FC',
    zIndex: 20,
    elevation: 4,
  },
  editDataButtonDark: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
  },
  myDataTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#67E8F9',
    backgroundColor: '#ECFEFF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusPillDark: {
    borderColor: '#334155',
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0E7490',
  },
  ratingLine: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  myDataDate: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    textAlign: 'right',
  },
  info: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 16,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  genres: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  genreTag: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  genreText: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginTop: 12,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: '#666',
    marginBottom: 20,
  },
});

export default MovieDetailsScreen;
