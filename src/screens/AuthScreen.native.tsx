import { useColorScheme } from '@/hooks/use-color-scheme';
import MagicLoader from '@/components/loaders/MagicLoader';
import { useAuth, useSSO, useSignIn, useSignUp, useUser } from '@clerk/clerk-expo';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { syncOwnProfile } from '../services/social';
import { usePreferencesStore } from '../store/preferences';
import { useGlobalLoader } from '../hooks/useGlobalLoader';

type EmailMode = 'signin' | 'signup' | null;

export default function AuthScreen() {
  const isDark = useColorScheme() === 'dark';
  const setUsername = usePreferencesStore((state: any) => state.setUsername);
  const { startSSOFlow } = useSSO();
  const { signIn, setActive: setActiveSignIn, isLoaded: signInLoaded } = useSignIn();
  const { signUp, setActive: setActiveSignUp, isLoaded: signUpLoaded } = useSignUp();
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const { showLoader, hideLoader } = useGlobalLoader();

  const [emailMode, setEmailMode] = useState<EmailMode>(null);
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [pendingSecondFactor, setPendingSecondFactor] = useState(false);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google' | null>(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const syncedUserRef = useRef<string | null>(null);
  const isLoaded = signInLoaded && signUpLoaded;

  useEffect(() => {
    if (!isSignedIn || !user?.id) {
      syncedUserRef.current = null;
      return;
    }
    if (syncedUserRef.current === user.id) return;

    const preferredName =
      user.username ||
      user.firstName ||
      user.emailAddresses?.[0]?.emailAddress?.split('@')[0] ||
      'Usuario';

    syncedUserRef.current = user.id;
    setUsername(preferredName);
    void syncOwnProfile(preferredName);
  }, [isSignedIn, setUsername, user]);

  const resetEmailFlow = useCallback(() => {
    setCode('');
    setPendingVerification(false);
    setPendingSecondFactor(false);
    setError('');
    setInfo('');
    setLoading(false);
  }, []);

  const startEmailMode = useCallback(
    (mode: Exclude<EmailMode, null>) => {
      setEmailMode(mode);
      resetEmailFlow();
    },
    [resetEmailFlow]
  );

  const stopEmailMode = useCallback(() => {
    setEmailMode(null);
    resetEmailFlow();
  }, [resetEmailFlow]);

  const handleSocialLogin = useCallback(
    async (strategy: 'oauth_google') => {
      setError('');
      setInfo('');
      setSocialLoading('google');
      showLoader({ text: 'Conectando cuenta...', overlay: true, fullScreen: true, blur: true });
      try {
        const { createdSessionId, setActive } = await startSSOFlow({ strategy });
        if (createdSessionId && setActive) {
          await setActive({ session: createdSessionId });
          return;
        }
        setError('No se pudo completar el acceso social.');
      } catch (err: any) {
        const message = err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || err?.message || 'No se pudo iniciar sesión social.';
        setError(message);
      } finally {
        hideLoader();
        setSocialLoading(null);
      }
    },
    [hideLoader, showLoader, startSSOFlow]
  );

  const handleEmailSubmit = useCallback(async () => {
    setError('');
    setInfo('');

    if (!isLoaded) {
      setError('Inicializando autenticación...');
      return;
    }
    if (!emailAddress.trim() || !password.trim()) {
      setError('Completa email y contraseña.');
      return;
    }
    if (!emailMode) {
      setError('Selecciona iniciar sesión o crear cuenta por email.');
      return;
    }

    setLoading(true);
    showLoader({ text: emailMode === 'signin' ? 'Iniciando sesión...' : 'Creando cuenta...', overlay: true, fullScreen: true, blur: true });
    try {
      if (emailMode === 'signin') {
        const signInAttempt = await signIn.create({
          identifier: emailAddress.trim(),
          password,
        });

        if (signInAttempt.status === 'complete') {
          await setActiveSignIn?.({ session: signInAttempt.createdSessionId });
          return;
        }

        if (signInAttempt.status === 'needs_second_factor') {
          const emailCodeFactor = signInAttempt.supportedSecondFactors?.find(
            (factor: any) => factor.strategy === 'email_code'
          ) as any;
          if (!emailCodeFactor) {
            setError('Tu cuenta requiere un segundo factor no soportado aquí.');
            return;
          }
          await signIn.prepareSecondFactor({
            strategy: 'email_code',
            emailAddressId: emailCodeFactor.emailAddressId,
          });
          setPendingSecondFactor(true);
          setInfo('Te enviamos un código por email para completar el acceso.');
          return;
        }

        setError('No se pudo completar el inicio de sesión.');
      } else {
        await signUp.create({
          emailAddress: emailAddress.trim(),
          password,
        });
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
        setPendingVerification(true);
        setInfo('Te enviamos un código por email para verificar tu cuenta.');
      }
    } catch (err: any) {
      const message = err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || err?.message || 'No se pudo completar la acción.';
      setError(message);
    } finally {
      hideLoader();
      setLoading(false);
    }
  }, [emailAddress, emailMode, hideLoader, isLoaded, password, setActiveSignIn, showLoader, signIn, signUp]);

  const handleVerify = useCallback(async () => {
    setError('');
    setInfo('');
    if (!isLoaded) return;
    if (!code.trim()) {
      setError('Introduce el código de verificación.');
      return;
    }

    setLoading(true);
    showLoader({ text: 'Verificando código...', overlay: true, fullScreen: true, blur: true });
    try {
      if (pendingVerification) {
        const attempt = await signUp.attemptEmailAddressVerification({ code: code.trim() });
        if (attempt.status === 'complete') {
          await setActiveSignUp?.({ session: attempt.createdSessionId });
          return;
        }
        setError('No se pudo completar la verificación.');
        return;
      }

      if (pendingSecondFactor) {
        const attempt = await signIn.attemptSecondFactor({
          strategy: 'email_code',
          code: code.trim(),
        });
        if (attempt.status === 'complete') {
          await setActiveSignIn?.({ session: attempt.createdSessionId });
          return;
        }
      }

      setError('Código no válido.');
    } catch (err: any) {
      const message = err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || err?.message || 'Código no válido.';
      setError(message);
    } finally {
      hideLoader();
      setLoading(false);
    }
  }, [code, hideLoader, isLoaded, pendingSecondFactor, pendingVerification, setActiveSignIn, setActiveSignUp, showLoader, signIn, signUp]);

  const showCodeInput = pendingVerification || pendingSecondFactor;
  const emailTitle = useMemo(() => {
    if (showCodeInput) return 'Verificación';
    return emailMode === 'signin' ? 'Acceso por email' : 'Registro por email';
  }, [emailMode, showCodeInput]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#0B1220' : '#F8FAFC' }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={[styles.hero, isDark && styles.heroDark]}>
          <Text style={[styles.brand, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>Flicksy</Text>
          <Text style={[styles.heroSubtitle, { color: isDark ? '#CBD5E1' : '#334155' }]}>
            Descubre, guarda y comparte tus pelis, series y juegos favoritos.
          </Text>
        </View>

        <View style={[styles.card, isDark && styles.cardDark]}>
          {emailMode === null ? (
            <>
              <Text style={[styles.title, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>Bienvenido de nuevo</Text>

              <TouchableOpacity
                style={[styles.socialButton, styles.googleButton, isDark && styles.googleButtonDark]}
                onPress={() => void handleSocialLogin('oauth_google')}
                disabled={socialLoading !== null}
              >
                {socialLoading === 'google' ? (
                  <MagicLoader size={20} color={isDark ? '#E5E7EB' : '#0F172A'} secondaryColor={isDark ? '#BAE6FD' : '#67E8F9'} />
                ) : (
                  <MaterialIcons name="g-translate" size={20} color={isDark ? '#E5E7EB' : '#0F172A'} />
                )}
                <Text style={[styles.googleButtonText, isDark && styles.googleButtonTextDark]}>Seguir con Google</Text>
              </TouchableOpacity>

              <View style={styles.separatorRow}>
                <View style={[styles.separatorLine, { backgroundColor: isDark ? '#334155' : '#CBD5E1' }]} />
                <Text style={[styles.separatorText, { color: isDark ? '#94A3B8' : '#64748B' }]}>o con tu email</Text>
                <View style={[styles.separatorLine, { backgroundColor: isDark ? '#334155' : '#CBD5E1' }]} />
              </View>

              <View style={styles.rowGap}>
                <TouchableOpacity style={styles.primaryButton} onPress={() => startEmailMode('signin')}>
                  <Text style={styles.primaryButtonText}>Entrar con email</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.secondaryButton, isDark && styles.secondaryButtonDark]} onPress={() => startEmailMode('signup')}>
                  <Text style={[styles.secondaryButtonText, isDark && styles.secondaryButtonTextDark]}>Crear cuenta gratis</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text style={[styles.title, { color: isDark ? '#E5E7EB' : '#0F172A' }]}>{emailTitle}</Text>

              {!showCodeInput ? (
                <>
                  <TextInput
                    value={emailAddress}
                    onChangeText={setEmailAddress}
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
                </>
              ) : (
                <TextInput
                  value={code}
                  onChangeText={setCode}
                  autoCapitalize="none"
                  keyboardType="number-pad"
                  placeholder="Código de verificación"
                  placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                  style={[styles.input, isDark && styles.inputDark, { color: isDark ? '#E5E7EB' : '#0F172A' }]}
                />
              )}

              {!!error && <Text style={styles.errorText}>{error}</Text>}
              {!!info && <Text style={styles.infoText}>{info}</Text>}

              <TouchableOpacity
                style={[styles.primaryButton, loading && styles.submitButtonDisabled]}
                disabled={loading}
                onPress={showCodeInput ? handleVerify : handleEmailSubmit}
              >
                {loading ? (
                  <MagicLoader size={18} color="#FFFFFF" secondaryColor="#BAE6FD" />
                ) : (
                  <Text style={styles.primaryButtonText}>{showCodeInput ? 'Verificar código' : emailMode === 'signin' ? 'Iniciar sesión' : 'Continuar'}</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.switchButton} onPress={stopEmailMode}>
                <Text style={styles.switchText}>Volver a métodos de acceso</Text>
              </TouchableOpacity>
            </>
          )}

          {!!error && emailMode === null ? <Text style={[styles.errorText, { marginTop: 12 }]}>{error}</Text> : null}
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
  brand: { fontSize: 30, fontWeight: '900' },
  heroSubtitle: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '600',
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
  title: {
    marginBottom: 14,
    fontSize: 22,
    fontWeight: '800',
  },
  socialButton: {
    height: 48,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  googleButtonDark: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
  },
  googleButtonText: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '700',
  },
  googleButtonTextDark: {
    color: '#E5E7EB',
  },
  separatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
    gap: 8,
  },
  separatorLine: {
    flex: 1,
    height: 1,
  },
  separatorText: {
    fontSize: 12,
    fontWeight: '700',
  },
  rowGap: {
    gap: 10,
  },
  primaryButton: {
    height: 44,
    borderRadius: 10,
    backgroundColor: '#0E7490',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButton: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#0E7490',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonDark: {
    borderColor: '#22D3EE',
    backgroundColor: '#0F172A',
  },
  secondaryButtonText: {
    color: '#0E7490',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButtonTextDark: {
    color: '#67E8F9',
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
  submitButtonDisabled: { opacity: 0.7 },
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
