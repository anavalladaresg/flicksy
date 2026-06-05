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
      container: isDark ? 'rgba(18,24,33,0.72)' : 'rgba(248,246,241,0.84)',
      border: isDark ? 'rgba(42,53,69,0.68)' : 'rgba(122,112,96,0.16)',
      text: isDark ? '#E6EDF3' : '#0F172A',
      mutedText: isDark ? '#9FB0C3' : '#625F59',
      highlight: isDark ? 'rgba(124,158,255,0.16)' : 'rgba(14,116,144,0.08)',
      ripple: isDark ? 'rgba(124,158,255,0.18)' : 'rgba(14,116,144,0.12)',
      badge: isDark ? '#FF7A7A' : '#EF4444',
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
          },
          Platform.OS === 'web'
            ? ({
                backdropFilter: 'blur(18px)',
                WebkitBackdropFilter: 'blur(18px)',
                boxShadow: isDark
                  ? '0 16px 42px rgba(0,0,0,0.28), inset 0 1px 0 rgba(230,237,243,0.04)'
                  : '0 16px 36px rgba(67,56,39,0.1), inset 0 1px 0 rgba(255,255,255,0.55)',
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 6,
    alignItems: 'center',
    zIndex: 120,
  },
  wrapperCompact: {
    paddingHorizontal: 8,
  },
  container: {
    position: 'relative',
    flexDirection: 'row',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 999,
    overflow: 'hidden',
    minHeight: 48,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 620,
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
    width: 142,
    zIndex: 1,
    paddingHorizontal: 5,
    paddingVertical: 4,
  },
  itemSlotCompact: {
    flex: 1,
    width: undefined,
    minWidth: 0,
    paddingHorizontal: 1,
  },
  itemButton: {
    height: 40,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    overflow: 'hidden',
    position: 'relative',
  },
  itemLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
  },
  itemLabelCompact: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0,
  },
  badge: {
    position: 'absolute',
    top: 7,
    right: 13,
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
    width: 150,
    borderRadius: 999,
    backgroundColor: '#7C9EFF',
    zIndex: 0,
  },
});

export default DynamicTopTabs;
