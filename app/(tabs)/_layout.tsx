import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStatus } from '@/src/hooks/use-auth-status';
import { supabase } from '@/src/services/supabase';
import { getPendingFriendRequestsCount } from '@/src/services/social';

// Estilos CSS para hover en web
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    /* Efectos hover para tabs en web */
    [data-testid="tab-bar-button"] {
      transition: all 0.2s ease !important;
      border-radius: 12px !important;
    }
    [data-testid="tab-bar-button"]:hover {
      transform: scale(1.08) translateY(-2px) !important;
      background-color: rgba(14, 116, 144, 0.1) !important;
    }
    [data-testid="tab-bar-button"][aria-selected="true"]:hover {
      background-color: rgba(14, 116, 144, 0.15) !important;
    }
  `;
  document.head.appendChild(style);
}

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

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: isWeb ? undefined : HapticTab,
        tabBarPosition: isWeb ? 'top' : 'bottom',
        tabBarStyle: isWeb
          ? {
              height: 56,
              borderBottomWidth: 1,
              borderTopWidth: 0,
              borderBottomColor: colorScheme === 'dark' ? '#1F2937' : '#E2E8F0',
              backgroundColor: colorScheme === 'dark' ? '#0B1220' : '#FFFFFF',
              paddingTop: 4,
            }
          : undefined,
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
