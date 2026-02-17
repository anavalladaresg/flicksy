/**
 * Pantalla de detalles de videojuego
 */

import { MaterialIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
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
import { RatingPickerModal } from '../components/common/RatingPickerModal';
import { useGameDetails } from '../features/games/presentation/hooks';
import { useTrackingStore } from '../store/tracking';

interface GameDetailsScreenProps {
  route: any;
  navigation: any;
}

const GameDetailsScreen: React.FC<GameDetailsScreenProps> = ({
  route,
  navigation,
}) => {
  const isDark = useColorScheme() === 'dark';
  const { gameId } = route.params;
  const { data: game, isLoading, isError, refetch } = useGameDetails(gameId);
  const addTrackedItem = useTrackingStore((state) => state.addItem);
  const updateTrackedItem = useTrackingStore((state) => state.updateItem);
  const removeTrackedItem = useTrackingStore((state) => state.removeItem);
  const trackedItems = useTrackingStore((state) => state.items);
  const [isRatingOpen, setIsRatingOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [status, setStatus] = useState<'planned' | 'playing' | 'completed'>('playing');
  const [startedAt, setStartedAt] = useState('');
  const [finishedAt, setFinishedAt] = useState('');

  const isTracked = trackedItems.some(
    (item) => item.externalId === gameId && item.mediaType === 'game'
  );
  const trackedGameItem = trackedItems.find(
    (item) => item.externalId === gameId && item.mediaType === 'game'
  );

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
      ? `https:${game.cover.url}`.replace('/t_thumb/', '/t_cover_big_2x/')
      : null;

  const handleConfirmAdd = () => {
    if (!game) return;
    if (trackedGameItem) {
      updateTrackedItem(trackedGameItem.id, {
        rating,
        status,
        startedAt: startedAt.trim() || undefined,
        finishedAt: finishedAt.trim() || undefined,
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
        rating,
        status,
        startedAt: startedAt.trim() || undefined,
        finishedAt: finishedAt.trim() || undefined,
      });
      setIsRatingOpen(false);
    }
  };

  function openEditor() {
    if (!trackedGameItem) return;
    setRating(trackedGameItem.rating ?? 0);
    setStatus(
      (trackedGameItem.status as 'planned' | 'playing' | 'completed') || 'playing'
    );
    setStartedAt(trackedGameItem.startedAt ?? '');
    setFinishedAt(trackedGameItem.finishedAt ?? '');
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
          message="No se pudo cargar los detalles del videojuego"
          onRetry={() => refetch()}
        />
      </SafeAreaView>
    );
  }

  if (!game) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>Videojuego no encontrado</Text>
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

        {gameCoverUrl && (
          <View style={styles.backdropWrap}>
            <Image
              source={{
                uri: gameCoverUrl,
              }}
              style={styles.backdrop}
              resizeMode="cover"
            />
          </View>
        )}

        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: isDark ? '#E5E7EB' : '#333' }]}>{game.name}</Text>
            <TouchableOpacity
              style={[styles.inlineAddButton, isTracked && styles.inlineAddButtonTracked]}
              onPress={() => {
                if (isTracked && trackedGameItem) {
                  removeTrackedItem(trackedGameItem.id);
                  return;
                }
                setRating(0);
                setStatus('playing');
                setStartedAt('');
                setFinishedAt('');
                setIsRatingOpen(true);
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
          {isTracked && trackedGameItem && (
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
                      borderColor: statusTone((trackedGameItem.status as 'planned' | 'playing' | 'completed') || 'playing').border,
                      backgroundColor: statusTone((trackedGameItem.status as 'planned' | 'playing' | 'completed') || 'playing').bg,
                    },
                  ]}
                >
                  <MaterialIcons
                    name="flag"
                    size={13}
                    color={statusTone((trackedGameItem.status as 'planned' | 'playing' | 'completed') || 'playing').color}
                  />
                  <Text
                    style={[
                      styles.statusPillText,
                      { color: statusTone((trackedGameItem.status as 'planned' | 'playing' | 'completed') || 'playing').color },
                    ]}
                  >
                    {statusLabel((trackedGameItem.status as 'planned' | 'playing' | 'completed') || 'playing')}
                  </Text>
                </View>
                <Text style={[styles.ratingLine, { color: isDark ? '#E5E7EB' : '#1E293B' }]}>⭐️ {ratingValue(trackedGameItem.rating ?? 0)}</Text>
              </View>
              <Text style={[styles.myDataDate, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                {formatShortDate(trackedGameItem.startedAt)} - {formatShortDate(trackedGameItem.finishedAt)}
              </Text>
            </View>
          )}

          <View style={styles.info}>
            {game.rating && (
              <Text style={[styles.infoText, { color: isDark ? '#CBD5E1' : '#666' }]}>
                🌐 {(game.rating / 10).toFixed(1)}/10
              </Text>
            )}
            {game.release_dates && game.release_dates.length > 0 && (
              <Text style={[styles.infoText, { color: isDark ? '#CBD5E1' : '#666' }]}>
                📅 {new Date(game.release_dates[0].date * 1000).getFullYear()}
              </Text>
            )}
          </View>

          {game.genres && game.genres.length > 0 && (
            <View style={styles.genres}>
              {game.genres.map((genre) => (
                <View key={genre.id} style={styles.genreTag}>
                  <Text style={styles.genreText}>{genre.name}</Text>
                </View>
              ))}
            </View>
          )}

          {game.platforms && game.platforms.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { color: isDark ? '#E5E7EB' : '#333' }]}>Plataformas</Text>
              <View style={styles.platforms}>
                {game.platforms.map((platform) => (
                  <View key={platform.id} style={styles.platformTag}>
                    <Text style={styles.platformText}>{platform.name}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {game.summary && (
            <>
              <Text style={[styles.sectionTitle, { color: isDark ? '#E5E7EB' : '#333' }]}>Resumen</Text>
              <Text style={[styles.description, { color: isDark ? '#CBD5E1' : '#666' }]}>{game.summary}</Text>
            </>
          )}

          {game.storyline && (
            <>
              <Text style={[styles.sectionTitle, { color: isDark ? '#E5E7EB' : '#333' }]}>Historia</Text>
              <Text style={[styles.description, { color: isDark ? '#CBD5E1' : '#666' }]}>{game.storyline}</Text>
            </>
          )}

        </View>
      </ScrollView>
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
        onChange={setRating}
        onChangeStatus={(next) => setStatus(next as 'planned' | 'playing' | 'completed')}
        onChangeStartedAt={setStartedAt}
        onChangeFinishedAt={setFinishedAt}
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
  platforms: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  platformTag: {
    backgroundColor: '#F3E5F5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  platformText: {
    fontSize: 12,
    color: '#9C27B0',
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

export default GameDetailsScreen;
