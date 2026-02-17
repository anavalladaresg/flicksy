/**
 * Skeleton Loader para imágenes durante carga
 * Componente reutilizable para feedback visual
 */

import React from 'react';
import { View, ViewStyle } from 'react-native';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: ViewStyle;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 200,
  borderRadius = 8,
  style,
}) => {
  return (
    <View
      style={[
        {
          width: typeof width === 'string' ? width : width,
          height: typeof height === 'string' ? height : height,
          borderRadius,
          backgroundColor: '#E0E0E0',
          overflow: 'hidden',
        } as ViewStyle,
        style,
      ]}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: '#F5F5F5',
          opacity: 0.5,
        }}
      />
    </View>
  );
};

interface CardSkeletonProps {
  style?: ViewStyle;
}

export const CardSkeleton: React.FC<CardSkeletonProps> = ({ style }) => {
  return (
    <View
      style={[
        {
          borderRadius: 12,
          padding: 12,
          marginBottom: 12,
          backgroundColor: '#fff',
        },
        style,
      ]}
    >
      <Skeleton width="100%" height={150} borderRadius={8} />
      <View style={{ marginTop: 12 }}>
        <Skeleton width="80%" height={16} borderRadius={4} />
        <Skeleton
          width="100%"
          height={12}
          borderRadius={4}
          style={{ marginTop: 8 }}
        />
      </View>
    </View>
  );
};
