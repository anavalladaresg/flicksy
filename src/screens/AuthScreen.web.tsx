import React, { useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SignIn, SignUp } from '@clerk/clerk-expo/web';
import { useColorScheme } from '@/hooks/use-color-scheme';

type AuthMode = 'login' | 'register';

export default function AuthScreenWeb() {
  const isDark = useColorScheme() === 'dark';
  const [mode, setMode] = useState<AuthMode>('login');
  const clerkAppearance = {
    variables: {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    },
    elements: {
      rootBox: {
        width: '100%',
      },
      cardBox: {
        width: '100%',
      },
      card: {
        boxShadow: 'none',
        border: '1px solid #E2E8F0',
        borderRadius: '12px',
      },
    },
  } as const;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#0B1220' : '#F8FAFC' }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={[styles.hero, isDark && styles.heroDark]}>
          <Text style={[styles.brand, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>Flicksy</Text>
          <Text style={[styles.heroSubtitle, { color: isDark ? '#CBD5E1' : '#334155' }]}>Tu catálogo de pelis, series y juegos</Text>
        </View>

        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleButton, mode === 'login' && styles.toggleButtonActive]}
            onPress={() => setMode('login')}
          >
            <Text style={[styles.toggleText, mode === 'login' && styles.toggleTextActive]}>Sign in</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, mode === 'register' && styles.toggleButtonActive]}
            onPress={() => setMode('register')}
          >
            <Text style={[styles.toggleText, mode === 'register' && styles.toggleTextActive]}>Sign up</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.clerkWebWrap}>
          {mode === 'login' ? <SignIn appearance={clerkAppearance} /> : <SignUp appearance={clerkAppearance} />}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  hero: {
    width: '100%',
    maxWidth: 460,
    borderRadius: 20,
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#7DD3FC',
    padding: 16,
    marginBottom: 10,
  },
  heroDark: {
    backgroundColor: '#111827',
    borderColor: '#1E3A8A',
  },
  brand: { fontSize: 30, fontWeight: '900' },
  heroSubtitle: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  toggleRow: {
    width: '100%',
    maxWidth: 460,
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  toggleButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#0E7490',
    borderColor: '#0E7490',
  },
  toggleText: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 13,
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  toggleTextActive: {
    color: '#FFFFFF',
  },
  clerkWebWrap: {
    width: '100%',
    maxWidth: 460,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
});
