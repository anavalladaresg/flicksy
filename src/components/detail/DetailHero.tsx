import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useMemo } from 'react';
import {
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import type { DetailPalette } from './detailTheme';

type DetailHeroProps = {
  imageUri: string | null;
  onBack: () => void;
  palette: DetailPalette;
  dark: boolean;
};

function heroOverlayStyle(dark: boolean, palette: DetailPalette) {
  if (Platform.OS === 'web') {
    const topTone = dark ? 'rgba(0,0,0,0.45)' : 'rgba(15,23,42,0.28)';
    const midTone = dark ? 'rgba(11,15,20,0)' : 'rgba(241,239,234,0)';
    const bottomTone = palette.bg;

    return {
      backgroundImage: `linear-gradient(180deg, ${topTone} 0%, ${midTone} 38%, ${midTone} 52%, ${bottomTone} 100%)`,
    } as any;
  }

  return {
    backgroundColor: dark ? 'rgba(11, 15, 20, 0.28)' : 'rgba(241, 239, 234, 0.22)',
  };
}

export default function DetailHero({ imageUri, onBack, palette, dark }: DetailHeroProps) {
  const { width, height } = useWindowDimensions();
  const heroHeight = useMemo(() => {
    const isCompact = width < 640;
    const isTablet = width >= 640 && width < 1024;
    if (isCompact) return Math.min(220, Math.max(180, height * 0.24));
    if (isTablet) return 250;
    return Math.min(320, Math.max(250, height * 0.3));
  }, [width, height]);

  return (
    <View style={[styles.wrap, { height: imageUri ? heroHeight : 72 }]}>
      {imageUri ? (
        <>
          <Image
            source={{ uri: imageUri }}
            style={styles.image}
            contentFit="cover"
            contentPosition="center"
            transition={0}
            cachePolicy="memory-disk"
          />
          <View pointerEvents="none" style={[styles.overlay, heroOverlayStyle(dark, palette)]} />
        </>
      ) : (
        <View style={[styles.placeholder, { backgroundColor: palette.surface }]} />
      )}

      <View style={styles.header}>
        <TouchableOpacity
          onPress={onBack}
          style={[
            styles.backButton,
            {
              backgroundColor: dark ? 'rgba(18, 24, 33, 0.72)' : 'rgba(248, 246, 241, 0.88)',
              borderColor: dark ? 'rgba(42, 53, 69, 0.8)' : 'rgba(222, 216, 204, 0.9)',
            },
            Platform.OS === 'web' && styles.webPressable,
          ]}
          activeOpacity={0.82}
        >
          <MaterialIcons name="arrow-back" size={22} color={palette.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    width: '100%',
    overflow: 'hidden',
    backgroundColor: '#0B0F14',
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'web' ? 14 : 12,
    paddingBottom: 8,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  webPressable: {
    cursor: 'pointer',
    transitionDuration: '150ms',
  } as any,
});
