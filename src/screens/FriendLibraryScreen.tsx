import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { TMDB_IMAGE_BASE_URL } from '../constants/config';
import { getFriendLibrary } from '../services/social';
import type { TrackedItem } from '../types';

const FALLBACK_IMAGE = require('../../assets/images/icon.png');

function resolvePoster(item: TrackedItem): string | null {
  if (!item.posterPath) return null;
  if (/^[a-z0-9]{8,}$/i.test(item.posterPath) && !item.posterPath.includes('/')) {
    return `https://images.igdb.com/igdb/image/upload/t_cover_big_2x/${item.posterPath}.jpg`;
  }
  if (item.posterPath.startsWith('/')) return `${TMDB_IMAGE_BASE_URL}${item.posterPath}`;
  if (item.posterPath.startsWith('//')) return `https:${item.posterPath}`.replace('/t_thumb/', '/t_cover_big_2x/');
  if (item.posterPath.startsWith('http')) return item.posterPath.replace('/t_thumb/', '/t_cover_big_2x/');
  return `https://${item.posterPath}`.replace('/t_thumb/', '/t_cover_big_2x/');
}

function FriendLibraryScreen() {
  const isDark = useColorScheme() === 'dark';
  const router = useRouter();
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const [items, setItems] = useState<TrackedItem[]>([]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const data = await getFriendLibrary(id);
      if (!cancelled) setItems(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const sortedItems = [...items].sort((a, b) => {
    const order = (status: TrackedItem['status']) => {
      if (status === 'watching' || status === 'playing') return 0;
      if (status === 'planned') return 1;
      if (status === 'completed') return 2;
      return 3;
    };
    const byStatus = order(a.status) - order(b.status);
    if (byStatus !== 0) return byStatus;
    return b.dateAdded.localeCompare(a.dateAdded);
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#0B1220' : '#F8FAFC' }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={18} color={isDark ? '#E5E7EB' : '#0F172A'} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.backText, { color: isDark ? '#CBD5E1' : '#334155' }]}>Volver</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>{name ? `Biblioteca de ${name}` : 'Biblioteca amiga/o'}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {items.length === 0 ? (
          <Text style={[styles.emptyText, { color: isDark ? '#94A3B8' : '#64748B' }]}>Sin contenido reciente.</Text>
        ) : (
          sortedItems.map((item, index) => {
            const previous = sortedItems[index - 1];
            const showStatusSeparator = index > 0 && previous?.status !== item.status;
            return (
              <View key={item.id}>
                {showStatusSeparator ? <View style={[styles.statusSeparator, isDark && styles.statusSeparatorDark]} /> : null}
                <TouchableOpacity
                  style={[styles.card, isDark && styles.cardDark]}
                  onPress={() =>
                    router.push({
                      pathname: `/${item.mediaType}/${item.externalId}` as any,
                      params: {
                        fromFriendId: id,
                        fromFriendName: name || 'Amigo/a',
                      },
                    })
                  }
                >
                  <Image source={resolvePoster(item) ? { uri: resolvePoster(item) as string } : FALLBACK_IMAGE} style={styles.poster} resizeMode="cover" />
                  <View style={styles.meta}>
                    <Text numberOfLines={2} style={[styles.itemTitle, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>{item.title}</Text>
                    <Text style={[styles.sub, { color: isDark ? '#94A3B8' : '#64748B' }]}>{item.mediaType.toUpperCase()}</Text>
                    <Text style={[styles.friendRating, { color: isDark ? '#FBBF24' : '#B45309' }]}>
                      ⭐️ {typeof item.rating === 'number' ? `${item.rating.toFixed(1)}/10` : 'Sin puntuación'}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 6, flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  title: { fontSize: 20, fontWeight: '900' },
  backText: { fontSize: 13, fontWeight: '700' },
  content: { padding: 16, gap: 8, paddingBottom: 24 },
  emptyText: { fontSize: 13, fontWeight: '600' },
  card: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 10,
    flexDirection: 'row',
    gap: 10,
  },
  cardDark: {
    borderColor: '#1F2937',
    backgroundColor: '#111827',
  },
  poster: {
    width: 56,
    height: 84,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  meta: { flex: 1, justifyContent: 'center' },
  itemTitle: { fontSize: 14, fontWeight: '800' },
  sub: { marginTop: 4, fontSize: 11, fontWeight: '700' },
  friendRating: { marginTop: 4, fontSize: 12, fontWeight: '700' },
  statusSeparator: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginTop: 2,
    marginBottom: 8,
  },
  statusSeparatorDark: {
    backgroundColor: '#334155',
  },
});

export default FriendLibraryScreen;
