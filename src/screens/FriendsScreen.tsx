import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import UserAvatar from '../components/common/UserAvatar';
import { getFriendsCompatibility, getFriendsList, type FriendProfile } from '../services/social';

function FriendsScreen() {
  const isDark = useColorScheme() === 'dark';
  const router = useRouter();
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [compatibilityByFriend, setCompatibilityByFriend] = useState<Record<string, { compatibility: number; sharedItems: number }>>({});

  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;
      (async () => {
        const [data, compatibility] = await Promise.all([getFriendsList(), getFriendsCompatibility()]);
        if (!cancelled) {
          setFriends(data);
          setCompatibilityByFriend(compatibility);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  useEffect(() => {
    const interval = setInterval(() => {
      void (async () => {
        const [data, compatibility] = await Promise.all([getFriendsList(), getFriendsCompatibility()]);
        setFriends(data);
        setCompatibilityByFriend(compatibility);
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
        <View style={styles.headerTextWrap}>
          <Text style={[styles.title, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>Mis amigos</Text>
          <Text style={[styles.subtitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>Tu círculo social en Flicksy</Text>
        </View>
        <View style={[styles.countBadge, isDark && styles.countBadgeDark]}>
          <Text style={styles.countBadgeText}>{friends.length}</Text>
        </View>
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
                  params: {
                    name: friend.display_name || friend.username || 'Amigo/a',
                    avatarUrl: friend.avatar_url || '',
                  },
                })
              }
            >
              <View style={styles.rowMainInfo}>
                <UserAvatar avatarUrl={friend.avatar_url ?? null} size={38} isDark={isDark} />
                <View>
                  <Text style={[styles.name, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>
                    {friend.display_name || friend.username}
                  </Text>
                  <Text style={[styles.username, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                    @{friend.username}
                  </Text>
                  <View style={[styles.compatibilityPill, isDark && styles.compatibilityPillDark]}>
                    <MaterialIcons name="favorite" size={12} color={isDark ? '#7DD3FC' : '#0E7490'} />
                    <Text style={[styles.compatibilityText, { color: isDark ? '#CFFAFE' : '#0F172A' }]}>
                      Compatibilidad {compatibilityByFriend[friend.id]?.compatibility ?? 0}% · {compatibilityByFriend[friend.id]?.sharedItems ?? 0} en común
                    </Text>
                  </View>
                </View>
              </View>
              <View style={[styles.chevronCircle, isDark && styles.chevronCircleDark]}>
                <MaterialIcons name="navigate-next" size={20} color={isDark ? '#93C5FD' : '#0369A1'} />
              </View>
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
    paddingHorizontal: 20,
    paddingTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTextWrap: {
    flex: 1,
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
  content: { paddingHorizontal: 20, paddingTop: 18, gap: 10, paddingBottom: 24 },
  title: { fontSize: 24, fontWeight: '900' },
  subtitle: { marginTop: -3, fontSize: 12, fontWeight: '600' },
  countBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0E7490',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  countBadgeDark: {
    backgroundColor: '#1D4ED8',
  },
  countBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
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
  rowMainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowDark: {
    borderColor: '#1F2937',
    backgroundColor: '#111827',
  },
  chevronCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFEFF',
  },
  chevronCircleDark: {
    backgroundColor: '#0F172A',
  },
  name: { fontSize: 14, fontWeight: '800' },
  username: { marginTop: 2, fontSize: 12, fontWeight: '600' },
  compatibilityPill: {
    marginTop: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#CFFAFE',
    borderRadius: 999,
    backgroundColor: '#ECFEFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  compatibilityPillDark: {
    borderColor: '#164E63',
    backgroundColor: '#082F49',
  },
  compatibilityText: {
    fontSize: 11,
    fontWeight: '700',
  },
});

export default FriendsScreen;
