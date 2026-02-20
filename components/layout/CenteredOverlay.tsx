import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

type CenteredOverlayProps = {
  children: React.ReactNode;
  absolute?: boolean;
  backgroundColor?: string;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
};

export default function CenteredOverlay({
  children,
  absolute = false,
  backgroundColor,
  style,
  contentStyle,
  pointerEvents = 'auto',
}: CenteredOverlayProps) {
  return (
    <View
      pointerEvents={pointerEvents}
      style={[
        styles.root,
        absolute && StyleSheet.absoluteFillObject,
        backgroundColor ? { backgroundColor } : null,
        style,
      ]}
    >
      <View style={[styles.center, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
