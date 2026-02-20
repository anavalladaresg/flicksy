import { useAuth, useUser } from '@clerk/clerk-expo';
import { useEffect, useRef } from 'react';
import { isSupabaseConfigured, supabase } from '../services/supabase';
import { syncOwnProfile } from '../services/social';

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
        const googleAccountImage =
          (user?.externalAccounts as any[])?.find((account: any) => account?.provider === 'oauth_google')?.imageUrl ||
          null;
        await syncOwnProfile(preferredName, {
          fallbackAvatarUrl: googleAccountImage,
        });
        lastSyncedUserRef.current = userId;
      } catch (error) {
        console.warn('[auth] Clerk -> Supabase profile sync failed:', error);
      }
    })();
  }, [isLoaded, isSignedIn, user, userId]);

  return { isLoading: !isLoaded, isSignedIn: Boolean(isSignedIn) };
}
