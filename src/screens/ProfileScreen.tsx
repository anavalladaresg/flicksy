import { MaterialIcons } from '@expo/vector-icons';
import { useClerk, useUser } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { ActivityIndicator, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import UserAvatar from '../components/common/UserAvatar';
import { gameRepository } from '../features/games/data/repositories';
import { movieRepository } from '../features/movies/data/repositories';
import { tvRepository } from '../features/tv/data/repositories';
import { isSupabaseConfigured, supabase } from '../services/supabase';
import {
  getOwnProfile,
  getFriendsCount,
  getFriendsList,
  getIncomingFriendRequests,
  isUsernameAvailable,
  respondFriendRequest,
  searchProfilesByUsername,
  sendFriendRequestByUserId,
  syncOwnProfile,
  updateOwnAvatar,
  type FriendProfile,
  type FriendRequestItem,
} from '../services/social';
import { getAvatarOptions, type AvatarOption } from '../services/avatars';
import { usePreferencesStore } from '../store/preferences';
import { useTrackingStore } from '../store/tracking';
import { MediaType, TrackedItem } from '../types';
import { sendLocalNotification } from '../services/notifications';
import { showInAppNotification } from '../services/in-app-notifications';
import { ACHIEVEMENT_DEFINITIONS } from '../features/achievements/catalog';

function averageRating(items: TrackedItem[], type: MediaType): number {
  const filtered = items.filter((item) => item.mediaType === type && typeof item.rating === 'number');
  if (filtered.length === 0) return 0;
  const sum = filtered.reduce((acc, item) => acc + (item.rating ?? 0), 0);
  return sum / filtered.length;
}

function mondayWeekKey(date: Date): string {
  const d = new Date(date);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  return d.toISOString().slice(0, 10);
}

function hasApproximateDateFlag(item: TrackedItem): boolean {
  return Boolean(item.watchedAtApproximate || item.startedAtApproximate || item.finishedAtApproximate);
}

function metricDatesForItem(item: TrackedItem): string[] {
  const exactDates = [
    item.watchedAtApproximate ? undefined : item.watchedAt,
    item.startedAtApproximate ? undefined : item.startedAt,
    item.finishedAtApproximate ? undefined : item.finishedAt,
  ].filter(Boolean) as string[];

  if (exactDates.length > 0) return exactDates;
  if (hasApproximateDateFlag(item)) return [];
  return item.dateAdded ? [item.dateAdded] : [];
}

function metricDateForMovie(item: TrackedItem): string | null {
  if (item.mediaType !== 'movie') return null;
  if (item.watchedAt && !item.watchedAtApproximate) return item.watchedAt;
  if (item.finishedAt && !item.finishedAtApproximate) return item.finishedAt;
  if (hasApproximateDateFlag(item)) return null;
  return item.dateAdded || null;
}

function metricDateForGame(item: TrackedItem): string | null {
  if (item.mediaType !== 'game') return null;
  if (item.finishedAt && !item.finishedAtApproximate) return item.finishedAt;
  if (item.startedAt && !item.startedAtApproximate) return item.startedAt;
  if (hasApproximateDateFlag(item)) return null;
  return item.dateAdded || null;
}

function weeklyStreak(items: TrackedItem[]): number {
  const dates = new Set<string>();
  for (const item of items) {
    const candidates = metricDatesForItem(item);
    candidates.forEach((iso) => {
      const dt = new Date(iso);
      if (!Number.isNaN(dt.getTime())) dates.add(mondayWeekKey(dt));
    });
  }
  if (dates.size === 0) return 0;

  let streak = 0;
  const cursor = new Date();
  while (true) {
    const key = mondayWeekKey(cursor);
    if (!dates.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 7);
  }
  return streak;
}

function isCurrentMonth(iso?: string): boolean {
  if (!iso) return false;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

function periodKey(date: Date, period: 'weekly' | 'monthly'): string {
  if (period === 'monthly') return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  return `W-${mondayWeekKey(date)}`;
}

function previousPeriodDate(period: 'weekly' | 'monthly', from = new Date()): Date {
  const copy = new Date(from);
  if (period === 'monthly') copy.setMonth(copy.getMonth() - 1);
  else copy.setDate(copy.getDate() - 7);
  return copy;
}

function ProfileScreen() {
  const isDark = useColorScheme() === 'dark';
  const router = useRouter();
  const { signOut } = useClerk();
  const { user } = useUser();
  const username = usePreferencesStore((state) => state.username);
  const themeMode = usePreferencesStore((state) => state.themeMode);
  const setThemeMode = usePreferencesStore((state) => state.setThemeMode);
  const alertsFriendRequests = usePreferencesStore((state) => state.alertsFriendRequests);
  const alertsGoals = usePreferencesStore((state) => state.alertsGoals);
  const monthlyMovieGoal = usePreferencesStore((state) => state.monthlyMovieGoal);
  const monthlyGameGoal = usePreferencesStore((state) => state.monthlyGameGoal);
  const movieGoalPeriod = usePreferencesStore((state) => state.movieGoalPeriod);
  const gameGoalPeriod = usePreferencesStore((state) => state.gameGoalPeriod);
  const setMovieGoalPeriod = usePreferencesStore((state) => state.setMovieGoalPeriod);
  const setGameGoalPeriod = usePreferencesStore((state) => state.setGameGoalPeriod);
  const setMonthlyMovieGoal = usePreferencesStore((state) => state.setMonthlyMovieGoal);
  const setMonthlyGameGoal = usePreferencesStore((state) => state.setMonthlyGameGoal);
  const goalPeriodStatuses = usePreferencesStore((state) => state.goalPeriodStatuses);
  const setGoalPeriodStatus = usePreferencesStore((state) => state.setGoalPeriodStatus);
  const setUsername = usePreferencesStore((state) => state.setUsername);
  const storedProfileAvatarUrl = usePreferencesStore((state) => state.profileAvatarUrl);
  const setStoredProfileAvatarUrl = usePreferencesStore((state) => state.setProfileAvatarUrl);
  const unlockedAchievementIds = usePreferencesStore((state) => state.unlockedAchievementIds);
  const trackedItems = useTrackingStore((state) => state.items);
  const darkEnabled = themeMode === 'dark';
  const isWeb = Platform.OS === 'web';
  const { width: windowWidth } = useWindowDimensions();
  const useWebBento = isWeb && windowWidth >= 920;
  const isCompactProfile = windowWidth < 640;
  const [isEditNameOpen, setIsEditNameOpen] = useState(false);
  const emailAddress = user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || '';
  const computedUsername = (emailAddress.split('@')[0] || username || 'usuario').toLowerCase();
  const displayName = user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || computedUsername;
  const [nameDraft, setNameDraft] = useState(computedUsername);
  const [nameSaving, setNameSaving] = useState(false);
  const [isEditAvatarOpen, setIsEditAvatarOpen] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarOptions, setAvatarOptions] = useState<AvatarOption[]>([]);
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(storedProfileAvatarUrl);
  const [friendsQuery, setFriendsQuery] = useState('');
  const [friendResults, setFriendResults] = useState<FriendProfile[]>([]);
  const [friendsPreview, setFriendsPreview] = useState<FriendProfile[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequestItem[]>([]);
  const [friendsCount, setFriendsCount] = useState(0);
  const [friendMessage, setFriendMessage] = useState('');
  const googleAccountImage =
    ((user?.externalAccounts as any[])?.find((account: any) => account?.provider === 'oauth_google')?.imageUrl as string | undefined) ||
    null;
  const effectiveAvatarUrl = profileAvatarUrl || storedProfileAvatarUrl || googleAccountImage || null;

  const movieIds = useMemo(
    () => Array.from(new Set(trackedItems.filter((item) => item.mediaType === 'movie').map((item) => item.externalId))).slice(0, 20),
    [trackedItems]
  );
  const tvIds = useMemo(
    () => Array.from(new Set(trackedItems.filter((item) => item.mediaType === 'tv').map((item) => item.externalId))).slice(0, 20),
    [trackedItems]
  );
  const gameIds = useMemo(
    () => Array.from(new Set(trackedItems.filter((item) => item.mediaType === 'game').map((item) => item.externalId))).slice(0, 20),
    [trackedItems]
  );

  const movieQueries = useQueries({
    queries: movieIds.map((id) => ({
      queryKey: ['profile', 'movieDetails', id],
      queryFn: () => movieRepository.getMovieDetails(id),
      staleTime: 1000 * 60 * 30,
    })),
  });
  const tvQueries = useQueries({
    queries: tvIds.map((id) => ({
      queryKey: ['profile', 'tvDetails', id],
      queryFn: () => tvRepository.getTVShowDetails(id),
      staleTime: 1000 * 60 * 30,
    })),
  });
  const gameQueries = useQueries({
    queries: gameIds.map((id) => ({
      queryKey: ['profile', 'gameDetails', id],
      queryFn: () => gameRepository.getGameDetails(id),
      staleTime: 1000 * 60 * 30,
      enabled: !isWeb,
    })),
  });

  const detailMovies = useMemo(() => movieQueries.map((q) => q.data).filter(Boolean), [movieQueries]);
  const detailTV = useMemo(() => tvQueries.map((q) => q.data).filter(Boolean), [tvQueries]);
  const detailGames = useMemo(() => gameQueries.map((q) => q.data).filter(Boolean), [gameQueries]);

  const avgMovie = averageRating(trackedItems, 'movie');
  const avgTV = averageRating(trackedItems, 'tv');
  const avgGame = averageRating(trackedItems, 'game');

  const { movieHours, tvHours, gameHours, estimatedHours } = useMemo(() => {
    const movieRuntimeMap = new Map(detailMovies.map((movie) => [movie.id, movie.runtime ?? 110]));
    const tvEpisodeMap = new Map(detailTV.map((show) => [show.id, show.number_of_episodes ?? ((show.number_of_seasons ?? 1) * 8)]));

    const movieHoursValue = trackedItems
      .filter((item) => item.mediaType === 'movie')
      .reduce((acc, item) => acc + ((item.estimatedHours ?? (movieRuntimeMap.get(item.externalId) ?? 110) / 60)), 0);

    const tvHoursValue = trackedItems
      .filter((item) => item.mediaType === 'tv')
      .reduce((acc, item) => {
        if (item.estimatedHours) return acc + item.estimatedHours;
        const episodes = tvEpisodeMap.get(item.externalId) ?? 8;
        const multiplier = item.status === 'completed' ? 1 : item.status === 'watching' ? 0.55 : 0.25;
        return acc + episodes * 0.75 * multiplier;
      }, 0);

    const gameHoursValue = trackedItems
      .filter((item) => item.mediaType === 'game')
      .reduce((acc, item) => {
        if (item.estimatedHours) return acc + item.estimatedHours;
        if (item.status === 'completed') return acc + 35;
        if (item.status === 'playing') return acc + 18;
        return acc + 7;
      }, 0);

    return {
      movieHours: movieHoursValue,
      tvHours: tvHoursValue,
      gameHours: gameHoursValue,
      estimatedHours: movieHoursValue + tvHoursValue + gameHoursValue,
    };
  }, [trackedItems, detailMovies, detailTV]);

  const topGenres = useMemo(() => {
    const counts = new Map<string, number>();
    const push = (name: string) => counts.set(name, (counts.get(name) ?? 0) + 1);
    trackedItems.forEach((item) => item.genres?.forEach((genre) => push(genre)));
    detailMovies.forEach((movie) => movie.genres?.forEach((genre) => push(genre.name)));
    detailTV.forEach((show) => show.genres?.forEach((genre) => push(genre.name)));
    detailGames.forEach((game) => game.genres?.forEach((genre) => push(genre.name)));

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name);
  }, [trackedItems, detailMovies, detailTV, detailGames]);

  const streak = weeklyStreak(trackedItems);

  const weeklyActivity = useMemo(() => {
    const days = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
    const now = new Date();
    const events = trackedItems.flatMap((item) => {
      const dates = metricDatesForItem(item);
      return dates.map((date) => date.slice(0, 10));
    });
    const result = days.map((label, index) => {
      const dayDate = new Date(now);
      const diff = (now.getDay() + 6) % 7 - index;
      dayDate.setDate(now.getDate() - diff);
      const dayKey = dayDate.toISOString().slice(0, 10);
      const count = events.filter((date) => date === dayKey).length;
      return { label, count };
    });
    const max = Math.max(1, ...result.map((item) => item.count));
    return result.map((item) => ({ ...item, ratio: item.count / max }));
  }, [trackedItems]);

  const monthlyRatings = useMemo(() => {
    const monthItems = trackedItems.filter(
      (item) => isCurrentMonth(item.dateAdded) && typeof item.rating === 'number' && !hasApproximateDateFlag(item)
    );
    if (monthItems.length === 0) return 0;
    return monthItems.reduce((acc, item) => acc + (item.rating ?? 0), 0) / monthItems.length;
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

  const achievementPreviewCards = useMemo(
    () =>
      ACHIEVEMENT_DEFINITIONS.map((achievement) => ({
        ...achievement,
        unlocked: unlockedAchievementIds.includes(achievement.id),
      }))
        .sort((a, b) => Number(b.unlocked) - Number(a.unlocked))
        .slice(0, 5),
    [unlockedAchievementIds]
  );

  useEffect(() => {
    let cancelled = false;
    const refreshFriendsData = async () => {
      setUsername(computedUsername);
      await syncOwnProfile(computedUsername, { displayName, fallbackAvatarUrl: googleAccountImage });
      const [count, requests, friends, ownProfile] = await Promise.all([
        getFriendsCount(),
        getIncomingFriendRequests(),
        getFriendsList(),
        getOwnProfile(),
      ]);
      if (!cancelled) {
        setFriendsCount(count);
        setIncomingRequests(requests);
        setFriendsPreview(friends.slice(0, 4));
        const remoteAvatar = ownProfile?.avatar_url ?? null;
        if (remoteAvatar) {
          setProfileAvatarUrl(remoteAvatar);
          setStoredProfileAvatarUrl(remoteAvatar);
        }
      }
    };
    void refreshFriendsData();
    const interval = setInterval(() => void refreshFriendsData(), 12000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [computedUsername, displayName, googleAccountImage, setStoredProfileAvatarUrl, setUsername]);

  useEffect(() => {
    const now = new Date();
    const evaluateGoal = (
      goalType: 'movie' | 'game',
      target: number,
      period: 'weekly' | 'monthly'
    ) => {
      const keyCurrent = `${goalType}-${period}-${periodKey(now, period)}`;
      const previousDate = previousPeriodDate(period, now);
      const keyPrevious = `${goalType}-${period}-${periodKey(previousDate, period)}`;

      const getCount = (refDate: Date) => {
        const key = periodKey(refDate, period);
        if (goalType === 'movie') {
          return trackedItems.filter((item) => {
            if (item.mediaType !== 'movie') return false;
            const metricDate = metricDateForMovie(item);
            if (!metricDate) return false;
            const base = new Date(metricDate);
            if (Number.isNaN(base.getTime())) return false;
            return periodKey(base, period) === key;
          }).length;
        }
        return trackedItems.filter((item) => {
          if (item.mediaType !== 'game' || item.status !== 'completed') return false;
          const metricDate = metricDateForGame(item);
          if (!metricDate) return false;
          const base = new Date(metricDate);
          if (Number.isNaN(base.getTime())) return false;
          return periodKey(base, period) === key;
        }).length;
      };

      const currentCount = getCount(now);
      const previousCount = getCount(previousDate);

      if (!goalPeriodStatuses[keyCurrent] && currentCount >= target) {
        setGoalPeriodStatus(keyCurrent, 'success');
        if (alertsGoals) {
          showInAppNotification('success', 'Objetivo cumplido', `Has completado tu objetivo de ${goalType === 'movie' ? 'películas' : 'juegos'}.`);
        }
      }

      if (!goalPeriodStatuses[keyPrevious]) {
        const previousStatus = previousCount >= target ? 'success' : 'fail';
        setGoalPeriodStatus(keyPrevious, previousStatus);
        if (alertsGoals) {
          showInAppNotification(
            previousStatus === 'success' ? 'success' : 'warning',
            previousStatus === 'success' ? 'Objetivo del periodo anterior cumplido' : 'Objetivo del periodo anterior no cumplido',
            `${goalType === 'movie' ? 'Películas' : 'Juegos'}: ${previousCount}/${target}`
          );
        }
      }
    };

    evaluateGoal('movie', monthlyMovieGoal, movieGoalPeriod);
    evaluateGoal('game', monthlyGameGoal, gameGoalPeriod);
  }, [
    alertsGoals,
    gameGoalPeriod,
    goalPeriodStatuses,
    monthlyGameGoal,
    monthlyMovieGoal,
    movieGoalPeriod,
    setGoalPeriodStatus,
    trackedItems,
  ]);

  async function handleSaveUsername() {
    const next = nameDraft.trim();
    if (!next) return;
    setNameSaving(true);
    try {
      const availability = await isUsernameAvailable(next);
      if (!availability.available) {
        setFriendMessage(availability.message || 'Nombre de usuario no disponible.');
        return;
      }
      setUsername(next);
      await syncOwnProfile(next, { displayName: next, fallbackAvatarUrl: googleAccountImage });
      if (supabase) {
        const { error } = await supabase.auth.updateUser({ data: { display_name: next, username: next } });
        if (error) setFriendMessage('No se pudo guardar en auth, pero quedó en perfil.');
      }
      setIsEditNameOpen(false);
    } finally {
      setNameSaving(false);
    }
  }

  async function handleSearchFriends() {
    const results = await searchProfilesByUsername(friendsQuery);
    setFriendResults(results);
    if (friendsQuery.trim().length >= 2 && results.length === 0) {
      setFriendMessage('No encontramos usuarias/os con ese nombre.');
    }
  }

  async function handleAddFriend(profile: FriendProfile) {
    const res = await sendFriendRequestByUserId(profile.id);
    setFriendMessage(res.message);
    if (alertsFriendRequests) {
      showInAppNotification(res.ok ? 'success' : 'warning', 'Amistades', res.message);
      await sendLocalNotification('Amistades', res.message);
    }
  }

  async function openAvatarPicker() {
    setIsEditAvatarOpen(true);
    if (avatarOptions.length > 0) return;
    setAvatarLoading(true);
    try {
      const options = await getAvatarOptions(100);
      setAvatarOptions(options);
    } finally {
      setAvatarLoading(false);
    }
  }

  async function handleSelectAvatar(nextAvatarUrl: string | null) {
    const previous = profileAvatarUrl;
    setProfileAvatarUrl(nextAvatarUrl);
    setStoredProfileAvatarUrl(nextAvatarUrl);
    const result = await updateOwnAvatar(nextAvatarUrl);
    if (result.ok) {
      setFriendMessage(result.message);
      setIsEditAvatarOpen(false);
      return;
    }
    if (result.message.includes('no soporta foto personalizada')) {
      setFriendMessage('Foto guardada en este dispositivo. Para sincronizar entre dispositivos, añade avatar_url en Supabase.');
      setIsEditAvatarOpen(false);
      return;
    }
    setProfileAvatarUrl(previous);
    setStoredProfileAvatarUrl(previous);
    setFriendMessage(result.message);
  }

  async function handleRespondRequest(requestId: string, decision: 'accepted' | 'declined') {
    const res = await respondFriendRequest(requestId, decision);
    setFriendMessage(res.message);
    if (alertsFriendRequests) {
      showInAppNotification(res.ok ? 'success' : 'warning', 'Solicitudes', res.message);
    }
    const [count, requests] = await Promise.all([getFriendsCount(), getIncomingFriendRequests()]);
    setFriendsCount(count);
    setIncomingRequests(requests);
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#0B1220' : '#F8FAFC' }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          isCompactProfile && styles.contentCompact,
          isWeb && styles.contentWeb,
          isWeb && !useWebBento && styles.contentWebMobile,
        ]}
      >
        <View style={useWebBento ? styles.bentoGrid : styles.cardsStack}>
        <View style={[styles.card, isDark && styles.cardDark, useWebBento && styles.bentoCard, useWebBento && styles.bentoHero]}>
          {useWebBento ? (
            <>
              <View style={[styles.heroGlowLarge, isDark && styles.heroGlowLargeDark]} />
              <View style={[styles.heroGlowSmall, isDark && styles.heroGlowSmallDark]} />
              <Text style={[styles.heroEyebrow, { color: isDark ? '#7DD3FC' : '#0E7490' }]}>PROFILE HUB</Text>
            </>
          ) : null}
          <View style={[styles.profileTopRow, isCompactProfile && styles.profileTopRowCompact]}>
            <View style={[styles.profileAvatarColumn, isCompactProfile && styles.profileAvatarColumnCompact]}>
              <UserAvatar avatarUrl={effectiveAvatarUrl} size={86} isDark={isDark} />
              <TouchableOpacity style={[styles.avatarEditButton, isDark && styles.avatarEditButtonDark]} onPress={() => void openAvatarPicker()}>
                <MaterialIcons name="photo-camera" size={14} color={isDark ? '#BAE6FD' : '#0369A1'} />
                <Text style={[styles.avatarEditButtonText, { color: isDark ? '#BAE6FD' : '#0369A1' }]}>Editar foto</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.profileMainInfo, isCompactProfile && styles.profileMainInfoCompact]}>
              <Text style={[styles.title, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>Mi perfil</Text>
              <Text style={[styles.username, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>{displayName}</Text>
              <Text style={[styles.label, { color: isDark ? '#94A3B8' : '#64748B' }]}>@{computedUsername}</Text>
            </View>
            <View style={[styles.profileActionsColumn, isCompactProfile && styles.profileActionsColumnCompact]}>
              <TouchableOpacity
                style={[styles.themePill, isDark && styles.themePillDark]}
                onPress={() => setThemeMode(darkEnabled ? 'light' : 'dark')}
                activeOpacity={0.85}
              >
                <View style={[styles.themeIconSlot, styles.themeIconSun]}>
                  <MaterialIcons name="wb-sunny" size={14} color={darkEnabled ? '#64748B' : '#F59E0B'} />
                </View>
                <View style={[styles.themeIconSlot, styles.themeIconMoon]}>
                  <MaterialIcons name="nights-stay" size={13} color={darkEnabled ? '#93C5FD' : '#94A3B8'} />
                </View>
                <View
                  style={[
                    styles.themeKnob,
                    darkEnabled && styles.themeKnobDark,
                    isWeb
                      ? ({
                          transitionProperty: 'transform, background-color',
                          transitionDuration: '220ms',
                          transitionTimingFunction: 'ease-out',
                        } as any)
                      : null,
                  ]}
                />
              </TouchableOpacity>
              {isSupabaseConfigured ? (
                <TouchableOpacity style={[styles.logoutButton, isDark && styles.logoutButtonDark]} onPress={() => void signOut()}>
                  <Text style={styles.logoutButtonText}>Cerrar sesión</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>

        <View style={[styles.card, isDark && styles.cardDark, useWebBento && styles.bentoCard, useWebBento && styles.bentoTwoThird]}>
          <View style={styles.friendsHeaderRow}>
            <View style={styles.friendsTitleRow}>
              <Text style={[styles.friendsBlockTitle, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>Amigos</Text>
              <View style={styles.friendsCountBadge}>
                <Text style={styles.friendsCountText}>{friendsCount}</Text>
              </View>
            </View>
          </View>

          {incomingRequests.length > 0 ? (
            <View style={styles.requestsWrap}>
              <Text style={[styles.subSectionTitle, { color: isDark ? '#CBD5E1' : '#334155' }]}>
                Solicitudes ({incomingRequests.length})
              </Text>
              {incomingRequests.map((request) => (
                <View key={request.id} style={[styles.requestRow, isDark && styles.requestRowDark]}>
                  <View style={styles.requestMainInfo}>
                    <UserAvatar avatarUrl={request.fromProfile?.avatar_url ?? null} size={28} isDark={isDark} />
                    <Text style={[styles.requestName, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>
                      {request.fromName || 'Usuario'}
                    </Text>
                  </View>
                  <View style={styles.requestButtons}>
                    <TouchableOpacity style={styles.requestAccept} onPress={() => handleRespondRequest(request.id, 'accepted')}>
                      <Text style={styles.requestBtnText}>Aceptar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.requestDecline} onPress={() => handleRespondRequest(request.id, 'declined')}>
                      <Text style={styles.requestBtnText}>Denegar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.friendSearchRow}>
            <TextInput
              value={friendsQuery}
              onChangeText={setFriendsQuery}
              placeholder="Buscar por nombre de usuario"
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              style={[styles.friendSearchInput, isDark && styles.friendSearchInputDark, { color: isDark ? '#E5E7EB' : '#0F172A' }]}
              onSubmitEditing={() => void handleSearchFriends()}
              onKeyPress={(event) => {
                if (event.nativeEvent.key === 'Enter') {
                  void handleSearchFriends();
                }
              }}
              returnKeyType="search"
              blurOnSubmit={false}
            />
            <TouchableOpacity style={styles.friendSearchButton} onPress={handleSearchFriends}>
              <Text style={styles.friendSearchButtonText}>Buscar</Text>
            </TouchableOpacity>
          </View>
          {!!friendMessage && <Text style={[styles.helpText, { color: isDark ? '#94A3B8' : '#64748B' }]}>{friendMessage}</Text>}
          {friendResults.map((profile) => (
            <View key={profile.id} style={[styles.friendResultRow, isDark && styles.friendResultRowDark]}>
              <View style={styles.friendResultMainInfo}>
                <UserAvatar avatarUrl={profile.avatar_url ?? null} size={30} isDark={isDark} />
                <Text style={[styles.friendResultName, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>
                  {profile.display_name || profile.username}
                </Text>
              </View>
              <TouchableOpacity style={styles.friendAddBtn} onPress={() => handleAddFriend(profile)}>
                <Text style={styles.friendAddText}>Añadir</Text>
              </TouchableOpacity>
            </View>
          ))}
          <View style={[styles.friendsPreviewSection, isDark && styles.friendsPreviewSectionDark]}>
            <Text style={[styles.subSectionTitle, { color: isDark ? '#CBD5E1' : '#334155' }]}>Tus amigos destacados</Text>
            {friendsPreview.length === 0 ? (
              <Text style={[styles.helpText, { color: isDark ? '#94A3B8' : '#64748B' }]}>Aún no tienes amigos añadidos.</Text>
            ) : (
              friendsPreview.map((friend) => (
                <View key={friend.id} style={[styles.friendPreviewRow, isDark && styles.friendPreviewRowDark]}>
                  <UserAvatar avatarUrl={friend.avatar_url ?? null} size={24} isDark={isDark} />
                  <Text style={[styles.friendPreviewName, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>
                    {friend.display_name || friend.username}
                  </Text>
                </View>
              ))
            )}
            <TouchableOpacity style={styles.friendsSeeAllBtn} onPress={() => router.push('/friends')}>
              <Text style={styles.friendsSeeAllText}>Ver todos los amigos</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.card, isDark && styles.cardDark, useWebBento && styles.bentoCard, useWebBento && styles.bentoTwoThird, useWebBento && styles.bentoTall]}>
          <Text style={[styles.blockTitle, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>Dashboard</Text>
          <View style={styles.statsRow}>
            <Text style={[styles.statLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>Horas estimadas</Text>
            <Text style={[styles.statValue, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>{Math.round(estimatedHours)} h</Text>
          </View>
          <View style={styles.statsRow}>
            <Text style={[styles.statLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>Racha semanal</Text>
            <Text style={[styles.statValue, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>{streak} semana(s)</Text>
          </View>
          <View style={styles.statsRow}>
            <Text style={[styles.statLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>Media mensual</Text>
            <Text style={[styles.statValue, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>{monthlyRatings ? monthlyRatings.toFixed(1) : '-'} / 10</Text>
          </View>

          <Text style={[styles.subSectionTitle, { color: isDark ? '#CBD5E1' : '#334155' }]}>Actividad semanal</Text>
          <View style={styles.weekChart}>
            {weeklyActivity.map((day) => (
              <View key={day.label} style={styles.weekCol}>
                <View style={[styles.weekBarBg, isDark && styles.weekBarBgDark]}>
                  <View style={[styles.weekBarFill, { height: `${Math.max(10, day.ratio * 100)}%` }]} />
                </View>
                <Text style={[styles.weekLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>{day.label}</Text>
              </View>
            ))}
          </View>

          <Text style={[styles.subSectionTitle, { color: isDark ? '#CBD5E1' : '#334155' }]}>Tiempo por tipo</Text>
          <View style={styles.timeRow}>
            <Text style={[styles.timeLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>🎬 Pelis {Math.round(movieHours)}h</Text>
            <Text style={[styles.timeLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>📺 Series {Math.round(tvHours)}h</Text>
            <Text style={[styles.timeLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>🎮 Juegos {Math.round(gameHours)}h</Text>
          </View>
        </View>

        <View style={[styles.card, isDark && styles.cardDark, useWebBento && styles.bentoCard, useWebBento && styles.bentoOneThird]}>
          <Text style={[styles.blockTitle, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>Objetivos</Text>
          <View style={styles.goalItem}>
            <Text style={[styles.goalText, { color: isDark ? '#CBD5E1' : '#334155' }]}>
              {`${movieGoalPeriod === 'monthly' ? 'Películas por mes' : 'Películas por semana'}: ${movieGoalProgress}/${monthlyMovieGoal}`}
            </Text>
            <View style={styles.goalControlRow}>
              <TouchableOpacity style={styles.goalAdjustBtn} onPress={() => setMonthlyMovieGoal(Math.max(1, monthlyMovieGoal - 1))}>
                <Text style={styles.goalAdjustBtnText}>-</Text>
              </TouchableOpacity>
              <Text style={[styles.goalCountText, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>{monthlyMovieGoal}</Text>
              <TouchableOpacity style={styles.goalAdjustBtn} onPress={() => setMonthlyMovieGoal(Math.min(30, monthlyMovieGoal + 1))}>
                <Text style={styles.goalAdjustBtnText}>+</Text>
              </TouchableOpacity>
              <View style={styles.goalPeriodSwitch}>
                <TouchableOpacity
                  style={[styles.goalPeriodBtn, movieGoalPeriod === 'weekly' && styles.goalPeriodBtnActive]}
                  onPress={() => setMovieGoalPeriod('weekly')}
                >
                  <Text style={[styles.goalPeriodText, movieGoalPeriod === 'weekly' && styles.goalPeriodTextActive]}>Sem</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.goalPeriodBtn, movieGoalPeriod === 'monthly' && styles.goalPeriodBtnActive]}
                  onPress={() => setMovieGoalPeriod('monthly')}
                >
                  <Text style={[styles.goalPeriodText, movieGoalPeriod === 'monthly' && styles.goalPeriodTextActive]}>Mes</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={[styles.goalBarBg, isDark && styles.goalBarBgDark]}>
              <View style={[styles.goalBarFill, { width: `${Math.min(100, (movieGoalProgress / Math.max(1, monthlyMovieGoal)) * 100)}%` }]} />
            </View>
          </View>
          <View style={styles.goalItem}>
            <Text style={[styles.goalText, { color: isDark ? '#CBD5E1' : '#334155' }]}>
              {`${gameGoalPeriod === 'monthly' ? 'Juegos por mes' : 'Juegos por semana'}: ${gameGoalProgress}/${monthlyGameGoal}`}
            </Text>
            <View style={styles.goalControlRow}>
              <TouchableOpacity style={styles.goalAdjustBtn} onPress={() => setMonthlyGameGoal(Math.max(1, monthlyGameGoal - 1))}>
                <Text style={styles.goalAdjustBtnText}>-</Text>
              </TouchableOpacity>
              <Text style={[styles.goalCountText, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>{monthlyGameGoal}</Text>
              <TouchableOpacity style={styles.goalAdjustBtn} onPress={() => setMonthlyGameGoal(Math.min(20, monthlyGameGoal + 1))}>
                <Text style={styles.goalAdjustBtnText}>+</Text>
              </TouchableOpacity>
              <View style={styles.goalPeriodSwitch}>
                <TouchableOpacity
                  style={[styles.goalPeriodBtn, gameGoalPeriod === 'weekly' && styles.goalPeriodBtnActive]}
                  onPress={() => setGameGoalPeriod('weekly')}
                >
                  <Text style={[styles.goalPeriodText, gameGoalPeriod === 'weekly' && styles.goalPeriodTextActive]}>Sem</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.goalPeriodBtn, gameGoalPeriod === 'monthly' && styles.goalPeriodBtnActive]}
                  onPress={() => setGameGoalPeriod('monthly')}
                >
                  <Text style={[styles.goalPeriodText, gameGoalPeriod === 'monthly' && styles.goalPeriodTextActive]}>Mes</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={[styles.goalBarBg, isDark && styles.goalBarBgDark]}>
              <View style={[styles.goalBarFill, { width: `${Math.min(100, (gameGoalProgress / Math.max(1, monthlyGameGoal)) * 100)}%` }]} />
            </View>
          </View>
        </View>

        <View style={[styles.card, isDark && styles.cardDark, useWebBento && styles.bentoCard, useWebBento && styles.bentoOneThird]}>
          <Text style={[styles.blockTitle, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>Media de puntuación</Text>
          <View style={styles.statsRow}>
            <Text style={[styles.statLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>Películas</Text>
            <Text style={[styles.statValue, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>{avgMovie ? avgMovie.toFixed(1) : '-'}</Text>
          </View>
          <View style={styles.statsRow}>
            <Text style={[styles.statLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>Series</Text>
            <Text style={[styles.statValue, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>{avgTV ? avgTV.toFixed(1) : '-'}</Text>
          </View>
          <View style={styles.statsRow}>
            <Text style={[styles.statLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>Juegos</Text>
            <Text style={[styles.statValue, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>{avgGame ? avgGame.toFixed(1) : '-'}</Text>
          </View>
        </View>

        <View style={[styles.card, isDark && styles.cardDark, useWebBento && styles.bentoCard, useWebBento && styles.bentoOneThird]}>
          <Text style={[styles.blockTitle, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>Géneros más consumidos</Text>
          {topGenres.length === 0 ? (
            <Text style={[styles.emptyText, { color: isDark ? '#94A3B8' : '#64748B' }]}>
              Añade y puntúa contenido para ver tus géneros favoritos.
            </Text>
          ) : (
            <View style={styles.genreWrap}>
              {topGenres.map((genre) => (
                <View key={genre} style={[styles.genreChip, isDark && styles.genreChipDark]}>
                  <Text style={[styles.genreChipText, { color: isDark ? '#93C5FD' : '#0369A1' }]}>{genre}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={[styles.card, isDark && styles.cardDark, useWebBento && styles.bentoCard, useWebBento && styles.bentoOneThird]}>
          <Text style={[styles.blockTitle, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>Logros</Text>
          <Text style={[styles.helpText, { color: isDark ? '#94A3B8' : '#64748B' }]}>
            {`Conseguidos: ${unlockedAchievementIds.length}`}
          </Text>
          {achievementPreviewCards.map((achievement) => (
            <View
              key={achievement.id}
              style={[
                styles.achievementRow,
                !achievement.unlocked && styles.achievementRowPending,
                isDark && !achievement.unlocked && styles.achievementRowPendingDark,
              ]}
            >
              <Text
                style={[
                  styles.achievementText,
                  { color: isDark ? '#CBD5E1' : '#334155' },
                  !achievement.unlocked && styles.achievementTextPending,
                ]}
              >
                {achievement.title}
              </Text>
              <Text style={[styles.achievementState, { color: achievement.unlocked ? '#16A34A' : '#94A3B8' }]}>
                {achievement.unlocked ? 'Conseguido' : 'Pendiente'}
              </Text>
            </View>
          ))}
          <TouchableOpacity style={styles.friendsSeeAllBtn} onPress={() => router.push('/achievements')}>
            <Text style={styles.friendsSeeAllText}>Ver logros conseguidos</Text>
          </TouchableOpacity>
        </View>
        </View>
      </ScrollView>
      <Modal visible={isEditNameOpen} transparent animationType="fade" onRequestClose={() => setIsEditNameOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, isDark && styles.cardDark]}>
            <Text style={[styles.blockTitle, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>Editar nombre</Text>
            <TextInput
              value={nameDraft}
              onChangeText={setNameDraft}
              placeholder="Nombre de usuario"
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              style={[styles.modalNameInput, isDark && styles.modalNameInputDark, { color: isDark ? '#E5E7EB' : '#0F172A' }]}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setIsEditNameOpen(false)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} disabled={nameSaving} onPress={handleSaveUsername}>
                <Text style={styles.modalSaveText}>{nameSaving ? 'Guardando...' : 'Guardar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal visible={isEditAvatarOpen} transparent animationType="fade" onRequestClose={() => setIsEditAvatarOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.avatarModalCard, isDark && styles.cardDark]}>
            <Text style={[styles.blockTitle, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>Editar foto de perfil</Text>
            <TouchableOpacity style={[styles.avatarResetBtn, isDark && styles.avatarResetBtnDark]} onPress={() => void handleSelectAvatar(null)}>
              <Text style={styles.avatarResetText}>Usar foto por defecto</Text>
            </TouchableOpacity>
            {avatarLoading ? (
              <View style={styles.avatarLoadingWrap}>
                <ActivityIndicator size="small" color="#0E7490" />
              </View>
            ) : (
              <ScrollView contentContainerStyle={styles.avatarGrid} showsVerticalScrollIndicator={false}>
                {avatarOptions.map((avatar) => (
                  <TouchableOpacity
                    key={avatar.id}
                    style={[
                      styles.avatarOption,
                      effectiveAvatarUrl === avatar.imageUrl && styles.avatarOptionActive,
                      isDark && styles.avatarOptionDark,
                    ]}
                    onPress={() => void handleSelectAvatar(avatar.imageUrl)}
                  >
                    <UserAvatar avatarUrl={avatar.imageUrl} size={62} isDark={isDark} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setIsEditAvatarOpen(false)}>
                <Text style={styles.modalCancelText}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 24,
  },
  contentCompact: {
    gap: 18,
    paddingBottom: 34,
  },
  contentWeb: {
    width: '100%',
    maxWidth: 1180,
    alignSelf: 'center',
  },
  contentWebMobile: {
    gap: 16,
    paddingBottom: 32,
  },
  bentoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'stretch',
  },
  cardsStack: {
    gap: 18,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  bentoCard: {
    borderRadius: 22,
    padding: 18,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 22,
    overflow: 'hidden',
  },
  bentoHero: {
    width: '100%',
    minHeight: 160,
  },
  bentoTall: {
    minHeight: 336,
  },
  bentoTwoThird: {
    width: '66%',
    minWidth: 440,
    flexGrow: 1,
  },
  bentoOneThird: {
    width: '32%',
    minWidth: 270,
    flexGrow: 1,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginBottom: 8,
  },
  heroGlowLarge: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    right: -58,
    top: -78,
    backgroundColor: 'rgba(14,116,144,0.14)',
  },
  heroGlowLargeDark: {
    backgroundColor: 'rgba(56,189,248,0.16)',
  },
  heroGlowSmall: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    left: -32,
    bottom: -32,
    backgroundColor: 'rgba(125,211,252,0.2)',
  },
  heroGlowSmallDark: {
    backgroundColor: 'rgba(30,64,175,0.32)',
  },
  cardDark: {
    backgroundColor: '#111827',
    borderColor: '#1F2937',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 10,
  },
  label: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '700',
  },
  username: {
    marginTop: 4,
    fontSize: 18,
    color: '#0F172A',
    fontWeight: '700',
  },
  profileTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 14,
  },
  profileTopRowCompact: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 10,
  },
  profileAvatarColumn: {
    alignItems: 'center',
    gap: 8,
  },
  profileAvatarColumnCompact: {
    alignSelf: 'center',
  },
  profileMainInfo: {
    flex: 1,
    paddingRight: 8,
  },
  profileMainInfoCompact: {
    paddingRight: 0,
    alignItems: 'center',
  },
  avatarEditButton: {
    borderWidth: 1,
    borderColor: '#BAE6FD',
    backgroundColor: '#ECFEFF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  avatarEditButtonDark: {
    borderColor: '#1E3A8A',
    backgroundColor: '#0F172A',
  },
  avatarEditButtonText: {
    fontSize: 11,
    fontWeight: '800',
  },
  profileActionsColumn: {
    minWidth: 170,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    gap: 8,
  },
  profileActionsColumnCompact: {
    minWidth: 0,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  themePill: {
    width: 78,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    position: 'relative',
    alignSelf: 'flex-end',
  },
  themeIconSlot: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    position: 'absolute',
    top: '50%',
    marginTop: -8,
  },
  themeIconSun: {
    left: 8,
  },
  themeIconMoon: {
    right: 7.5,
  },
  themePillDark: {
    borderColor: '#334155',
    backgroundColor: '#0F172A',
  },
  themeKnob: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#0E7490',
    left: 5,
    top: '50%',
    marginTop: -11,
    transform: [{ translateX: 0 }],
  },
  themeKnobDark: {
    transform: [{ translateX: 44 }],
    backgroundColor: '#1E40AF',
  },
  usernameRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  usernameEditBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    backgroundColor: '#ECFEFF',
  },
  usernameEditBtnDark: {
    borderColor: '#1E3A8A',
    backgroundColor: '#0F172A',
  },
  logoutButton: {
    marginTop: 8,
    alignSelf: 'flex-end',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
    minWidth: 118,
  },
  logoutButtonDark: {
    borderColor: '#7F1D1D',
    backgroundColor: '#3F1518',
  },
  logoutButtonText: {
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '800',
  },
  helpText: {
    fontSize: 12,
    marginTop: 2,
  },
  friendsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  friendsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  friendsBlockTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  friendsCountBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#0E7490',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    marginTop: 1,
  },
  friendsCountText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  friendsListBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  friendsListBtnDark: {
    borderColor: '#334155',
    backgroundColor: '#111827',
  },
  requestsWrap: {
    marginBottom: 8,
  },
  requestRow: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 8,
    backgroundColor: '#FFFFFF',
    marginBottom: 6,
  },
  requestRowDark: {
    borderColor: '#334155',
    backgroundColor: '#0B1220',
  },
  requestName: {
    fontSize: 13,
    fontWeight: '700',
  },
  requestMainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  requestButtons: {
    marginTop: 6,
    flexDirection: 'row',
    gap: 8,
  },
  requestAccept: {
    backgroundColor: '#16A34A',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  requestDecline: {
    backgroundColor: '#DC2626',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  requestBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  friendSearchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  friendSearchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    minHeight: 46,
    backgroundColor: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  friendSearchInputDark: {
    borderColor: '#334155',
    backgroundColor: '#0B1220',
  },
  friendSearchButton: {
    borderRadius: 10,
    backgroundColor: '#0E7490',
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendSearchButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  friendResultRow: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
  },
  friendResultRowDark: {
    borderColor: '#334155',
    backgroundColor: '#0B1220',
  },
  friendsPreviewSection: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 8,
  },
  friendsPreviewSectionDark: {
    borderTopColor: '#334155',
  },
  friendPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    marginBottom: 6,
  },
  friendPreviewRowDark: {
    borderColor: '#334155',
    backgroundColor: '#0B1220',
  },
  friendPreviewName: {
    fontSize: 13,
    fontWeight: '700',
  },
  friendsSeeAllBtn: {
    marginTop: 4,
    borderRadius: 10,
    backgroundColor: '#0E7490',
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  friendsSeeAllText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  friendResultName: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    paddingRight: 8,
  },
  friendResultMainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  friendAddBtn: {
    borderRadius: 999,
    backgroundColor: '#0E7490',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  friendAddText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  blockTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 8,
  },
  subSectionTitle: {
    marginTop: 10,
    marginBottom: 6,
    fontSize: 13,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  weekChart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 8,
    height: 100,
  },
  weekCol: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  weekBarBg: {
    width: '100%',
    height: 74,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  weekBarBgDark: {
    backgroundColor: '#1F2937',
  },
  weekBarFill: {
    width: '100%',
    backgroundColor: '#0E7490',
    borderRadius: 8,
    minHeight: 6,
  },
  weekLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  timeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  timeLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  goalItem: {
    marginBottom: 10,
  },
  goalText: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  goalControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  goalAdjustBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  goalAdjustBtnText: {
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 13,
    lineHeight: 15,
  },
  goalCountText: {
    minWidth: 18,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  goalPeriodSwitch: {
    marginLeft: 'auto',
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 999,
    overflow: 'hidden',
  },
  goalPeriodBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#FFFFFF',
  },
  goalPeriodBtnActive: {
    backgroundColor: '#0E7490',
  },
  goalPeriodText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  goalPeriodTextActive: {
    color: '#FFFFFF',
  },
  goalBarBg: {
    width: '100%',
    height: 10,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  goalBarBgDark: {
    backgroundColor: '#1F2937',
  },
  goalBarFill: {
    height: '100%',
    backgroundColor: '#0E7490',
  },
  genreWrap: {
    marginTop: 4,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  genreChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    backgroundColor: '#ECFEFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  genreChipDark: {
    borderColor: '#1E3A8A',
    backgroundColor: '#0F172A',
  },
  genreChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 13,
  },
  achievementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  achievementRowPending: {
    opacity: 0.78,
  },
  achievementRowPendingDark: {
    borderBottomColor: '#334155',
  },
  achievementText: {
    fontSize: 13,
    fontWeight: '700',
  },
  achievementTextPending: {
    fontWeight: '600',
  },
  achievementState: {
    fontSize: 12,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  modalNameInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 52,
    backgroundColor: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  modalNameInputDark: {
    borderColor: '#334155',
    backgroundColor: '#0B1220',
  },
  modalActions: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  modalCancel: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
  },
  modalCancelText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  modalSave: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#0E7490',
  },
  modalSaveText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  avatarModalCard: {
    width: '100%',
    maxWidth: 700,
    maxHeight: '86%',
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  avatarLoadingWrap: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarGrid: {
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  avatarOption: {
    width: 84,
    height: 84,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  avatarOptionDark: {
    backgroundColor: '#0B1220',
    borderColor: '#334155',
  },
  avatarOptionActive: {
    borderColor: '#0E7490',
    backgroundColor: '#ECFEFF',
  },
  avatarResetBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  avatarResetBtnDark: {
    borderColor: '#334155',
    backgroundColor: '#111827',
  },
  avatarResetText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  achievementToast: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FCD34D',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  achievementToastDark: {
    borderColor: '#92400E',
    backgroundColor: '#451A03',
  },
  achievementToastText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
  },
});

export { ProfileScreen };
export default ProfileScreen;
