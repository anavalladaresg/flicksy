import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { ClerkProvider } from '@clerk/clerk-expo';
import { tokenCache } from '@clerk/clerk-expo/token-cache';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import 'react-native-reanimated';

import { useAuthStatus } from '@/src/hooks/use-auth-status';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { QueryProvider } from '../src/providers/QueryProvider';
import { CLERK_PUBLISHABLE_KEY, isClerkConfigured } from '../src/services/clerk';
import { clerkEsLocalization } from '../src/services/clerk-localization';
import { configureNotifications, registerPushToken } from '../src/services/notifications';
import { saveOwnPushToken } from '../src/services/social';
import { showInAppNotification } from '../src/services/in-app-notifications';
import { evaluateAchievementUnlocks } from '../src/features/achievements/catalog';
import { usePreferencesStore } from '../src/store/preferences';
import { useTrackingStore } from '../src/store/tracking';
import AppToaster from '../src/components/common/AppToaster';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
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

function AchievementUnlockWatcher() {
  const trackedItems = useTrackingStore((state) => state.items);
  const alertsAchievements = usePreferencesStore((state) => state.alertsAchievements);
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
      const date = new Date(item.watchedAt || item.finishedAt || item.dateAdded);
      if (Number.isNaN(date.getTime())) return false;
      return periodKey(date, movieGoalPeriod) === key;
    }).length;
  }, [movieGoalPeriod, trackedItems]);

  const gameGoalProgress = useMemo(() => {
    const now = new Date();
    const key = periodKey(now, gameGoalPeriod);
    return trackedItems.filter((item) => {
      if (item.mediaType !== 'game' || item.status !== 'completed') return false;
      const date = new Date(item.finishedAt || item.dateAdded);
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

    if (alertsAchievements) {
      const first = newAchievements[0];
      const extraCount = newAchievements.length - 1;
      showInAppNotification(
        'success',
        'Logro desbloqueado',
        extraCount > 0 ? `${first.title} y ${extraCount} logro(s) mas.` : first.title
      );
    }
  }, [alertsAchievements, unlockAchievement, unlockedAchievementIds, unlockedAchievementsByMetrics]);

  return null;
}

function RootLayoutContent() {
  const colorScheme = useColorScheme();
  const { isLoading: isAuthLoading, isSignedIn } = useAuthStatus();
  const floatingModalOptions = Platform.OS === 'web'
    ? ({ presentation: 'transparentModal', animation: 'fade', headerShown: false, contentStyle: { backgroundColor: 'transparent' } } as const)
    : ({ presentation: 'modal', headerShown: false } as const);

  useEffect(() => {
    configureNotifications();
  }, []);

  useEffect(() => {
    if (isSignedIn) {
      void useTrackingStore.getState().bootstrapRemote();
      void (async () => {
        const token = await registerPushToken();
        if (token) await saveOwnPushToken(token);
      })();
    } else {
      useTrackingStore.setState({ items: [], remoteReady: false });
    }
  }, [isSignedIn]);

  if (isAuthLoading) {
    return (
      <QueryProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colorScheme === 'dark' ? '#0B1220' : '#F8FAFC' }}>
            <ActivityIndicator size="large" color="#0E7490" />
          </View>
          <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        </ThemeProvider>
      </QueryProvider>
    );
  }

  return (
    <QueryProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="auth" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="browse/[type]" options={{ headerShown: false }} />
          <Stack.Screen name="movie/[id]" options={floatingModalOptions} />
          <Stack.Screen name="tv/[id]" options={floatingModalOptions} />
          <Stack.Screen name="game/[id]" options={floatingModalOptions} />
          <Stack.Screen name="friends" options={floatingModalOptions} />
          <Stack.Screen name="achievements" options={floatingModalOptions} />
          <Stack.Screen name="friend/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <AchievementUnlockWatcher />
        <AppToaster />
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      </ThemeProvider>
    </QueryProvider>
  );
}
