import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useEscapeClose } from '../../hooks/use-escape-close';

type FloatingModalShellProps = {
  children: React.ReactNode;
  onClose?: () => void;
  maxWidth?: number;
};

export default function FloatingModalShell({ children, onClose, maxWidth = 1024 }: FloatingModalShellProps) {
  useEscapeClose(Platform.OS === 'web', onClose);

  if (Platform.OS !== 'web') return <>{children}</>;

  return (
    <View style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={styles.aura} />
      <View style={[styles.sheet, { maxWidth }]}>
        <View style={styles.innerFrame}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.62)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
    ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(7px)' } as any) : null),
  },
  aura: {
    position: 'absolute',
    width: 440,
    height: 440,
    borderRadius: 220,
    backgroundColor: 'rgba(14, 116, 144, 0.18)',
    transform: [{ translateY: -18 }],
  },
  sheet: {
    width: '100%',
    height: '92%',
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: 'rgba(125, 211, 252, 0.28)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.38,
    shadowRadius: 34,
    elevation: 16,
  },
  innerFrame: {
    flex: 1,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#0B1220',
  },
});
