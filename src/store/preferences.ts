import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand/index.js';
import { createJSONStorage, persist } from 'zustand/middleware.js';

export type ThemeMode = 'system' | 'light' | 'dark';

interface PreferencesState {
  username: string;
  themeMode: ThemeMode;
  alertsNewSeason: boolean;
  alertsUpcomingRelease: boolean;
  dismissedRecommendationKeys: string[];
  monthlyMovieGoal: number;
  monthlyGameGoal: number;
  setUsername: (username: string) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setAlertsNewSeason: (enabled: boolean) => void;
  setAlertsUpcomingRelease: (enabled: boolean) => void;
  dismissRecommendation: (key: string) => void;
  restoreRecommendation: (key: string) => void;
  setMonthlyMovieGoal: (count: number) => void;
  setMonthlyGameGoal: (count: number) => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      username: 'anavalladares',
      themeMode: 'system',
      alertsNewSeason: true,
      alertsUpcomingRelease: true,
      dismissedRecommendationKeys: [],
      monthlyMovieGoal: 3,
      monthlyGameGoal: 2,
      setUsername: (username) => set({ username }),
      setThemeMode: (themeMode) => set({ themeMode }),
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
    }),
    {
      name: 'flicksy-preferences',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
