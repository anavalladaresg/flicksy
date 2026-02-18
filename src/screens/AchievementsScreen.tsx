import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { usePreferencesStore } from '../store/preferences';
import { ACHIEVEMENT_DEFINITIONS, AchievementCategory, AchievementRarity } from '../features/achievements/catalog';

const CATEGORY_ORDER: AchievementCategory[] = ['Objetivos', 'Descubrimiento', 'Coleccionismo'];

function rarityColor(rarity: AchievementRarity, isDark: boolean) {
  if (rarity === 'Legendario') return isDark ? '#FCD34D' : '#B45309';
  if (rarity === 'Epico') return isDark ? '#C4B5FD' : '#6D28D9';
  if (rarity === 'Raro') return isDark ? '#93C5FD' : '#1D4ED8';
  return isDark ? '#86EFAC' : '#15803D';
}

export default function AchievementsScreen() {
  const isDark = useColorScheme() === 'dark';
  const router = useRouter();
  const unlocked = usePreferencesStore((state) => state.unlockedAchievementIds);

  const grouped = useMemo(() => {
    const byCategory: Record<AchievementCategory, ((typeof ACHIEVEMENT_DEFINITIONS)[number] & { unlocked: boolean })[]> = {
      Objetivos: [],
      Descubrimiento: [],
      Coleccionismo: [],
    };

    ACHIEVEMENT_DEFINITIONS.forEach((definition) => {
      byCategory[definition.category].push({
        ...definition,
        unlocked: unlocked.includes(definition.id),
      });
    });

    CATEGORY_ORDER.forEach((category) => {
      byCategory[category].sort((a, b) => Number(b.unlocked) - Number(a.unlocked));
    });

    return byCategory;
  }, [unlocked]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#0B1220' : '#F8FAFC' }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>Logros</Text>
          <TouchableOpacity style={[styles.backBtn, isDark && styles.backBtnDark]} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={16} color={isDark ? '#E5E7EB' : '#0F172A'} />
          </TouchableOpacity>
        </View>

        {CATEGORY_ORDER.map((category) => (
          <View key={category} style={[styles.section, isDark && styles.sectionDark]}>
            <Text style={[styles.sectionTitle, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>{category}</Text>
            {grouped[category].map((achievement) => (
              <View
                key={achievement.id}
                style={[
                  styles.itemRow,
                  isDark && styles.itemRowDark,
                  !achievement.unlocked && styles.itemRowLocked,
                  isDark && !achievement.unlocked && styles.itemRowLockedDark,
                ]}
              >
                <View style={[styles.iconBadge, { backgroundColor: `${rarityColor(achievement.rarity, isDark)}22` }]}>
                  <MaterialIcons
                    name={achievement.icon as keyof typeof MaterialIcons.glyphMap}
                    size={16}
                    color={rarityColor(achievement.rarity, isDark)}
                  />
                </View>
                <View style={styles.itemContent}>
                  <Text
                    style={[
                      styles.itemText,
                      { color: isDark ? '#CBD5E1' : '#334155' },
                      !achievement.unlocked && styles.itemTextLocked,
                    ]}
                  >
                    {achievement.title}
                  </Text>
                  <Text style={[styles.itemDescription, { color: isDark ? '#94A3B8' : '#64748B' }]}>{achievement.description}</Text>
                </View>
                <View style={styles.rightCol}>
                  <Text style={[styles.tierText, { color: rarityColor(achievement.rarity, isDark) }]}>{achievement.rarity}</Text>
                  <Text style={[styles.stateText, { color: achievement.unlocked ? '#16A34A' : '#94A3B8' }]}>
                    {achievement.unlocked ? 'Conseguido' : 'Pendiente'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 12 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: { fontSize: 24, fontWeight: '900' },
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
    backgroundColor: '#0F172A',
  },
  section: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    padding: 12,
  },
  sectionDark: {
    borderColor: '#1F2937',
    backgroundColor: '#111827',
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', marginBottom: 8 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    padding: 8,
    marginBottom: 6,
  },
  itemRowDark: {
    borderColor: '#334155',
    backgroundColor: '#0B1220',
  },
  itemRowLocked: {
    opacity: 0.75,
    backgroundColor: '#F8FAFC',
  },
  itemRowLockedDark: {
    backgroundColor: '#111827',
  },
  iconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemContent: { flex: 1 },
  itemText: { fontSize: 13, fontWeight: '700' },
  itemTextLocked: {
    opacity: 0.85,
  },
  itemDescription: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '600',
  },
  rightCol: {
    alignItems: 'flex-end',
    gap: 2,
  },
  tierText: { fontSize: 11, fontWeight: '800' },
  stateText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
