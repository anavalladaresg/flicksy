import { useAuth, useUser } from '@clerk/clerk-expo';
import { useEffect, useRef } from 'react';
import { isSupabaseConfigured, supabase } from '../services/supabase';

export function useAuthStatus() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const { user } = useUser();
  const lastSyncedUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (!supabase || !isSupabaseConfigured || !isLoaded) return;

    if (!isSignedIn) {
      lastSyncedUserRef.current = null;
      return;
    }

    if (!userId || lastSyncedUserRef.current === userId) return;

    void (async () => {
      try {
        if (!userId) {
          console.warn('[auth] Missing Clerk user id.');
          return;
        }

        const preferredName =
          user?.username ||
          user?.firstName ||
          user?.emailAddresses?.[0]?.emailAddress?.split('@')[0] ||
          'usuario';
        console.log('[auth-debug] profile-sync:start', {
          userId,
          preferredName,
          isSignedIn,
        });
        const { error } = await supabase.from('profiles').upsert(
          {
            id: userId,
            username: preferredName.toLowerCase().trim(),
            display_name: preferredName.trim(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );
        if (error) {
          console.warn('[auth] profiles upsert failed:', error.message);
          console.warn('[auth-debug] profile-sync:error-detail', error);
        } else {
          console.log('[auth-debug] profile-sync:ok', { userId });
        }
        lastSyncedUserRef.current = userId;
      } catch (error) {
        console.warn('[auth] Clerk -> Supabase profile sync failed:', error);
      }
    })();
  }, [isLoaded, isSignedIn, user, userId]);

  return { isLoading: !isLoaded, isSignedIn: Boolean(isSignedIn) };
}
