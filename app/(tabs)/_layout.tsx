import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import DynamicTopTabs from '@/src/components/common/DynamicTopTabs';
import { useAuthStatus } from '@/src/hooks/use-auth-status';
import { supabase } from '@/src/services/supabase';
import { getPendingFriendRequestsCount } from '@/src/services/social';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isWeb = Platform.OS === 'web';
  const { isLoading, isSignedIn } = useAuthStatus();
  const { userId } = useAuth();
  const [pendingRequests, setPendingRequests] = useState(0);

  useEffect(() => {
    const sb = supabase;
    if (!isSignedIn || !sb) return;
    let mounted = true;
    let channel: ReturnType<typeof sb.channel> | null = null;

    const refreshPending = async () => {
      const count = await getPendingFriendRequestsCount();
      if (mounted) setPendingRequests(count);
    };

    void refreshPending();
    const interval = setInterval(() => void refreshPending(), 15000);

    if (!userId) return;
    channel = sb
      .channel(`friend_requests_badge_${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'friend_requests', filter: `to_user_id=eq.${userId}` },
        () => void refreshPending()
      )
      .subscribe();

    return () => {
      mounted = false;
      clearInterval(interval);
      if (channel) sb.removeChannel(channel);
    };
  }, [isSignedIn, userId]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colorScheme === 'dark' ? '#0B1220' : '#F8FAFC' }}>
        <ActivityIndicator size="large" color="#0E7490" />
      </View>
    );
  }

  if (!isSignedIn) {
    return <Redirect href="/auth" />;
  }

  const webTabBar = isWeb
    ? (props: Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0]) => (
        <DynamicTopTabs
          {...props}
          isDark={colorScheme === 'dark'}
          pendingRequests={pendingRequests}
          activeColor={Colors[colorScheme ?? 'light'].tint}
        />
      )
    : undefined;

  return (
    <Tabs
      tabBar={webTabBar}
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: isWeb ? undefined : HapticTab,
        tabBarPosition: isWeb ? 'top' : 'bottom',
        tabBarStyle: isWeb ? { display: 'none' } : undefined,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Buscar',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="magnifyingglass" color={color} />,
        }}
      />
      <Tabs.Screen
        name="tracked"
        options={{
          title: 'Biblioteca',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="bookmark.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
