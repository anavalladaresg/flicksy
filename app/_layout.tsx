import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { ClerkProvider } from '@clerk/clerk-expo';
import { tokenCache } from '@clerk/clerk-expo/token-cache';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
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

export default function RootLayout() {
  if (!globalFontApplied) {
    const globalFontFamily = (Platform.OS === 'web' ? Fonts.web?.sans : Fonts.sans) || 'System';
    Text.defaultProps = Text.defaultProps || {};
    Text.defaultProps.style = [Text.defaultProps.style, { fontFamily: globalFontFamily }];
    TextInput.defaultProps = TextInput.defaultProps || {};
    TextInput.defaultProps.style = [TextInput.defaultProps.style, { fontFamily: globalFontFamily }];
    globalFontApplied = true;
  }

  if (!isClerkConfigured) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0B1220', paddingHorizontal: 20 }}>
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
  const trackedItems = useTrackingStore((state) => state.items);
  const monthlyMovieGoal = usePreferencesStore((state) => state.monthlyMovieGoal);
  const monthlyGameGoal = usePreferencesStore((state) => state.monthlyGameGoal);
  const movieGoalPeriod = usePreferencesStore((state) => state.movieGoalPeriod);
  const gameGoalPeriod = usePreferencesStore((state) => state.gameGoalPeriod);
  const goalPeriodStatuses = usePreferencesStore((state) => state.goalPeriodStatuses);
  const unlockedAchievementIds = usePreferencesStore((state) => state.unlockedAchievementIds);
  const unlockAchievement = usePreferencesStore((state) => state.unlockAchievement);

  const topGenresCount = useMemo(() => {
    const unique = new Set<string>();
    trackedItems.forEach((item) => item.genres?.forEach((genre) => unique.add(genre)));
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
    if (isSignedIn) {
      void useTrackingStore.getState().bootstrapRemote();
    } else {
      useTrackingStore.setState({ items: [], remoteReady: false });
    }
  }, [isSignedIn]);

  if (isAuthLoading) {
    return (
      <QueryProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colorScheme === 'dark' ? '#0B1220' : '#F8FAFC' }}>
            <MagicLoader size={56} text="Cargando sesión..." />
          </View>
          <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        </ThemeProvider>
      </QueryProvider>
    );
  }

  return (
    <QueryProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <LoadingProvider>
          <Stack>
            <Stack.Screen name="auth" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="browse/[type]" options={{ headerShown: false }} />
            <Stack.Screen name="movie/[id]" options={floatingModalOptions} />
            <Stack.Screen name="tv/[id]" options={floatingModalOptions} />
            <Stack.Screen name="game/[id]" options={floatingModalOptions} />
            <Stack.Screen name="friends" options={floatingModalOptions} />
            <Stack.Screen name="achievements" options={floatingModalOptions} />
            <Stack.Screen name="friend/[id]" options={floatingModalOptions} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          </Stack>
          <AchievementUnlockWatcher />
          <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        </LoadingProvider>
      </ThemeProvider>
    </QueryProvider>
  );
}
