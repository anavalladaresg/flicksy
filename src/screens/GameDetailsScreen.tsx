/**
 * Pantalla de detalles de videojuego
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
  const { gameId } = route.params;
  const { data: game, isLoading, isError, refetch } = useGameDetails(gameId);
  const addTrackedItem = useTrackingStore((state) => state.addItem);
  const trackedItems = useTrackingStore((state) => state.items);

  const isTracked = trackedItems.some(
    (item) => item.externalId === gameId && item.mediaType === 'game'
  );

  const handleAddToTracking = () => {
    if (game && !isTracked) {
      addTrackedItem({
        externalId: game.id,
        mediaType: 'game',
        title: game.name,
        posterPath: game.cover?.url || undefined,
        status: 'playing',
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

        {game.cover?.url && (
          <Image
            source={{
              uri: `https:${game.cover.url}`,
            }}
            style={styles.backdrop}
            resizeMode="cover"
          />
        )}

        <View style={styles.content}>
          <Text style={styles.title}>{game.name}</Text>

          <View style={styles.info}>
            {game.rating && (
              <Text style={styles.infoText}>
                ⭐ {game.rating.toFixed(1)}/100
              </Text>
            )}
            {game.release_dates && game.release_dates.length > 0 && (
              <Text style={styles.infoText}>
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
              <Text style={styles.sectionTitle}>Plataformas</Text>
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
              <Text style={styles.sectionTitle}>Resumen</Text>
              <Text style={styles.description}>{game.summary}</Text>
            </>
          )}

          {game.storyline && (
            <>
              <Text style={styles.sectionTitle}>Historia</Text>
              <Text style={styles.description}>{game.storyline}</Text>
            </>
          )}

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
              {isTracked ? 'Agregado' : 'Agregar a Biblioteca'}
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

export default GameDetailsScreen;
