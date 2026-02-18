import { Redirect, Tabs } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStatus } from '@/src/hooks/use-auth-status';
import { supabase } from '@/src/services/supabase';
import { getPendingFriendRequestsCount } from '@/src/services/social';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { isLoading, isSignedIn } = useAuthStatus();
  const [pendingRequests, setPendingRequests] = useState(0);

  useEffect(() => {
    if (!isSignedIn || !supabase) return;
    let mounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const refreshPending = async () => {
      const count = await getPendingFriendRequestsCount();
      if (mounted) setPendingRequests(count);
    };

    void refreshPending();
    const interval = setInterval(() => void refreshPending(), 15000);

    void (async () => {
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id;
      if (!userId) return;
      channel = supabase
        .channel(`friend_requests_badge_${userId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'friend_requests', filter: `to_user_id=eq.${userId}` },
          () => void refreshPending()
        )
        .subscribe();
    })();

    return () => {
      mounted = false;
      clearInterval(interval);
      if (channel) supabase.removeChannel(channel);
    };
  }, [isSignedIn]);

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

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Search',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="magnifyingglass" color={color} />,
        }}
      />
      <Tabs.Screen
        name="tracked"
        options={{
          title: 'Library',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="bookmark.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color }) => (
            <View style={{ position: 'relative' }}>
              <IconSymbol size={28} name="person.fill" color={color} />
              {pendingRequests > 0 ? (
                <View
                  style={{
                    position: 'absolute',
                    top: 1,
                    right: -1,
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: '#EF4444',
                  }}
                />
              ) : null}
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
