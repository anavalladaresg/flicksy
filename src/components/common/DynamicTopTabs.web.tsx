import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

type DynamicTopTabsProps = BottomTabBarProps & {
  isDark: boolean;
  pendingRequests: number;
  activeColor: string;
};

type Ripple = {
  id: number;
  x: number;
  y: number;
  size: number;
};

function DynamicTopTabs({ state, descriptors, navigation, isDark, pendingRequests, activeColor }: DynamicTopTabsProps) {
  const { width } = useWindowDimensions();
  const compact = width < 560;
  const [itemLayouts, setItemLayouts] = useState<Record<string, { x: number; width: number }>>({});
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [ripples, setRipples] = useState<Record<string, Ripple[]>>({});
  const rippleId = useRef(0);
  const sheenAnim = useRef(new Animated.Value(0)).current;

  const activeRoute = state.routes[state.index];
  const highlightRouteKey = hoveredKey ?? activeRoute.key;
  const highlightLayout = itemLayouts[highlightRouteKey];

  const colors = useMemo(
    () => ({
      container: isDark ? 'rgba(30,41,59,0.18)' : 'rgba(255,255,255,0.7)',
      border: isDark ? 'rgba(125,211,252,0.28)' : 'rgba(148,163,184,0.3)',
      text: isDark ? '#E2E8F0' : '#0F172A',
      mutedText: isDark ? '#94A3B8' : '#475569',
      highlight: isDark ? 'rgba(125,211,252,0.2)' : 'rgba(14,116,144,0.14)',
      glow: isDark ? 'rgba(56,189,248,0.35)' : 'rgba(14,116,144,0.22)',
      ripple: isDark ? 'rgba(186,230,253,0.28)' : 'rgba(14,116,144,0.2)',
      badge: '#EF4444',
    }),
    [isDark]
  );

  const removeRipple = (routeKey: string, id: number) => {
    setRipples((prev) => ({
      ...prev,
      [routeKey]: (prev[routeKey] ?? []).filter((ripple) => ripple.id !== id),
    }));
  };

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(sheenAnim, {
        toValue: 1,
        duration: 3600,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => {
      loop.stop();
      sheenAnim.setValue(0);
    };
  }, [sheenAnim]);

  const sheenTranslate = sheenAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-260, 620],
  });

  return (
    <View style={[styles.wrapper, compact && styles.wrapperCompact]}>
      <View
        accessibilityRole="tablist"
        style={[
          styles.container,
          compact && styles.containerCompact,
          {
            backgroundColor: colors.container,
            borderColor: colors.border,
            shadowColor: colors.glow,
          },
          Platform.OS === 'web'
            ? ({
                backdropFilter: isDark ? 'none' : 'blur(16px)',
                WebkitBackdropFilter: isDark ? 'none' : 'blur(16px)',
              } as any)
            : null,
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.sheen,
            {
              opacity: isDark ? 0.08 : 0.12,
              transform: [{ translateX: sheenTranslate }, { rotate: '14deg' }],
            },
          ]}
        />

        {highlightLayout ? (
          <View
            pointerEvents="none"
            style={[
              styles.highlight,
              {
                width: highlightLayout.width,
                transform: [{ translateX: highlightLayout.x }],
                backgroundColor: colors.highlight,
              },
            ]}
          />
        ) : null}

        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const { options } = descriptors[route.key];
          const label = typeof options.title === 'string' ? options.title : route.name;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          return (
            <View
              key={route.key}
              style={[styles.itemSlot, compact && styles.itemSlotCompact]}
              onLayout={(event) => {
                const { x, width } = event.nativeEvent.layout;
                setItemLayouts((prev) => {
                  const current = prev[route.key];
                  if (current && current.x === x && current.width === width) return prev;
                  return { ...prev, [route.key]: { x, width } };
                });
              }}
            >
              <Pressable
                accessibilityRole="tab"
                accessibilityState={isFocused ? { selected: true } : {}}
                onPress={onPress}
                onLongPress={onLongPress}
                onHoverIn={() => setHoveredKey(route.key)}
                onHoverOut={() => setHoveredKey(null)}
                onPressIn={(event) => {
                  rippleId.current += 1;
                  const id = rippleId.current;
                  const size = 88;
                  const x = event.nativeEvent.locationX - size / 2;
                  const y = event.nativeEvent.locationY - size / 2;

                  setRipples((prev) => ({
                    ...prev,
                    [route.key]: [...(prev[route.key] ?? []), { id, x, y, size }],
                  }));

                  setTimeout(() => removeRipple(route.key, id), 280);
                }}
                style={styles.itemButton}
              >
                {(options.tabBarIcon as any)?.({
                  focused: isFocused,
                  color: isFocused ? activeColor : colors.mutedText,
                  size: 20,
                })}
                {!compact ? (
                  <Text style={[styles.itemLabel, { color: isFocused ? activeColor : colors.text }]}>{label}</Text>
                ) : null}

                {route.name === 'profile' && pendingRequests > 0 ? (
                  <View style={[styles.badge, { backgroundColor: colors.badge }]} />
                ) : null}

                {(ripples[route.key] ?? []).map((ripple) => (
                  <View
                    key={ripple.id}
                    pointerEvents="none"
                    style={[
                      styles.ripple,
                      {
                        left: ripple.x,
                        top: ripple.y,
                        width: ripple.size,
                        height: ripple.size,
                        backgroundColor: colors.ripple,
                      },
                    ]}
                  />
                ))}
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
    alignItems: 'center',
    position: 'relative',
    zIndex: 10,
  },
  wrapperCompact: {
    paddingHorizontal: 8,
  },
  container: {
    position: 'relative',
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 999,
    overflow: 'hidden',
    minHeight: 52,
    alignSelf: 'center',
    width: 'auto',
    maxWidth: 620,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
  },
  containerCompact: {
    width: '100%',
    maxWidth: 520,
  },
  highlight: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 0,
    borderRadius: 999,
    zIndex: 0,
    transitionDuration: '220ms' as any,
    transitionProperty: 'transform,width' as any,
    transitionTimingFunction: 'cubic-bezier(0.25,1,0.5,1)' as any,
  },
  itemSlot: {
    width: 124,
    zIndex: 1,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  itemSlotCompact: {
    flex: 1,
    width: undefined,
    minWidth: 0,
    paddingHorizontal: 1,
  },
  itemButton: {
    height: 44,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    overflow: 'hidden',
    position: 'relative',
  },
  itemLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  itemLabelCompact: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0,
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 14,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  ripple: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.3,
    transform: [{ scale: 1 }],
  },
  sheen: {
    position: 'absolute',
    top: -16,
    bottom: -16,
    width: 180,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    zIndex: 0,
  },
});

export default DynamicTopTabs;
