/**
 * Pantalla de detalles de película
 */

import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
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
import { TMDB_IMAGE_BASE_URL } from '../constants/config';
import { useMovieDetails } from '../features/movies/presentation/hooks';
import { useTrackingStore } from '../store/tracking';

interface MovieDetailsScreenProps {
  route: any;
  navigation: any;
}

const MovieDetailsScreen: React.FC<MovieDetailsScreenProps> = ({
  route,
  navigation,
}) => {
  const { movieId } = route.params;
  const { data: movie, isLoading, isError, refetch } = useMovieDetails(movieId);
  const addTrackedItem = useTrackingStore((state) => state.addItem);
  const trackedItems = useTrackingStore((state) => state.items);

  const isTracked = trackedItems.some(
    (item) => item.externalId === movieId && item.mediaType === 'movie'
  );

  const handleAddToTracking = () => {
    if (movie && !isTracked) {
      addTrackedItem({
        externalId: movie.id,
        mediaType: 'movie',
        title: movie.title,
        posterPath: movie.poster_path || undefined,
        status: 'watching',
      });
    }
  };

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
    <SafeAreaView style={styles.container}>
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
          <Image
            source={{
              uri: `${TMDB_IMAGE_BASE_URL}${movie.backdrop_path || movie.poster_path}`,
            }}
            style={styles.backdrop}
            resizeMode="cover"
          />
        )}

        <View style={styles.content}>
          <Text style={styles.title}>{movie.title}</Text>

          <View style={styles.info}>
            {movie.runtime && (
              <Text style={styles.infoText}>
                ⏱️ {movie.runtime} min
              </Text>
            )}
            <Text style={styles.infoText}>
              ⭐ {movie.vote_average.toFixed(1)}/10
            </Text>
            <Text style={styles.infoText}>
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

          <Text style={styles.sectionTitle}>Sinopsis</Text>
          <Text style={styles.description}>{movie.overview}</Text>

          <TouchableOpacity
            style={[
              styles.button,
              isTracked && styles.buttonTracked,
            ]}
            onPress={handleAddToTracking}
            disabled={isTracked}
          >
            <MaterialIcons
              name={isTracked ? 'check-circle' : 'add-circle'}
              size={24}
              color={isTracked ? '#4CAF50' : '#fff'}
            />
            <Text style={[styles.buttonText, isTracked && styles.buttonTextTracked]}>
              {isTracked ? 'Agregada' : 'Agregar a Biblioteca'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  content: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
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
  button: {
    backgroundColor: '#2196F3',
    paddingVertical: 16,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  buttonTracked: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  buttonTextTracked: {
    color: '#4CAF50',
  },
});

export default MovieDetailsScreen;
