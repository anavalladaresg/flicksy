/**
 * Card componente para películas, series y videojuegos
 * Componente reutilizable y tipado
 */

import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import {
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    ViewStyle,
} from 'react-native';
import { TMDB_IMAGE_BASE_URL } from '../../constants/config';

interface MediaCardProps {
  id: number;
  title: string;
  posterUrl?: string;
  rating?: number;
  onPress: () => void;
  onAddPress?: () => void;
  isTracked?: boolean;
  style?: ViewStyle;
}

const DEFAULT_POSTER = require('../../assets/placeholder.png');

export const MediaCard: React.FC<MediaCardProps> = ({
  id,
  title,
  posterUrl,
  rating,
  onPress,
  onAddPress,
  isTracked = false,
  style,
}) => {
  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.imageContainer}>
        <Image
          source={
            posterUrl
              ? { uri: `${TMDB_IMAGE_BASE_URL}${posterUrl}` }
              : DEFAULT_POSTER
          }
          style={styles.image}
          resizeMode="cover"
        />

        {rating && (
          <View style={styles.ratingBadge}>
            <MaterialIcons name="star" size={14} color="#FFD700" />
            <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
          </View>
        )}

        {onAddPress && (
          <TouchableOpacity
            style={[
              styles.addButton,
              isTracked && styles.addButtonTracked,
            ]}
            onPress={onAddPress}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name={isTracked ? 'check' : 'add'}
              size={20}
              color={isTracked ? '#4CAF50' : '#fff'}
            />
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '48%',
    marginHorizontal: '1%',
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f5f5f5',
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 2 / 3,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#e0e0e0',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  ratingBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  addButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(33, 150, 243, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  addButtonTracked: {
    backgroundColor: 'rgba(76, 175, 80, 0.9)',
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
    padding: 8,
    color: '#333',
    height: 32,
  },
});
