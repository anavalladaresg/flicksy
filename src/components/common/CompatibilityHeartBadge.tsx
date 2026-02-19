import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

interface CompatibilityHeartBadgeProps {
  score: number;
  isDark?: boolean;
  onLongPress?: () => void;
  onHoverIn?: () => void;
  onHoverOut?: () => void;
}

export default function CompatibilityHeartBadge({
  score,
  isDark = false,
  onLongPress,
  onHoverIn,
  onHoverOut,
}: CompatibilityHeartBadgeProps) {
  const normalizedScore = Math.max(0, Math.min(100, Math.round(score)));

  return (
    <View style={styles.wrap}>
      <Pressable
        style={[styles.badge, isDark && styles.badgeDark]}
        accessibilityRole="imagebutton"
        accessibilityLabel={`Compatibilidad ${normalizedScore}%`}
        onLongPress={onLongPress}
        onHoverIn={Platform.OS === 'web' ? onHoverIn : undefined}
        onHoverOut={Platform.OS === 'web' ? onHoverOut : undefined}
        {...(Platform.OS === 'web'
          ? ({
              title: `Compatibilidad: ${normalizedScore}%`,
              onMouseEnter: onHoverIn,
              onMouseLeave: onHoverOut,
            } as any)
          : null)}
      >
        <MaterialIcons name="favorite" size={8} color={isDark ? '#FBCFE8' : '#BE185D'} />
        <Text style={[styles.text, isDark && styles.textDark]}>{normalizedScore}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    alignItems: 'center',
  },
  badge: {
    minWidth: 18,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F9A8D4',
    backgroundColor: '#FCE7F3',
    paddingHorizontal: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  badgeDark: {
    borderColor: '#9D174D',
    backgroundColor: '#4A044E',
  },
  text: {
    fontSize: 8,
    lineHeight: 10,
    fontWeight: '900',
    color: '#9D174D',
  },
  textDark: {
    color: '#F9A8D4',
  },
});
