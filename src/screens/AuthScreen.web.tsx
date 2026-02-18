import React, { useState } from 'react';
import { Platform, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SignIn, SignUp } from '@clerk/clerk-expo/web';
import { useColorScheme } from '@/hooks/use-color-scheme';
import GridMotionBackground from '@/src/components/common/GridMotionBackground.web';

type AuthMode = 'login' | 'register';

export default function AuthScreenWeb() {
  // Forzar modo oscuro para el auth
  const isDark = true;
  const [mode, setMode] = useState<AuthMode>('login');
  const clerkAppearance = {
    baseTheme: 'dark' as any,
    variables: {
      colorPrimary: '#0E7490',
      colorText: '#E5E7EB',
      colorTextSecondary: '#CBD5E1',
      colorBackground: '#0B1220',
      colorInputBackground: '#111827',
      colorInputText: '#E5E7EB',
      borderRadius: '12px',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      fontSize: '16px',
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
        border: '1px solid #1F2937',
        borderRadius: '16px',
        backgroundColor: '#111827',
      },
      headerTitle: {
        color: '#E5E7EB',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        fontSize: '24px',
        fontWeight: '700',
      },
      headerSubtitle: {
        color: '#CBD5E1',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      },
      formButtonPrimary: {
        backgroundColor: '#0E7490',
        color: '#FFFFFF',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        fontSize: '15px',
        fontWeight: '700',
        borderRadius: '10px',
        '&:hover': {
          backgroundColor: '#0891b2',
        },
      },
      formFieldInput: {
        backgroundColor: '#0B1220',
        borderColor: '#1F2937',
        color: '#E5E7EB',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        fontSize: '16px',
        borderRadius: '10px',
        '&:focus': {
          borderColor: '#0E7490',
        },
      },
      formFieldLabel: {
        color: '#CBD5E1',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        fontSize: '14px',
        fontWeight: '600',
      },
      footerActionLink: {
        color: '#7DD3FC',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        fontWeight: '600',
        '&:hover': {
          color: '#BAE6FD',
        },
      },
      socialButtonsBlockButton: {
        backgroundColor: '#1F2937',
        borderColor: '#334155',
        color: '#E5E7EB',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        borderRadius: '10px',
        '&:hover': {
          backgroundColor: '#374151',
        },
      },
      dividerLine: {
        backgroundColor: '#1F2937',
      },
      dividerText: {
        color: '#94A3B8',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      },
    },
  } as const;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#0B1220' : '#F8FAFC' }]}>
      <GridMotionBackground gradientColor="#0a7ea4" />
      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        keyboardShouldPersistTaps="handled"
        {...(Platform.OS === 'web' ? {
          style: { position: 'relative', zIndex: 1 } as any,
        } : {})}
      >
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
          {mode === 'login' ? <SignIn appearance={clerkAppearance as any} /> : <SignUp appearance={clerkAppearance as any} />}
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
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 20,
    marginBottom: 16,
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
  },
  heroDark: {
    backgroundColor: '#111827',
    borderColor: '#1F2937',
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
    borderColor: '#1F2937',
    backgroundColor: '#0B1220',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    ...(Platform.OS === 'web' && {
      transition: 'all 0.2s ease',
    } as any),
  },
  toggleButtonActive: {
    backgroundColor: '#0E7490',
    borderColor: '#0E7490',
    boxShadow: '0 2px 4px rgba(14, 116, 144, 0.3)',
  },
  toggleText: {
    color: '#CBD5E1',
    fontWeight: '700',
    fontSize: 14,
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  toggleTextActive: {
    color: '#FFFFFF',
  },
  clerkWebWrap: {
    width: '100%',
    maxWidth: 460,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 8,
  },
});
