import React, { useEffect, useMemo } from 'react';
import { Modal, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import CenteredOverlay from '@/components/layout/CenteredOverlay';
import { useColorScheme } from '@/hooks/use-color-scheme';

type BlurViewComponent = React.ComponentType<{
  intensity?: number;
  tint?: 'light' | 'dark' | 'default';
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}>;

let BlurView: BlurViewComponent | null = null;
try {
  BlurView = require('expo-blur').BlurView as BlurViewComponent;
} catch {
  BlurView = null;
}

const TAU = Math.PI * 2;
const DEFAULT_TRAIL = 26;
const MAX_TRAIL = 30;
const MIN_TRAIL = 18;
const DUST_POOL = 14;
const DEFAULT_SPIN_MS = 1100;

export interface MagicParticlesLoaderProps {
  visible?: boolean;
  size?: number;
  color?: string;
  secondaryColor?: string;
  text?: string;
  overlay?: boolean;
  fullScreen?: boolean;
  blur?: boolean;
  withinModal?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  particleCount?: number;
  speed?: number;
  hueRange?: [number, number];
}

type TrailParticleConfig = {
  index: number;
  size: number;
  glowSize: number;
  opacity: number;
  pulseFreq: number;
  pulsePhase: number;
};

type DustConfig = {
  index: number;
  offset: number;
  period: number;
  life: number;
  travel: number;
  size: number;
  glowSize: number;
  opacityMax: number;
  side: number;
  out: number;
  tailIndex: number;
  phaseDrift: number;
};

function withAlpha(input: string, alpha: number): string {
  if (input.startsWith('rgba')) return input;
  if (input.startsWith('hsla')) return input;
  if (input.startsWith('rgb(')) return input.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
  if (input.startsWith('hsl(')) return input.replace('hsl(', 'hsla(').replace(')', `, ${alpha})`);
  const hex = input.replace('#', '');
  if (hex.length !== 6) return `rgba(14,116,144,${alpha})`;
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function hashNoise(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function buildTrailConfig(count: number, size: number): TrailParticleConfig[] {
  return Array.from({ length: count }).map((_, index) => {
    const t = index / Math.max(1, count - 1);
    const seed = index + 1;
    const jitter = hashNoise(seed * 2.13);

    return {
      index,
      size: Math.max(1.6, 5 - t * 3.4),
      glowSize: Math.max(4, (5 - t * 3.4) * 2.8),
      opacity: 1 - t * 0.9,
      pulseFreq: 2.0 + hashNoise(seed * 1.11) * 2.4,
      pulsePhase: jitter * TAU,
    };
  });
}

function buildDustConfig(count: number, trailCount: number): DustConfig[] {
  return Array.from({ length: count }).map((_, index) => {
    const seed = index + 33;
    const n1 = hashNoise(seed * 0.71);
    const n2 = hashNoise(seed * 1.37);
    const n3 = hashNoise(seed * 2.11);
    const n4 = hashNoise(seed * 2.73);
    const n5 = hashNoise(seed * 3.17);
    const tailStart = Math.max(8, Math.floor(trailCount * 0.35));

    return {
      index,
      offset: n1 * 2.2,
      period: 2.2 + n2 * 2.6,
      life: 0.3 + n3 * 0.4,
      travel: 6 + n4 * 10,
      size: 1 + n5 * 2,
      glowSize: (1 + n5 * 2) * 2.1,
      opacityMax: 0.22 + n1 * 0.28,
      side: -0.35 + n2 * 0.7,
      out: 0.9 + n3 * 0.4,
      tailIndex: Math.floor(tailStart + n4 * Math.max(1, trailCount - tailStart - 1)),
      phaseDrift: 0.07 + n5 * 0.14,
    };
  });
}

function TrailParticle({
  cfg,
  time,
  radius,
  spacing,
  omega,
  primary,
  accent,
}: {
  cfg: TrailParticleConfig;
  time: Animated.SharedValue<number>;
  radius: number;
  spacing: number;
  omega: number;
  primary: string;
  accent: string;
}) {
  const style = useAnimatedStyle(() => {
    const theta = (time.value * omega) % TAU;
    const angle = theta - cfg.index * spacing;
    const pulse = 0.94 + ((Math.sin(time.value * cfg.pulseFreq + cfg.pulsePhase) + 1) * 0.5) * 0.14;

    return {
      transform: [{ translateX: Math.cos(angle) * radius }, { translateY: Math.sin(angle) * radius }, { scale: pulse }],
      opacity: cfg.opacity,
    };
  });

  return (
    <Animated.View style={[styles.dotAnchor, style]}>
      <View
        style={[
          styles.dotGlow,
          {
            width: cfg.glowSize,
            height: cfg.glowSize,
            borderRadius: cfg.glowSize,
            backgroundColor: withAlpha(accent, 0.36 * cfg.opacity),
          },
        ]}
      />
      <View
        style={[
          styles.dotCore,
          {
            width: cfg.size,
            height: cfg.size,
            borderRadius: cfg.size,
            backgroundColor: cfg.index === 0 ? accent : primary,
            shadowColor: accent,
            opacity: cfg.opacity,
          },
        ]}
      />
    </Animated.View>
  );
}

function DustParticle({
  cfg,
  time,
  radius,
  spacing,
  omega,
  color,
}: {
  cfg: DustConfig;
  time: Animated.SharedValue<number>;
  radius: number;
  spacing: number;
  omega: number;
  color: string;
}) {
  const style = useAnimatedStyle(() => {
    const t = time.value + cfg.offset;
    const cycleAge = t % cfg.period;

    if (cycleAge > cfg.life) {
      return {
        opacity: 0,
        transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 0.8 }],
      };
    }

    const progress = cycleAge / cfg.life;
    const spawnTime = t - cycleAge;
    const birthTheta = (spawnTime * omega) % TAU;
    const angle = birthTheta - cfg.tailIndex * spacing;

    const nx = Math.cos(angle);
    const ny = Math.sin(angle);
    const tx = -Math.sin(angle);
    const ty = Math.cos(angle);

    let dx = nx * cfg.out + tx * cfg.side;
    let dy = ny * cfg.out + ty * cfg.side;
    const inv = 1 / Math.max(0.0001, Math.hypot(dx, dy));
    dx *= inv;
    dy *= inv;

    const eased = 1 - Math.pow(1 - progress, 2);
    const startX = Math.cos(angle) * (radius - 1);
    const startY = Math.sin(angle) * (radius - 1);
    const drift = progress * cfg.phaseDrift;

    const opacityIn = progress < 0.16 ? progress / 0.16 : 1;
    const opacityOut = progress > 0.7 ? (1 - progress) / 0.3 : 1;
    const opacity = cfg.opacityMax * Math.min(opacityIn, opacityOut);

    return {
      opacity,
      transform: [
        { translateX: startX + dx * cfg.travel * eased + tx * drift },
        { translateY: startY + dy * cfg.travel * eased + ty * drift },
        { scale: 1.05 - progress * 0.4 },
      ],
    };
  });

  return (
    <Animated.View style={[styles.dotAnchor, style]}>
      <View
        style={[
          styles.dustGlow,
          {
            width: cfg.glowSize,
            height: cfg.glowSize,
            borderRadius: cfg.glowSize,
            backgroundColor: withAlpha(color, 0.22),
          },
        ]}
      />
      <View
        style={[
          styles.dustCore,
          {
            width: cfg.size,
            height: cfg.size,
            borderRadius: cfg.size,
            backgroundColor: color,
          },
        ]}
      />
    </Animated.View>
  );
}

export default function MagicParticlesLoader({
  visible = true,
  size = 104,
  color,
  secondaryColor,
  text,
  overlay = false,
  fullScreen = false,
  blur = false,
  withinModal = false,
  containerStyle,
  particleCount = DEFAULT_TRAIL,
  speed = 1,
  hueRange,
}: MagicParticlesLoaderProps) {
  const scheme = useColorScheme();

  const primary = color ?? (scheme === 'dark' ? '#67E8F9' : '#0E7490');
  const hueTint = hueRange ? hueRange[0] : null;
  const accent =
    secondaryColor ??
    (hueTint !== null ? `hsl(${hueTint}, 92%, 76%)` : scheme === 'dark' ? '#BAE6FD' : '#A5F3FC');

  const count = clamp(particleCount, MIN_TRAIL, MAX_TRAIL);
  const normalizedSpeed = clamp(speed, 0.85, 1.25);
  const spinMs = DEFAULT_SPIN_MS / normalizedSpeed;
  const omega = TAU / (spinMs / 1000);
  const radius = size * 0.39;
  const spacing = 0.17;

  const trail = useMemo(() => buildTrailConfig(count, size), [count, size]);
  const dust = useMemo(() => buildDustConfig(DUST_POOL, count), [count]);

  const time = useSharedValue(0);
  const lastTs = useSharedValue(0);
  const active = useSharedValue(visible ? 1 : 0);
  const haloPulse = useSharedValue(0);

  useEffect(() => {
    active.value = visible ? 1 : 0;
    if (!visible) {
      lastTs.value = 0;
    }
  }, [active, lastTs, visible]);

  useEffect(() => {
    haloPulse.value = withRepeat(
      withTiming(1, {
        duration: 1800,
        easing: Easing.inOut(Easing.quad),
      }),
      -1,
      true
    );
  }, [haloPulse]);

  useFrameCallback((frame) => {
    if (!active.value) return;
    if (lastTs.value === 0) {
      lastTs.value = frame.timestamp;
      return;
    }
    const dt = (frame.timestamp - lastTs.value) / 1000;
    lastTs.value = frame.timestamp;
    time.value += Math.min(0.05, dt);
  });

  const haloStyle = useAnimatedStyle(() => {
    const p = 0.96 + haloPulse.value * 0.08;
    return {
      transform: [{ scale: p }],
      opacity: 0.06 + haloPulse.value * 0.06,
    };
  });

  if (!visible) return null;

  const core = (
    <View style={[styles.loaderWrap, containerStyle]}>
      <View style={[styles.loaderFrame, { width: size, height: size }]}> 
        <Animated.View
          style={[
            styles.softHalo,
            {
              width: size * 2.4,
              height: size * 2.4,
              borderRadius: size * 2.4,
              backgroundColor: withAlpha(accent, scheme === 'dark' ? 0.13 : 0.1),
            },
            haloStyle,
          ]}
        />

        {trail.map((cfg) => (
          <TrailParticle
            key={`trail-${cfg.index}`}
            cfg={cfg}
            time={time}
            radius={radius}
            spacing={spacing}
            omega={omega}
            primary={primary}
            accent={accent}
          />
        ))}

        {dust.map((cfg) => (
          <DustParticle
            key={`dust-${cfg.index}`}
            cfg={cfg}
            time={time}
            radius={radius}
            spacing={spacing}
            omega={omega}
            color={accent}
          />
        ))}
      </View>
    </View>
  );

  if (!overlay) return core;

  const bgColor = scheme === 'dark' ? 'rgba(2, 6, 23, 0.46)' : 'rgba(248, 250, 252, 0.55)';
  const shouldUseNativeModal = fullScreen && Platform.OS !== 'web' && !withinModal;

  if (shouldUseNativeModal) {
    return (
      <Modal transparent visible animationType="none" statusBarTranslucent>
        {blur && BlurView ? (
          <View style={[StyleSheet.absoluteFillObject, styles.overlayRoot]}>
            <BlurView intensity={26} tint={scheme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFillObject} />
            <CenteredOverlay absolute>{core}</CenteredOverlay>
          </View>
        ) : (
          <CenteredOverlay absolute backgroundColor={bgColor} style={styles.overlayRoot}>
            {core}
          </CenteredOverlay>
        )}
      </Modal>
    );
  }

  if (blur && BlurView) {
    return (
      <View style={[StyleSheet.absoluteFillObject, styles.overlayRoot]} pointerEvents="auto">
        <BlurView intensity={24} tint={scheme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFillObject} />
        <CenteredOverlay absolute>{core}</CenteredOverlay>
      </View>
    );
  }

  return (
    <CenteredOverlay absolute backgroundColor={bgColor} style={styles.overlayRoot}>
      {core}
    </CenteredOverlay>
  );
}

const styles = StyleSheet.create({
  loaderWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderFrame: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  softHalo: {
    position: 'absolute',
  },
  dotAnchor: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotGlow: {
    position: 'absolute',
  },
  dotCore: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: Platform.OS === 'web' ? 0.45 : 0.74,
    shadowRadius: 10,
    elevation: 5,
  },
  dustGlow: {
    position: 'absolute',
  },
  dustCore: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: Platform.OS === 'web' ? 0.2 : 0.35,
    shadowRadius: 3,
  },
  overlayRoot: {
    zIndex: 12000,
    elevation: 12000,
  },
});
