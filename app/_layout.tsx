import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-reanimated';

import { useAuthStatus } from '@/src/hooks/use-auth-status';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { QueryProvider } from '../src/providers/QueryProvider';
import { useTrackingStore } from '../src/store/tracking';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { isLoading: isAuthLoading, isSignedIn } = useAuthStatus();

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
          <Stack.Screen name="movie/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="tv/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="game/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      </ThemeProvider>
    </QueryProvider>
  );
}
