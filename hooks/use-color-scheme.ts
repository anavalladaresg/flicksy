import { useColorScheme as useRNColorScheme } from 'react-native';
import { usePreferencesStore } from '@/src/store/preferences';

export function useColorScheme() {
  const systemScheme = useRNColorScheme();
  const themeMode = usePreferencesStore((state) => state.themeMode);

  if (themeMode === 'dark') return 'dark';
  if (themeMode === 'light') return 'light';
  return systemScheme ?? 'light';
}
