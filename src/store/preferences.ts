import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { create } from 'zustand/index.js';
import { createJSONStorage, persist } from 'zustand/middleware.js';

export type ThemeMode = 'system' | 'light' | 'dark';

// Función para obtener el tema inicial según la plataforma
function getInitialThemeMode(): ThemeMode {
  if (Platform.OS === 'web') {
    // En web, siempre empezar en modo claro por defecto
    return 'light';
  }
  return 'system';
}

interface PreferencesState {
  username: string;
  themeMode: ThemeMode;
  alertsAchievements: boolean;
  alertsFriendRequests: boolean;
  alertsFriendsActivity: boolean;
  alertsNewSeason: boolean;
  alertsUpcomingRelease: boolean;
  dismissedRecommendationKeys: string[];
  monthlyMovieGoal: number;
  monthlyGameGoal: number;
  seenAchievementIds: string[];
  setUsername: (username: string) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setAlertsAchievements: (enabled: boolean) => void;
  setAlertsFriendRequests: (enabled: boolean) => void;
  setAlertsFriendsActivity: (enabled: boolean) => void;
  setAlertsNewSeason: (enabled: boolean) => void;
  setAlertsUpcomingRelease: (enabled: boolean) => void;
  dismissRecommendation: (key: string) => void;
  restoreRecommendation: (key: string) => void;
  setMonthlyMovieGoal: (count: number) => void;
  setMonthlyGameGoal: (count: number) => void;
  markAchievementSeen: (id: string) => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      username: 'anavalladares',
      themeMode: getInitialThemeMode(),
      alertsAchievements: true,
      alertsFriendRequests: true,
      alertsFriendsActivity: true,
      alertsNewSeason: true,
      alertsUpcomingRelease: true,
      dismissedRecommendationKeys: [],
      monthlyMovieGoal: 3,
      monthlyGameGoal: 2,
      seenAchievementIds: [],
      setUsername: (username) => set({ username }),
      setThemeMode: (themeMode) => set({ themeMode }),
      setAlertsAchievements: (alertsAchievements) => set({ alertsAchievements }),
      setAlertsFriendRequests: (alertsFriendRequests) => set({ alertsFriendRequests }),
      setAlertsFriendsActivity: (alertsFriendsActivity) => set({ alertsFriendsActivity }),
      setAlertsNewSeason: (alertsNewSeason) => set({ alertsNewSeason }),
      setAlertsUpcomingRelease: (alertsUpcomingRelease) => set({ alertsUpcomingRelease }),
      dismissRecommendation: (key) =>
        set((state) => ({
          dismissedRecommendationKeys: state.dismissedRecommendationKeys.includes(key)
            ? state.dismissedRecommendationKeys
            : [...state.dismissedRecommendationKeys, key],
        })),
      restoreRecommendation: (key) =>
        set((state) => ({
          dismissedRecommendationKeys: state.dismissedRecommendationKeys.filter((item) => item !== key),
        })),
      setMonthlyMovieGoal: (monthlyMovieGoal) => set({ monthlyMovieGoal }),
      setMonthlyGameGoal: (monthlyGameGoal) => set({ monthlyGameGoal }),
      markAchievementSeen: (id) =>
        set((state) => ({
          seenAchievementIds: state.seenAchievementIds.includes(id)
            ? state.seenAchievementIds
            : [...state.seenAchievementIds, id],
        })),
    }),
    {
      name: 'flicksy-preferences',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
