import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { ClerkProvider } from '@clerk/clerk-expo';
import { tokenCache } from '@clerk/clerk-expo/token-cache';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import 'react-native-reanimated';

import { useAuthStatus } from '@/src/hooks/use-auth-status';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { QueryProvider } from '../src/providers/QueryProvider';
import { CLERK_PUBLISHABLE_KEY, isClerkConfigured } from '../src/services/clerk';
import { configureNotifications, registerPushToken } from '../src/services/notifications';
import { saveOwnPushToken } from '../src/services/social';
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
          Missing Clerk config. Add EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY.
        </Text>
      </View>
    );
  }

  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
      <RootLayoutContent />
    </ClerkProvider>
  );
}

function RootLayoutContent() {
  const colorScheme = useColorScheme();
  const { isLoading: isAuthLoading, isSignedIn } = useAuthStatus();

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
          <Stack.Screen name="movie/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="tv/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="game/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="friends" options={{ headerShown: false }} />
          <Stack.Screen name="friend/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <AppToaster />
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      </ThemeProvider>
    </QueryProvider>
  );
}
