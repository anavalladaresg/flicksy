import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

type FloatingModalShellProps = {
  children: React.ReactNode;
  onClose?: () => void;
  maxWidth?: number;
};

export default function FloatingModalShell({ children, onClose, maxWidth = 1024 }: FloatingModalShellProps) {
  if (Platform.OS !== 'web') return <>{children}</>;

  return (
    <View style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[styles.sheet, { maxWidth }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  sheet: {
    width: '100%',
    height: '92%',
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.24,
    shadowRadius: 30,
    elevation: 12,
  },
});
