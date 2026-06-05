import React from 'react';
import { View, useWindowDimensions } from 'react-native';
import type { createDetailStyles } from './createDetailStyles';

type DetailStyles = ReturnType<typeof createDetailStyles>;

type DetailBodyLayoutProps = {
  main: React.ReactNode;
  sidebar: React.ReactNode;
  styles: DetailStyles;
  hasSidebar?: boolean;
};

const DESKTOP_BREAKPOINT = 900;

export default function DetailBodyLayout({ main, sidebar, styles, hasSidebar = true }: DetailBodyLayoutProps) {
  const { width } = useWindowDimensions();
  const isTwoColumn = width >= DESKTOP_BREAKPOINT && hasSidebar;

  if (!isTwoColumn) {
    return (
      <View style={styles.bodyStack}>
        {main}
        {sidebar}
      </View>
    );
  }

  return (
    <View style={styles.bodyGrid}>
      <View style={styles.mainColumn}>{main}</View>
      <View style={styles.sidebarColumn}>{sidebar}</View>
    </View>
  );
}
