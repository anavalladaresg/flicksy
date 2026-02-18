import { useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../services/supabase';

function isRealSignedSession(session: { user?: { email?: string | null; is_anonymous?: boolean | null } } | null): boolean {
  if (!session?.user) return false;
  if (session.user.is_anonymous) return false;
  return Boolean(session.user.email);
}

export function useAuthStatus() {
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);
  const [isSignedIn, setIsSignedIn] = useState(!isSupabaseConfigured);

  useEffect(() => {
    if (!supabase || !isSupabaseConfigured) {
      setIsSignedIn(true);
      setIsLoading(false);
      return;
    }

    let mounted = true;
    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!mounted) return;
        const signedIn = isRealSignedSession(data.session as any);
        if (!signedIn && data.session?.user?.is_anonymous) {
          await supabase.auth.signOut();
        }
        setIsSignedIn(signedIn);
        setIsLoading(false);
      })
      .catch(() => {
        if (!mounted) return;
        setIsSignedIn(false);
        setIsLoading(false);
      });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const signedIn = isRealSignedSession(session as any);
      setIsSignedIn(signedIn);
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return { isLoading, isSignedIn };
}

