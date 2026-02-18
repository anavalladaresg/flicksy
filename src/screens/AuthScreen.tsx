import React, { useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { isSupabaseConfigured, supabase } from '../services/supabase';
import { usePreferencesStore } from '../store/preferences';

type AuthMode = 'login' | 'register';

function AuthScreen() {
  const isDark = useColorScheme() === 'dark';
  const setUsername = usePreferencesStore((state) => state.setUsername);
  const [mode, setMode] = useState<AuthMode>('login');
  const [username, setUsernameInput] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  async function handleSubmit() {
    setError('');
    setInfo('');
    if (!supabase || !isSupabaseConfigured) {
      setError('Supabase no está configurado.');
      return;
    }
    if (!email.trim() || !password.trim()) {
      setError('Completa email y contraseña.');
      return;
    }
    if (mode === 'register' && !username.trim()) {
      setError('Añade un nombre de usuario.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) {
          setError(signInError.message);
          return;
        }
        const remoteUsername =
          (data.user?.user_metadata?.username as string | undefined) ||
          (data.user?.user_metadata?.display_name as string | undefined) ||
          data.user?.email?.split('@')[0] ||
          'Usuario';
        setUsername(remoteUsername);
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              username: username.trim(),
              display_name: username.trim(),
            },
          },
        });
        if (signUpError) {
          setError(signUpError.message);
          return;
        }
        setUsername(username.trim());
        if (!data.session) {
          setInfo('Cuenta creada. Revisa tu email para confirmar el acceso.');
        }
      }
    } finally {
      setLoading(false);
    }
  }

  const title = mode === 'login' ? 'Inicia sesión' : 'Crea tu cuenta';
  const actionLabel = mode === 'login' ? 'Entrar' : 'Registrarme';
  const switchLabel = mode === 'login' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#0B1220' : '#F8FAFC' }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={[styles.hero, isDark && styles.heroDark]}>
          <Text style={[styles.brand, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>Flicksy</Text>
          <Text style={[styles.heroSubtitle, { color: isDark ? '#CBD5E1' : '#334155' }]}>Tu catálogo de pelis, series y juegos</Text>
          <View style={styles.heroBadges}>
            <View style={styles.heroBadge}><MaterialIcons name="movie" size={12} color="#0E7490" /><Text style={styles.heroBadgeText}>Pelis</Text></View>
            <View style={styles.heroBadge}><MaterialIcons name="tv" size={12} color="#0E7490" /><Text style={styles.heroBadgeText}>Series</Text></View>
            <View style={styles.heroBadge}><MaterialIcons name="sports-esports" size={12} color="#0E7490" /><Text style={styles.heroBadgeText}>Juegos</Text></View>
          </View>
        </View>

        <View style={[styles.card, isDark && styles.cardDark]}>
          <Text style={[styles.title, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>{title}</Text>

          {mode === 'register' ? (
            <TextInput
              value={username}
              onChangeText={setUsernameInput}
              autoCapitalize="words"
              autoCorrect={false}
              placeholder="Nombre de usuario"
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              style={[styles.input, isDark && styles.inputDark, { color: isDark ? '#E5E7EB' : '#0F172A' }]}
            />
          ) : null}

          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="Email"
            placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
            style={[styles.input, isDark && styles.inputDark, { color: isDark ? '#E5E7EB' : '#0F172A' }]}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            placeholder="Contraseña"
            placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
            style={[styles.input, isDark && styles.inputDark, { color: isDark ? '#E5E7EB' : '#0F172A' }]}
          />

          {!!error && <Text style={styles.errorText}>{error}</Text>}
          {!!info && <Text style={styles.infoText}>{info}</Text>}

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            disabled={loading}
            onPress={handleSubmit}
          >
            {loading ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.submitText}>{actionLabel}</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchButton}
            onPress={() => {
              setMode((current) => (current === 'login' ? 'register' : 'login'));
              setError('');
              setInfo('');
            }}
          >
            <Text style={styles.switchText}>{switchLabel}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  hero: {
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
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    padding: 18,
  },
  cardDark: {
    borderColor: '#1F2937',
    backgroundColor: '#111827',
  },
  brand: {
    fontSize: 30,
    fontWeight: '900',
  },
  heroSubtitle: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '600',
  },
  heroBadges: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  heroBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0E7490',
  },
  title: {
    marginBottom: 14,
    fontSize: 22,
    fontWeight: '800',
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
  },
  inputDark: {
    borderColor: '#334155',
    backgroundColor: '#0B1220',
  },
  submitButton: {
    height: 44,
    borderRadius: 10,
    backgroundColor: '#0E7490',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  switchButton: {
    marginTop: 12,
    alignItems: 'center',
  },
  switchText: {
    color: '#0E7490',
    fontWeight: '700',
  },
  errorText: {
    marginBottom: 8,
    color: '#DC2626',
    fontWeight: '600',
    fontSize: 12,
  },
  infoText: {
    marginBottom: 8,
    color: '#0E7490',
    fontWeight: '600',
    fontSize: 12,
  },
});

export default AuthScreen;
