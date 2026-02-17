import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ThemeMode = 'system' | 'light' | 'dark';

interface PreferencesState {
  username: string;
  themeMode: ThemeMode;
  setUsername: (username: string) => void;
  setThemeMode: (mode: ThemeMode) => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      username: 'anavalladares',
      themeMode: 'system',
      setUsername: (username) => set({ username }),
      setThemeMode: (themeMode) => set({ themeMode }),
    }),
    {
      name: 'flicksy-preferences',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

