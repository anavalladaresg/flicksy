import React, { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { SafeAreaView, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { gameRepository } from '../features/games/data/repositories';
import { movieRepository } from '../features/movies/data/repositories';
import { tvRepository } from '../features/tv/data/repositories';
import { isSupabaseConfigured, supabase } from '../services/supabase';
import { usePreferencesStore } from '../store/preferences';
import { useTrackingStore } from '../store/tracking';
import { MediaType, TrackedItem } from '../types';

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

function weeklyStreak(items: TrackedItem[]): number {
  const dates = new Set<string>();
  for (const item of items) {
    const candidates = [item.dateAdded, item.watchedAt, item.startedAt, item.finishedAt].filter(Boolean) as string[];
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

function ProfileScreen() {
  const isDark = useColorScheme() === 'dark';
  const username = usePreferencesStore((state) => state.username);
  const themeMode = usePreferencesStore((state) => state.themeMode);
  const setThemeMode = usePreferencesStore((state) => state.setThemeMode);
  const alertsNewSeason = usePreferencesStore((state) => state.alertsNewSeason);
  const alertsUpcomingRelease = usePreferencesStore((state) => state.alertsUpcomingRelease);
  const setAlertsNewSeason = usePreferencesStore((state) => state.setAlertsNewSeason);
  const setAlertsUpcomingRelease = usePreferencesStore((state) => state.setAlertsUpcomingRelease);
  const monthlyMovieGoal = usePreferencesStore((state) => state.monthlyMovieGoal);
  const monthlyGameGoal = usePreferencesStore((state) => state.monthlyGameGoal);
  const trackedItems = useTrackingStore((state) => state.items);
  const darkEnabled = themeMode === 'dark';
  const isWeb = typeof window !== 'undefined';

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
    const result = days.map((label, index) => {
      const dayDate = new Date(now);
      const diff = (now.getDay() + 6) % 7 - index;
      dayDate.setDate(now.getDate() - diff);
      const dayKey = dayDate.toISOString().slice(0, 10);
      const count = trackedItems.filter((item) => {
        const candidate = item.dateAdded?.slice(0, 10);
        return candidate === dayKey;
      }).length;
      return { label, count };
    });
    const max = Math.max(1, ...result.map((item) => item.count));
    return result.map((item) => ({ ...item, ratio: item.count / max }));
  }, [trackedItems]);

  const monthlyRatings = useMemo(() => {
    const monthItems = trackedItems.filter((item) => isCurrentMonth(item.dateAdded) && typeof item.rating === 'number');
    if (monthItems.length === 0) return 0;
    return monthItems.reduce((acc, item) => acc + (item.rating ?? 0), 0) / monthItems.length;
  }, [trackedItems]);

  const completedMoviesThisMonth = trackedItems.filter(
    (item) => item.mediaType === 'movie' && isCurrentMonth(item.watchedAt || item.dateAdded)
  ).length;
  const completedGamesThisMonth = trackedItems.filter(
    (item) => item.mediaType === 'game' && item.status === 'completed' && isCurrentMonth(item.finishedAt || item.dateAdded)
  ).length;

  const newSeasonAlerts = useMemo(() => {
    const seasonMap = new Map(detailTV.map((show) => [show.id, show.number_of_seasons ?? 0]));
    return trackedItems
      .filter((item) => item.mediaType === 'tv' && typeof item.seasonsAtAdd === 'number')
      .filter((item) => (seasonMap.get(item.externalId) ?? 0) > (item.seasonsAtAdd ?? 0));
  }, [trackedItems, detailTV]);

  const upcomingReleaseAlerts = useMemo(() => {
    const now = new Date();
    const in45 = new Date();
    in45.setDate(now.getDate() + 45);

    const movieById = new Map(detailMovies.map((movie) => [movie.id, movie.release_date]));
    const tvById = new Map(detailTV.map((show) => [show.id, show.first_air_date]));
    const gameById = new Map(detailGames.map((game) => [game.id, game.release_dates?.[0]?.date]));

    return trackedItems.filter((item) => {
      if (item.mediaType === 'movie') {
        const date = movieById.get(item.externalId);
        if (!date) return false;
        const dt = new Date(date);
        return dt >= now && dt <= in45;
      }
      if (item.mediaType === 'tv') {
        const date = tvById.get(item.externalId);
        if (!date) return false;
        const dt = new Date(date);
        return dt >= now && dt <= in45;
      }
      const unix = gameById.get(item.externalId);
      if (!unix) return false;
      const dt = new Date(unix * 1000);
      return dt >= now && dt <= in45;
    });
  }, [trackedItems, detailMovies, detailTV, detailGames]);

  const achievements = useMemo(() => {
    const list: { id: string; label: string; unlocked: boolean }[] = [
      { id: 'streak-2', label: 'Racha de 2 semanas', unlocked: streak >= 2 },
      { id: 'library-25', label: 'Biblioteca de 25 items', unlocked: trackedItems.length >= 25 },
      { id: 'genres-5', label: 'Explorador: 5 géneros', unlocked: topGenres.length >= 5 },
      { id: 'movies-goal', label: `Objetivo pelis (${monthlyMovieGoal}/mes)`, unlocked: completedMoviesThisMonth >= monthlyMovieGoal },
      { id: 'games-goal', label: `Objetivo juegos (${monthlyGameGoal}/mes)`, unlocked: completedGamesThisMonth >= monthlyGameGoal },
    ];
    return list;
  }, [streak, trackedItems.length, topGenres.length, monthlyMovieGoal, monthlyGameGoal, completedMoviesThisMonth, completedGamesThisMonth]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#0B1220' : '#F8FAFC' }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, isDark && styles.cardDark]}>
          <Text style={[styles.title, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>Mi perfil</Text>
          <Text style={[styles.label, { color: isDark ? '#94A3B8' : '#64748B' }]}>Usuario</Text>
          <Text style={[styles.username, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>{username}</Text>
          {isSupabaseConfigured ? (
            <TouchableOpacity style={styles.logoutButton} onPress={() => void supabase?.auth.signOut()}>
              <Text style={styles.logoutButtonText}>Cerrar sesión</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={[styles.card, isDark && styles.cardDark]}>
          <View style={styles.row}>
            <Text style={[styles.modeLabel, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>Modo oscuro</Text>
            <Switch
              value={darkEnabled}
              onValueChange={(next) => setThemeMode(next ? 'dark' : 'light')}
              trackColor={{ false: '#CBD5E1', true: '#0E7490' }}
              thumbColor="#FFFFFF"
            />
          </View>
          <View style={styles.row}>
            <Text style={[styles.modeLabel, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>Alerta: nueva temporada</Text>
            <Switch
              value={alertsNewSeason}
              onValueChange={setAlertsNewSeason}
              trackColor={{ false: '#CBD5E1', true: '#0E7490' }}
              thumbColor="#FFFFFF"
            />
          </View>
          <View style={styles.row}>
            <Text style={[styles.modeLabel, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>Alerta: estreno cercano</Text>
            <Switch
              value={alertsUpcomingRelease}
              onValueChange={setAlertsUpcomingRelease}
              trackColor={{ false: '#CBD5E1', true: '#0E7490' }}
              thumbColor="#FFFFFF"
            />
          </View>
          <Text style={[styles.helpText, { color: isDark ? '#94A3B8' : '#64748B' }]}>
            {alertsNewSeason ? `${newSeasonAlerts.length} aviso(s) de nueva temporada.` : 'Alertas de temporada desactivadas.'}
          </Text>
          <Text style={[styles.helpText, { color: isDark ? '#94A3B8' : '#64748B' }]}>
            {alertsUpcomingRelease ? `${upcomingReleaseAlerts.length} estreno(s) cercano(s) detectado(s).` : 'Alertas de estreno desactivadas.'}
          </Text>
        </View>

        <View style={[styles.card, isDark && styles.cardDark]}>
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

        <View style={[styles.card, isDark && styles.cardDark]}>
          <Text style={[styles.blockTitle, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>Objetivos</Text>
          <View style={styles.goalItem}>
            <Text style={[styles.goalText, { color: isDark ? '#CBD5E1' : '#334155' }]}>
              {`3 películas/mes: ${completedMoviesThisMonth}/${monthlyMovieGoal}`}
            </Text>
            <View style={[styles.goalBarBg, isDark && styles.goalBarBgDark]}>
              <View style={[styles.goalBarFill, { width: `${Math.min(100, (completedMoviesThisMonth / Math.max(1, monthlyMovieGoal)) * 100)}%` }]} />
            </View>
          </View>
          <View style={styles.goalItem}>
            <Text style={[styles.goalText, { color: isDark ? '#CBD5E1' : '#334155' }]}>
              {`Terminar 2 juegos pendientes: ${completedGamesThisMonth}/${monthlyGameGoal}`}
            </Text>
            <View style={[styles.goalBarBg, isDark && styles.goalBarBgDark]}>
              <View style={[styles.goalBarFill, { width: `${Math.min(100, (completedGamesThisMonth / Math.max(1, monthlyGameGoal)) * 100)}%` }]} />
            </View>
          </View>
        </View>

        <View style={[styles.card, isDark && styles.cardDark]}>
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

        <View style={[styles.card, isDark && styles.cardDark]}>
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

        <View style={[styles.card, isDark && styles.cardDark]}>
          <Text style={[styles.blockTitle, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>Logros</Text>
          {achievements.map((achievement) => (
            <View key={achievement.id} style={styles.achievementRow}>
              <Text style={[styles.achievementText, { color: isDark ? '#CBD5E1' : '#334155' }]}>{achievement.label}</Text>
              <Text style={[styles.achievementState, { color: achievement.unlocked ? '#16A34A' : '#94A3B8' }]}>
                {achievement.unlocked ? 'Desbloqueado' : 'Bloqueado'}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
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
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
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
  logoutButton: {
    marginTop: 12,
    alignSelf: 'flex-start',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  logoutButtonText: {
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '800',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modeLabel: {
    fontSize: 15,
    color: '#0F172A',
    fontWeight: '700',
  },
  helpText: {
    fontSize: 12,
    marginTop: 2,
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
  achievementText: {
    fontSize: 13,
    fontWeight: '700',
  },
  achievementState: {
    fontSize: 12,
    fontWeight: '800',
  },
});

export { ProfileScreen };
export default ProfileScreen;
