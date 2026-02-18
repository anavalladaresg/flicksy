import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getFriendsList, type FriendProfile } from '../services/social';

function FriendsScreen() {
  const isDark = useColorScheme() === 'dark';
  const router = useRouter();
  const [friends, setFriends] = useState<FriendProfile[]>([]);

  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;
      (async () => {
        const data = await getFriendsList();
        if (!cancelled) setFriends(data);
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  useEffect(() => {
    const interval = setInterval(() => {
      void (async () => {
        const data = await getFriendsList();
        setFriends(data);
      })();
    }, 12000);
    return () => clearInterval(interval);
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#0B1220' : '#F8FAFC' }]}>
      <View style={styles.header}>
        <TouchableOpacity style={[styles.backBtn, isDark && styles.backBtnDark]} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back-ios-new" size={16} color={isDark ? '#E5E7EB' : '#0F172A'} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>Mis amigos</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {friends.length === 0 ? (
          <Text style={[styles.emptyText, { color: isDark ? '#94A3B8' : '#64748B' }]}>
            Aún no tienes amistades aceptadas.
          </Text>
        ) : (
          friends.map((friend) => (
            <TouchableOpacity
              key={friend.id}
              style={[styles.row, isDark && styles.rowDark]}
              onPress={() =>
                router.push({
                  pathname: `/friend/${friend.id}` as any,
                  params: { name: friend.display_name || friend.username || 'Amigo/a' },
                })
              }
            >
              <View>
                <Text style={[styles.name, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>
                  {friend.display_name || friend.username}
                </Text>
                <Text style={[styles.username, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                  @{friend.username}
                </Text>
              </View>
              <MaterialIcons name="navigate-next" size={22} color={isDark ? '#93C5FD' : '#0369A1'} />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  backBtnDark: {
    borderColor: '#334155',
    backgroundColor: '#111827',
  },
  content: { padding: 16, gap: 10, paddingBottom: 24 },
  title: { fontSize: 24, fontWeight: '900' },
  emptyText: { fontSize: 13, fontWeight: '600' },
  row: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowDark: {
    borderColor: '#1F2937',
    backgroundColor: '#111827',
  },
  name: { fontSize: 14, fontWeight: '800' },
  username: { marginTop: 2, fontSize: 12, fontWeight: '600' },
});

export default FriendsScreen;
