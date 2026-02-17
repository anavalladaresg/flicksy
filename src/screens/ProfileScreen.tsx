import React from 'react';
import { SafeAreaView, StyleSheet, Switch, Text, View } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { usePreferencesStore } from '../store/preferences';

function ProfileScreen() {
  const isDark = useColorScheme() === 'dark';
  const username = usePreferencesStore((state) => state.username);
  const themeMode = usePreferencesStore((state) => state.themeMode);
  const setThemeMode = usePreferencesStore((state) => state.setThemeMode);
  const darkEnabled = themeMode === 'dark';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#0B1220' : '#F8FAFC' }]}>
      <View style={[styles.card, isDark && styles.cardDark]}>
        <Text style={[styles.title, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>Mi perfil</Text>
        <Text style={[styles.label, { color: isDark ? '#94A3B8' : '#64748B' }]}>Usuario</Text>
        <Text style={[styles.username, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>{username}</Text>
      </View>

      <View style={[styles.card, isDark && styles.cardDark]}>
        <View style={styles.row}>
          <Text style={[styles.modeLabel, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>Modo oscuro</Text>
          <Switch
            value={darkEnabled}
            onValueChange={(next) => setThemeMode(next ? 'dark' : 'light')}
            trackColor={{ false: '#CBD5E1', true: '#0E7490' }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  cardDark: {
    backgroundColor: '#111827',
    borderColor: '#1F2937',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 10,
  },
  label: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '700',
  },
  username: {
    marginTop: 4,
    fontSize: 18,
    color: '#0F172A',
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modeLabel: {
    fontSize: 15,
    color: '#0F172A',
    fontWeight: '700',
  },
});

export { ProfileScreen };
export default ProfileScreen;
