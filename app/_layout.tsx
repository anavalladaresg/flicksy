import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { ClerkProvider } from '@clerk/clerk-expo';
import { tokenCache } from '@clerk/clerk-expo/token-cache';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import React, { useEffect, useMemo } from 'react';
import { Platform, Text, TextInput, View } from 'react-native';
import 'react-native-reanimated';

import { useAuthStatus } from '@/src/hooks/use-auth-status';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Fonts } from '@/constants/theme';
import { QueryProvider } from '../src/providers/QueryProvider';
import { LoadingProvider } from '../src/providers/LoadingProvider';
import { CLERK_PUBLISHABLE_KEY, isClerkConfigured } from '../src/services/clerk';
import { clerkEsLocalization } from '../src/services/clerk-localization';
import { evaluateAchievementUnlocks } from '../src/features/achievements/catalog';
import { usePreferencesStore } from '../src/store/preferences';
import { useTrackingStore } from '../src/store/tracking';
import MagicLoader from '../components/loaders/MagicLoader';

export const unstable_settings = {
  anchor: '(tabs)',
};

let globalFontApplied = false;
const APP_LIGHT_BACKGROUND = '#F1EFEA';
const APP_DARK_BACKGROUND = '#0B0F14';

const FlicksyLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#0E7490',
    background: APP_LIGHT_BACKGROUND,
    card: '#F8F6F1',
    border: '#DED8CC',
    text: '#0F172A',
  },
};

const FlicksyDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: '#7C9EFF',
    background: APP_DARK_BACKGROUND,
    card: '#121821',
    border: '#2A3545',
    text: '#E6EDF3',
  },
};

export default function RootLayout() {
  if (!globalFontApplied) {
    const fontTokens = Fonts as any;
    const globalFontFamily = (Platform.OS === 'web' ? fontTokens.web?.sans : fontTokens.sans) || 'System';
    const AppText = Text as any;
    const AppTextInput = TextInput as any;
    AppText.defaultProps = AppText.defaultProps || {};
    AppText.defaultProps.style = [AppText.defaultProps.style, { fontFamily: globalFontFamily }];
    AppTextInput.defaultProps = AppTextInput.defaultProps || {};
    AppTextInput.defaultProps.style = [AppTextInput.defaultProps.style, { fontFamily: globalFontFamily }];
    globalFontApplied = true;
  }

  if (!isClerkConfigured) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0B0F14', paddingHorizontal: 20 }}>
        <Text style={{ color: '#E5E7EB', fontSize: 14, textAlign: 'center' }}>
          Falta la configuración de Clerk. Añade EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY.
        </Text>
      </View>
    );
  }

  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache} localization={clerkEsLocalization as any}>
      <RootLayoutContent />
    </ClerkProvider>
  );
}

function mondayWeekKey(date: Date): string {
  const d = new Date(date);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  return d.toISOString().slice(0, 10);
}

function periodKey(date: Date, period: 'weekly' | 'monthly'): string {
  if (period === 'monthly') return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  return `W-${mondayWeekKey(date)}`;
}

function hasApproximateDateFlag(item: any): boolean {
  return Boolean(item.watchedAtApproximate || item.startedAtApproximate || item.finishedAtApproximate);
}

function metricDateForMovie(item: any): string | null {
  if (item.mediaType !== 'movie') return null;
  if (item.watchedAt && !item.watchedAtApproximate) return item.watchedAt;
  if (item.finishedAt && !item.finishedAtApproximate) return item.finishedAt;
  if (hasApproximateDateFlag(item)) return null;
  return item.dateAdded || null;
}

function metricDateForGame(item: any): string | null {
  if (item.mediaType !== 'game') return null;
  if (item.finishedAt && !item.finishedAtApproximate) return item.finishedAt;
  if (item.startedAt && !item.startedAtApproximate) return item.startedAt;
  if (hasApproximateDateFlag(item)) return null;
  return item.dateAdded || null;
}

function AchievementUnlockWatcher() {
  const trackedItems = (useTrackingStore((state: any) => state.items) ?? []) as any[];
  const monthlyMovieGoal = usePreferencesStore((state: any) => state.monthlyMovieGoal as number);
  const monthlyGameGoal = usePreferencesStore((state: any) => state.monthlyGameGoal as number);
  const movieGoalPeriod = usePreferencesStore((state: any) => state.movieGoalPeriod as 'weekly' | 'monthly');
  const gameGoalPeriod = usePreferencesStore((state: any) => state.gameGoalPeriod as 'weekly' | 'monthly');
  const goalPeriodStatuses = usePreferencesStore((state: any) => state.goalPeriodStatuses as Record<string, 'success' | 'fail'>);
  const unlockedAchievementIds = usePreferencesStore((state: any) => state.unlockedAchievementIds as string[]);
  const unlockAchievement = usePreferencesStore((state: any) => state.unlockAchievement as (id: string) => void);

  const topGenresCount = useMemo(() => {
    const unique = new Set<string>();
    trackedItems.forEach((item) => (item.genres as string[] | undefined)?.forEach((genre) => unique.add(genre)));
    return unique.size;
  }, [trackedItems]);

  const movieGoalProgress = useMemo(() => {
    const now = new Date();
    const key = periodKey(now, movieGoalPeriod);
    return trackedItems.filter((item) => {
      if (item.mediaType !== 'movie') return false;
      const metricDate = metricDateForMovie(item);
      if (!metricDate) return false;
      const date = new Date(metricDate);
      if (Number.isNaN(date.getTime())) return false;
      return periodKey(date, movieGoalPeriod) === key;
    }).length;
  }, [movieGoalPeriod, trackedItems]);

  const gameGoalProgress = useMemo(() => {
    const now = new Date();
    const key = periodKey(now, gameGoalPeriod);
    return trackedItems.filter((item) => {
      if (item.mediaType !== 'game' || item.status !== 'completed') return false;
      const metricDate = metricDateForGame(item);
      if (!metricDate) return false;
      const date = new Date(metricDate);
      if (Number.isNaN(date.getTime())) return false;
      return periodKey(date, gameGoalPeriod) === key;
    }).length;
  }, [gameGoalPeriod, trackedItems]);

  const unlockedAchievementsByMetrics = useMemo(
    () =>
      evaluateAchievementUnlocks({
        trackedItems,
        topGenresCount,
        monthlyMovieGoal,
        monthlyGameGoal,
        movieGoalProgress,
        gameGoalProgress,
        goalPeriodStatuses,
      }),
    [trackedItems, topGenresCount, monthlyMovieGoal, monthlyGameGoal, movieGoalProgress, gameGoalProgress, goalPeriodStatuses]
  );

  useEffect(() => {
    const newAchievements = unlockedAchievementsByMetrics.filter((achievement) => !unlockedAchievementIds.includes(achievement.id));
    if (newAchievements.length === 0) return;

    newAchievements.forEach((achievement) => unlockAchievement(achievement.id));
  }, [unlockAchievement, unlockedAchievementIds, unlockedAchievementsByMetrics]);

  return null;
}

function RootLayoutContent() {
  const colorScheme = useColorScheme();
  const appTheme = colorScheme === 'dark' ? FlicksyDarkTheme : FlicksyLightTheme;
  const statusBarBackgroundColor = Platform.OS !== 'web' ? appTheme.colors.background : undefined;
  const { isLoading: isAuthLoading, isSignedIn } = useAuthStatus();
  const floatingModalOptions = Platform.OS === 'web'
    ? ({ presentation: 'transparentModal', animation: 'fade', headerShown: false, contentStyle: { backgroundColor: 'transparent' } } as const)
    : ({ presentation: 'modal', headerShown: false } as const);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof document === 'undefined') return;
    const viewport = document.querySelector('meta[name=\"viewport\"]');
    if (!viewport) return;
    viewport.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    void SystemUI.setBackgroundColorAsync(appTheme.colors.background).catch(() => undefined);
  }, [appTheme.colors.background]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof document === 'undefined') return;
    const desiredTitle = 'Flicksy';
    document.title = desiredTitle;

    const titleNode = document.querySelector('title');
    if (!titleNode || typeof MutationObserver === 'undefined') return;

    const observer = new MutationObserver(() => {
      if (document.title !== desiredTitle) document.title = desiredTitle;
    });
    observer.observe(titleNode, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof document === 'undefined') return;
    const color = appTheme.colors.background;
    const themeColorMetas = Array.from(
      document.querySelectorAll('meta[name="theme-color"]')
    ) as HTMLMetaElement[];
    if (themeColorMetas.length === 0) {
      const themeColorMeta = document.createElement('meta');
      themeColorMeta.setAttribute('name', 'theme-color');
      themeColorMeta.setAttribute('content', color);
      document.head.appendChild(themeColorMeta);
    } else {
      themeColorMetas.forEach((meta) => meta.setAttribute('content', color));
    }

    let appleStatusMeta = document.querySelector(
      'meta[name="apple-mobile-web-app-status-bar-style"]'
    ) as HTMLMetaElement | null;
    if (!appleStatusMeta) {
      appleStatusMeta = document.createElement('meta');
      appleStatusMeta.setAttribute('name', 'apple-mobile-web-app-status-bar-style');
      document.head.appendChild(appleStatusMeta);
    }
    appleStatusMeta.setAttribute(
      'content',
      colorScheme === 'dark' ? 'black-translucent' : 'default'
    );

    document.documentElement.style.backgroundColor = color;
    if (document.body) document.body.style.backgroundColor = color;
  }, [appTheme.colors.background, colorScheme]);

  useEffect(() => {
    if (isSignedIn) {
      void useTrackingStore.getState().bootstrapRemote();
    } else {
      useTrackingStore.setState({ items: [], remoteReady: false });
    }
  }, [isSignedIn]);

  if (isAuthLoading) {
    return (
      <QueryProvider>
        <ThemeProvider value={appTheme}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: appTheme.colors.background }}>
            <MagicLoader size={56} text="Cargando sesión..." />
          </View>
          <StatusBar
            style={colorScheme === 'dark' ? 'light' : 'dark'}
            backgroundColor={statusBarBackgroundColor}
            translucent={Platform.OS === 'android' ? false : undefined}
          />
        </ThemeProvider>
      </QueryProvider>
    );
  }

  return (
    <QueryProvider>
      <ThemeProvider value={appTheme}>
        <LoadingProvider>
          <Stack screenOptions={{ contentStyle: { backgroundColor: appTheme.colors.background } }}>
            <Stack.Screen name="auth" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="browse/[type]" options={floatingModalOptions} />
            <Stack.Screen name="movie/[id]" options={floatingModalOptions} />
            <Stack.Screen name="tv/[id]" options={floatingModalOptions} />
            <Stack.Screen name="game/[id]" options={floatingModalOptions} />
            <Stack.Screen name="friends" options={floatingModalOptions} />
            <Stack.Screen name="achievements" options={floatingModalOptions} />
            <Stack.Screen name="friend/[id]" options={floatingModalOptions} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          </Stack>
          <AchievementUnlockWatcher />
          <StatusBar
            style={colorScheme === 'dark' ? 'light' : 'dark'}
            backgroundColor={statusBarBackgroundColor}
            translucent={Platform.OS === 'android' ? false : undefined}
          />
        </LoadingProvider>
      </ThemeProvider>
    </QueryProvider>
  );
}
