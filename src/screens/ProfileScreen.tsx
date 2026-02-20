import { MaterialIcons } from '@expo/vector-icons';
import { useClerk, useUser } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useEscapeClose } from '../hooks/use-escape-close';
import { useGlobalLoader } from '../hooks/useGlobalLoader';
import UserAvatar from '../components/common/UserAvatar';
import FriendSectionCard from '../components/common/FriendSectionCard';
import { type AddFriendSearchResult } from '../components/common/AddFriendModal';
import FriendRequestsModal from '../components/common/FriendRequestsModal';
import { gameRepository } from '../features/games/data/repositories';
import { movieRepository } from '../features/movies/data/repositories';
import { tvRepository } from '../features/tv/data/repositories';
import { isSupabaseConfigured } from '../services/supabase';
import {
  getFriendsCompatibility,
  getOwnProfile,
  getOutgoingFriendRequestIds,
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
import { getAvatarOptions, searchAvatarOptions, type AvatarOption } from '../services/avatars';
import { usePreferencesStore } from '../store/preferences';
import { useTrackingStore } from '../store/tracking';
import { MediaType, TrackedItem } from '../types';
import { ACHIEVEMENT_DEFINITIONS } from '../features/achievements/catalog';
import MagicLoader from '@/components/loaders/MagicLoader';

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

const PROFILE_DETAILS_LIMIT_WEB = 6;
const PROFILE_DETAILS_LIMIT_NATIVE = 12;

function ProfileScreen() {
  const isDark = useColorScheme() === 'dark';
  const router = useRouter();
  const { showLoader, hideLoader } = useGlobalLoader();
  const { signOut } = useClerk();
  const { user } = useUser();
  const username = usePreferencesStore((state) => state.username);
  const themeMode = usePreferencesStore((state) => state.themeMode);
  const setThemeMode = usePreferencesStore((state) => state.setThemeMode);
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
  const computedUsername = (username || emailAddress.split('@')[0] || 'usuario').toLowerCase();
  const displayName = user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || computedUsername;
  const [nameDraft, setNameDraft] = useState(computedUsername);
  const [nameSaving, setNameSaving] = useState(false);
  const [isEditAvatarOpen, setIsEditAvatarOpen] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarOptions, setAvatarOptions] = useState<AvatarOption[]>([]);
  const [avatarSearchQuery, setAvatarSearchQuery] = useState('');
  const [avatarSearchLoading, setAvatarSearchLoading] = useState(false);
  const [avatarSearchOptions, setAvatarSearchOptions] = useState<AvatarOption[]>([]);
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(storedProfileAvatarUrl);
  const [friendsQuery, setFriendsQuery] = useState('');
  const [friendsSearchLoading, setFriendsSearchLoading] = useState(false);
  const [friendsSearchError, setFriendsSearchError] = useState('');
  const [friendsList, setFriendsList] = useState<FriendProfile[]>([]);
  const [friendResults, setFriendResults] = useState<FriendProfile[]>([]);
  const [sentFriendRequestIds, setSentFriendRequestIds] = useState<Record<string, true>>({});
  const [sendingFriendRequestIds, setSendingFriendRequestIds] = useState<Record<string, true>>({});
  const friendRequestInFlightRef = useRef<Record<string, true>>({});
  const [compatibilityByFriendId, setCompatibilityByFriendId] = useState<Record<string, { compatibility: number; sharedItems: number }>>({});
  const [incomingRequests, setIncomingRequests] = useState<FriendRequestItem[]>([]);
  const [friendsCount, setFriendsCount] = useState(0);
  const [friendMessage, setFriendMessage] = useState('');
  const [isRequestsModalOpen, setIsRequestsModalOpen] = useState(false);
  const googleAccountImage =
    ((user?.externalAccounts as any[])?.find((account: any) => account?.provider === 'oauth_google')?.imageUrl as string | undefined) ||
    null;
  const effectiveAvatarUrl = profileAvatarUrl || storedProfileAvatarUrl || googleAccountImage || null;
  const friendIdsSet = useMemo(() => new Set(friendsList.map((friend) => friend.id)), [friendsList]);
  const profileDetailsLimit = isWeb ? PROFILE_DETAILS_LIMIT_WEB : PROFILE_DETAILS_LIMIT_NATIVE;

  useEscapeClose(isEditNameOpen, () => setIsEditNameOpen(false));
  useEscapeClose(isEditAvatarOpen, () => setIsEditAvatarOpen(false));

  const friendsPreviewData = useMemo(
    () =>
      friendsList.map((friend) => ({
        id: friend.id,
        name: friend.display_name || friend.username || 'Amigo/a',
        username: friend.username,
        avatarUrl: friend.avatar_url ?? null,
        compatibilityScore: compatibilityByFriendId[friend.id]?.compatibility ?? null,
      })),
    [compatibilityByFriendId, friendsList]
  );

  const friendSearchItems = useMemo<AddFriendSearchResult[]>(
    () =>
      friendResults.map((profile) => {
        const state = friendIdsSet.has(profile.id)
          ? 'friend'
          : sendingFriendRequestIds[profile.id]
            ? 'sending'
            : sentFriendRequestIds[profile.id]
              ? 'sent'
              : 'add';
        return {
          id: profile.id,
          name: profile.display_name || profile.username,
          username: profile.username,
          avatarUrl: profile.avatar_url ?? null,
          state,
        };
      }),
    [friendResults, friendIdsSet, sendingFriendRequestIds, sentFriendRequestIds]
  );

  const movieIds = useMemo(
    () => Array.from(new Set(trackedItems.filter((item) => item.mediaType === 'movie').map((item) => item.externalId))).slice(0, profileDetailsLimit),
    [profileDetailsLimit, trackedItems]
  );
  const tvIds = useMemo(
    () => Array.from(new Set(trackedItems.filter((item) => item.mediaType === 'tv').map((item) => item.externalId))).slice(0, profileDetailsLimit),
    [profileDetailsLimit, trackedItems]
  );
  const gameIds = useMemo(
    () => Array.from(new Set(trackedItems.filter((item) => item.mediaType === 'game').map((item) => item.externalId))).slice(0, profileDetailsLimit),
    [profileDetailsLimit, trackedItems]
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
    setUsername(computedUsername);
    void syncOwnProfile(computedUsername, { displayName, fallbackAvatarUrl: googleAccountImage });
  }, [computedUsername, displayName, googleAccountImage, setUsername]);

  useEffect(() => {
    let cancelled = false;
    const refreshFriendsData = async () => {
      const [requestsRes, friendsRes, compatibilityRes, ownProfileRes, outgoingRes] = await Promise.allSettled([
        getIncomingFriendRequests(),
        getFriendsList(),
        getFriendsCompatibility(),
        getOwnProfile(),
        getOutgoingFriendRequestIds(),
      ]);
      if (!cancelled) {
        const requests = requestsRes.status === 'fulfilled' ? requestsRes.value : [];
        const friends = friendsRes.status === 'fulfilled' ? friendsRes.value : [];
        const compatibility = compatibilityRes.status === 'fulfilled' ? compatibilityRes.value : {};
        const ownProfile = ownProfileRes.status === 'fulfilled' ? ownProfileRes.value : null;

        setFriendsCount(friends.length);
        setIncomingRequests(requests);
        setFriendsList(friends);
        setCompatibilityByFriendId(compatibility);
        if (outgoingRes.status === 'fulfilled') {
          const knownSent = Object.fromEntries(outgoingRes.value.map((id) => [id, true])) as Record<string, true>;
          setSentFriendRequestIds((prev) => ({ ...prev, ...knownSent }));
        }

        const remoteAvatar = ownProfile?.avatar_url ?? null;
        if (remoteAvatar) {
          setProfileAvatarUrl(remoteAvatar);
          setStoredProfileAvatarUrl(remoteAvatar);
        }
      }
    };
    void refreshFriendsData();
    const interval = setInterval(() => void refreshFriendsData(), 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [setStoredProfileAvatarUrl]);

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
      }

      if (!goalPeriodStatuses[keyPrevious]) {
        const previousStatus = previousCount >= target ? 'success' : 'fail';
        setGoalPeriodStatus(keyPrevious, previousStatus);
      }
    };

    evaluateGoal('movie', monthlyMovieGoal, movieGoalPeriod);
    evaluateGoal('game', monthlyGameGoal, gameGoalPeriod);
  }, [
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
    showLoader({ text: 'Guardando perfil...', overlay: true, fullScreen: true, blur: true });
    try {
      const availability = await isUsernameAvailable(next);
      if (!availability.available) {
        setFriendMessage(availability.message || 'Nombre de usuario no disponible.');
        return;
      }
      setUsername(next);
      await syncOwnProfile(next, { displayName: next, fallbackAvatarUrl: googleAccountImage });
      // Este cliente puede estar configurado con accessToken y no soporta auth.updateUser.
      // Guardamos username en perfil remoto + estado local, que es lo que usa la app.
      setIsEditNameOpen(false);
    } finally {
      hideLoader();
      setNameSaving(false);
    }
  }

  useEffect(() => {
    const cleaned = friendsQuery.trim();
    if (cleaned.length < 2) {
      setFriendResults([]);
      setFriendsSearchLoading(false);
      setFriendsSearchError('');
      return;
    }

    let cancelled = false;
    setFriendsSearchLoading(true);
    setFriendsSearchError('');
    const timeout = setTimeout(() => {
      void (async () => {
        try {
          const results = await searchProfilesByUsername(cleaned);
          if (!cancelled) setFriendResults(results);
        } catch {
          if (!cancelled) setFriendsSearchError('No se pudo buscar ahora.');
        } finally {
          if (!cancelled) setFriendsSearchLoading(false);
        }
      })();
    }, 320);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [friendsQuery]);

  async function handleAddFriend(userId: string) {
    if (
      friendIdsSet.has(userId) ||
      sentFriendRequestIds[userId] ||
      sendingFriendRequestIds[userId] ||
      friendRequestInFlightRef.current[userId]
    ) {
      return;
    }
    friendRequestInFlightRef.current[userId] = true;
    setSendingFriendRequestIds((prev) => ({ ...prev, [userId]: true }));
    try {
      const res = await sendFriendRequestByUserId(userId);
      const alreadyActive = /solicitud activa|ya existe una solicitud/i.test(res.message);
      if (res.ok || alreadyActive) {
        setSentFriendRequestIds((prev) => ({ ...prev, [userId]: true }));
        setFriendMessage(res.ok ? res.message : 'Solicitud enviada.');
      } else {
        setFriendMessage(res.message);
      }
    } finally {
      delete friendRequestInFlightRef.current[userId];
      setSendingFriendRequestIds((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    }
  }

  async function openAvatarPicker() {
    setIsEditAvatarOpen(true);
    setAvatarSearchQuery('');
    setAvatarSearchOptions([]);
    if (avatarOptions.length > 0) return;
    setAvatarLoading(true);
    try {
      const options = await getAvatarOptions(220);
      setAvatarOptions(options);
    } finally {
      setAvatarLoading(false);
    }
  }

  useEffect(() => {
    if (!isEditAvatarOpen) return;
    const cleaned = avatarSearchQuery.trim();
    if (cleaned.length < 2) {
      setAvatarSearchOptions([]);
      setAvatarSearchLoading(false);
      return;
    }

    let cancelled = false;
    setAvatarSearchLoading(true);
    const timeout = setTimeout(() => {
      void (async () => {
        const results = await searchAvatarOptions(cleaned);
        if (!cancelled) setAvatarSearchOptions(results);
        if (!cancelled) setAvatarSearchLoading(false);
      })();
    }, 280);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [avatarSearchQuery, isEditAvatarOpen]);

  async function handleSelectAvatar(nextAvatarUrl: string | null) {
    showLoader({ text: 'Guardando avatar...', overlay: true, fullScreen: true, blur: true });
    try {
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
    } finally {
      hideLoader();
    }
  }

  async function handleRespondRequest(requestId: string, decision: 'accepted' | 'declined') {
    showLoader({ text: 'Actualizando solicitud...', overlay: true, fullScreen: false, blur: false });
    try {
      const res = await respondFriendRequest(requestId, decision);
      setFriendMessage(res.message);
      const [requestsRes, friendsRes, compatibilityRes] = await Promise.allSettled([
        getIncomingFriendRequests(),
        getFriendsList(),
        getFriendsCompatibility(),
      ]);
      const friends = friendsRes.status === 'fulfilled' ? friendsRes.value : [];
      setFriendsCount(friends.length);
      setIncomingRequests(requestsRes.status === 'fulfilled' ? requestsRes.value : []);
      setFriendsList(friends);
      setCompatibilityByFriendId(compatibilityRes.status === 'fulfilled' ? compatibilityRes.value : {});
    } finally {
      hideLoader();
    }
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
              <View style={styles.usernameRow}>
                <Text style={[styles.label, { color: isDark ? '#94A3B8' : '#64748B' }]}>@{computedUsername}</Text>
                <TouchableOpacity
                  style={[styles.usernameEditBtn, isDark && styles.usernameEditBtnDark]}
                  onPress={() => {
                    setNameDraft(computedUsername);
                    setIsEditNameOpen(true);
                  }}
                >
                  <MaterialIcons name="edit" size={13} color={isDark ? '#BAE6FD' : '#0369A1'} />
                </TouchableOpacity>
              </View>
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

        <View style={useWebBento ? styles.bentoTwoThird : null}>
          <FriendSectionCard
            isDark={isDark}
            friends={friendsPreviewData}
            friendCount={friendsCount}
            pendingRequestsCount={incomingRequests.length}
            searchQuery={friendsQuery}
            searchResults={friendSearchItems}
            searchLoading={friendsSearchLoading}
            searchError={friendsSearchError}
            onChangeSearchQuery={setFriendsQuery}
            onOpenFriendsList={() => router.push('/friends')}
            onOpenFriendLibrary={(friendId) =>
              router.push({
                pathname: `/friend/${friendId}` as any,
                params: {
                  name: friendsPreviewData.find((friend) => friend.id === friendId)?.name || 'Amigo/a',
                  avatarUrl: friendsPreviewData.find((friend) => friend.id === friendId)?.avatarUrl || '',
                },
              })
            }
            onOpenRequestsModal={() => setIsRequestsModalOpen(true)}
            onSendFriendRequest={(userId) => void handleAddFriend(userId)}
            onCompatibilityLongPress={(score) => setFriendMessage(`Compatibilidad ${score}%`)}
          />
          {!!friendMessage && <Text style={[styles.helpText, { color: isDark ? '#94A3B8' : '#64748B', marginTop: 6 }]}>{friendMessage}</Text>}
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
              <TouchableOpacity style={[styles.goalAdjustBtn, isDark && styles.goalAdjustBtnDark]} onPress={() => setMonthlyMovieGoal(Math.max(1, monthlyMovieGoal - 1))}>
                <Text style={[styles.goalAdjustBtnText, isDark && styles.goalAdjustBtnTextDark]}>-</Text>
              </TouchableOpacity>
              <Text style={[styles.goalCountText, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>{monthlyMovieGoal}</Text>
              <TouchableOpacity style={[styles.goalAdjustBtn, isDark && styles.goalAdjustBtnDark]} onPress={() => setMonthlyMovieGoal(Math.min(30, monthlyMovieGoal + 1))}>
                <Text style={[styles.goalAdjustBtnText, isDark && styles.goalAdjustBtnTextDark]}>+</Text>
              </TouchableOpacity>
              <View style={[styles.goalPeriodSwitch, isDark && styles.goalPeriodSwitchDark]}>
                <TouchableOpacity
                  style={[styles.goalPeriodBtn, isDark && styles.goalPeriodBtnDark, movieGoalPeriod === 'weekly' && styles.goalPeriodBtnActive]}
                  onPress={() => setMovieGoalPeriod('weekly')}
                >
                  <Text style={[styles.goalPeriodText, isDark && styles.goalPeriodTextDark, movieGoalPeriod === 'weekly' && styles.goalPeriodTextActive]}>Sem</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.goalPeriodBtn, isDark && styles.goalPeriodBtnDark, movieGoalPeriod === 'monthly' && styles.goalPeriodBtnActive]}
                  onPress={() => setMovieGoalPeriod('monthly')}
                >
                  <Text style={[styles.goalPeriodText, isDark && styles.goalPeriodTextDark, movieGoalPeriod === 'monthly' && styles.goalPeriodTextActive]}>Mes</Text>
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
              <TouchableOpacity style={[styles.goalAdjustBtn, isDark && styles.goalAdjustBtnDark]} onPress={() => setMonthlyGameGoal(Math.max(1, monthlyGameGoal - 1))}>
                <Text style={[styles.goalAdjustBtnText, isDark && styles.goalAdjustBtnTextDark]}>-</Text>
              </TouchableOpacity>
              <Text style={[styles.goalCountText, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>{monthlyGameGoal}</Text>
              <TouchableOpacity style={[styles.goalAdjustBtn, isDark && styles.goalAdjustBtnDark]} onPress={() => setMonthlyGameGoal(Math.min(20, monthlyGameGoal + 1))}>
                <Text style={[styles.goalAdjustBtnText, isDark && styles.goalAdjustBtnTextDark]}>+</Text>
              </TouchableOpacity>
              <View style={[styles.goalPeriodSwitch, isDark && styles.goalPeriodSwitchDark]}>
                <TouchableOpacity
                  style={[styles.goalPeriodBtn, isDark && styles.goalPeriodBtnDark, gameGoalPeriod === 'weekly' && styles.goalPeriodBtnActive]}
                  onPress={() => setGameGoalPeriod('weekly')}
                >
                  <Text style={[styles.goalPeriodText, isDark && styles.goalPeriodTextDark, gameGoalPeriod === 'weekly' && styles.goalPeriodTextActive]}>Sem</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.goalPeriodBtn, isDark && styles.goalPeriodBtnDark, gameGoalPeriod === 'monthly' && styles.goalPeriodBtnActive]}
                  onPress={() => setGameGoalPeriod('monthly')}
                >
                  <Text style={[styles.goalPeriodText, isDark && styles.goalPeriodTextDark, gameGoalPeriod === 'monthly' && styles.goalPeriodTextActive]}>Mes</Text>
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
      <FriendRequestsModal
        visible={isRequestsModalOpen}
        isDark={isDark}
        requests={incomingRequests}
        onClose={() => setIsRequestsModalOpen(false)}
        onAccept={(requestId) => void handleRespondRequest(requestId, 'accepted')}
        onReject={(requestId) => void handleRespondRequest(requestId, 'declined')}
      />
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
              <TouchableOpacity style={[styles.modalCancel, isDark && styles.modalCancelDark]} onPress={() => setIsEditNameOpen(false)}>
                <Text style={[styles.modalCancelText, isDark && styles.modalCancelTextDark]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} disabled={nameSaving} onPress={handleSaveUsername}>
                <Text style={styles.modalSaveText}>{nameSaving ? 'Guardando...' : 'Guardar'}</Text>
              </TouchableOpacity>
            </View>
            <MagicLoader visible={nameSaving} overlay fullScreen={false} blur text="Guardando..." />
          </View>
        </View>
      </Modal>
      <Modal visible={isEditAvatarOpen} transparent animationType="fade" onRequestClose={() => setIsEditAvatarOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.avatarModalCard, isDark && styles.cardDark]}>
            <Text style={[styles.blockTitle, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>Editar foto de perfil</Text>
            <TouchableOpacity style={[styles.avatarResetBtn, isDark && styles.avatarResetBtnDark]} onPress={() => void handleSelectAvatar(null)}>
              <Text style={[styles.avatarResetText, isDark && styles.avatarResetTextDark]}>Usar foto por defecto</Text>
            </TouchableOpacity>
            <View style={styles.avatarSearchWrap}>
              <TextInput
                value={avatarSearchQuery}
                onChangeText={setAvatarSearchQuery}
                placeholder="Buscar peli, serie o juego..."
                placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                style={[styles.avatarSearchInput, isDark && styles.avatarSearchInputDark, { color: isDark ? '#E5E7EB' : '#0F172A' }]}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
              />
              {avatarSearchQuery.length > 0 ? (
                <TouchableOpacity style={styles.avatarSearchClearButton} onPress={() => setAvatarSearchQuery('')}>
                  <View style={[styles.avatarSearchClearButtonInner, { backgroundColor: isDark ? '#1F2937' : '#E2E8F0' }]}>
                    <MaterialIcons name="close" size={14} color={isDark ? '#CBD5E1' : '#334155'} />
                  </View>
                </TouchableOpacity>
              ) : null}
            </View>
            {avatarLoading || avatarSearchLoading ? (
              <View style={styles.avatarLoadingWrap}>
                <MagicLoader size={26} color="#0E7490" secondaryColor="#A5F3FC" />
              </View>
            ) : (
              <ScrollView contentContainerStyle={styles.avatarGrid} showsVerticalScrollIndicator={false}>
                {(avatarSearchQuery.trim().length >= 2 ? avatarSearchOptions : avatarOptions).map((avatar) => (
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
                {avatarSearchQuery.trim().length >= 2 && avatarSearchOptions.length === 0 ? (
                  <Text style={[styles.helpText, { color: isDark ? '#94A3B8' : '#64748B', width: '100%', textAlign: 'center' }]}>
                    Sin resultados para esa búsqueda.
                  </Text>
                ) : null}
              </ScrollView>
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalCancel, isDark && styles.modalCancelDark]} onPress={() => setIsEditAvatarOpen(false)}>
                <Text style={[styles.modalCancelText, isDark && styles.modalCancelTextDark]}>Cerrar</Text>
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
    maxWidth: 1160,
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
  goalAdjustBtnDark: {
    borderColor: '#334155',
    backgroundColor: '#0F172A',
  },
  goalAdjustBtnText: {
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 13,
    lineHeight: 15,
  },
  goalAdjustBtnTextDark: {
    color: '#E5E7EB',
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
  goalPeriodSwitchDark: {
    borderColor: '#334155',
  },
  goalPeriodBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#FFFFFF',
  },
  goalPeriodBtnDark: {
    backgroundColor: '#0F172A',
  },
  goalPeriodBtnActive: {
    backgroundColor: '#0E7490',
  },
  goalPeriodText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  goalPeriodTextDark: {
    color: '#CBD5E1',
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
  modalCancelDark: {
    borderColor: '#334155',
    backgroundColor: '#0F172A',
  },
  modalCancelText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  modalCancelTextDark: {
    color: '#CBD5E1',
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
  avatarSearchInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingRight: 34,
    backgroundColor: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  avatarSearchWrap: {
    marginTop: 10,
    position: 'relative',
  },
  avatarSearchClearButton: {
    position: 'absolute',
    right: 8,
    top: '50%',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateY: -11 }],
  },
  avatarSearchClearButtonInner: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSearchInputDark: {
    borderColor: '#334155',
    backgroundColor: '#0B1220',
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
  avatarResetTextDark: {
    color: '#CBD5E1',
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
