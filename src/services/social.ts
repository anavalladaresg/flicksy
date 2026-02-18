import { supabase } from './supabase';
import { sendExpoPushNotification } from './notifications';
import type { TrackedItem } from '../types';
import { getClerkInstance } from '@clerk/clerk-expo';

export interface FriendProfile {
  id: string;
  username: string;
  display_name?: string | null;
}

export interface FriendRequestItem {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  fromName?: string;
  fromProfile?: FriendProfile;
}

export interface FriendActivityItem {
  id: string;
  friendId: string;
  friendName: string;
  title: string;
  externalId: number;
  mediaType: 'movie' | 'tv' | 'game';
  status: string;
  activityDate: string;
}

export interface FriendItemRating {
  friendId: string;
  friendName: string;
  rating: number;
  status: string;
}

async function getCurrentUserId(): Promise<string | null> {
  const clerk = getClerkInstance();
  const userId = clerk.user?.id ?? null;
  if (!userId) {
    console.warn('[social-debug] getCurrentUserId: missing Clerk user id');
  }
  return userId;
}

function normalizeUsername(input: string): string {
  return input.trim().toLowerCase();
}

async function getAcceptedFriendIds(userId: string): Promise<string[]> {
  if (!supabase) return [];
  const [friendsRes, requestsRes] = await Promise.all([
    supabase
      .from('friends')
      .select('user_id,friend_id')
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`),
    supabase
      .from('friend_requests')
      .select('from_user_id,to_user_id')
      .eq('status', 'accepted')
      .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`),
  ]);

  const ids = new Set<string>();

  if (!friendsRes.error) {
    (friendsRes.data ?? []).forEach((row: any) => {
      ids.add(row.user_id === userId ? row.friend_id : row.user_id);
    });
  }

  if (!requestsRes.error) {
    (requestsRes.data ?? []).forEach((row: any) => {
      ids.add(row.from_user_id === userId ? row.to_user_id : row.from_user_id);
    });
  }

  ids.delete(userId);
  return [...ids];
}

export async function syncOwnProfile(username: string): Promise<void> {
  if (!supabase) return;
  const userId = await getCurrentUserId();
  if (!userId) return;
  const normalized = normalizeUsername(username);
  if (!normalized) return;
  console.log('[social-debug] syncOwnProfile:start', { userId, username: normalized });
  const { error } = await supabase.from('profiles').upsert(
    {
      id: userId,
      username: normalized,
      display_name: username.trim(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );
  if (error) {
    console.warn('[social] syncOwnProfile failed:', error.message);
  } else {
    console.log('[social-debug] syncOwnProfile:ok', { userId });
  }
}

export async function saveOwnPushToken(pushToken: string): Promise<void> {
  if (!supabase || !pushToken) return;
  const userId = await getCurrentUserId();
  if (!userId) return;
  const { error } = await supabase
    .from('profiles')
    .update({ expo_push_token: pushToken, updated_at: new Date().toISOString() } as any)
    .eq('id', userId);
  if (error) {
    console.warn('[social] saveOwnPushToken failed:', error.message);
  }
}

export async function isUsernameAvailable(username: string): Promise<{ available: boolean; message?: string }> {
  if (!supabase) return { available: true };
  const userId = await getCurrentUserId();
  if (!userId) return { available: false, message: 'Sesión no disponible.' };

  const normalized = normalizeUsername(username);
  if (!normalized) return { available: false, message: 'Nombre inválido.' };

  const { data, error } = await supabase.from('profiles').select('id,username').eq('username', normalized).limit(1);
  if (error) {
    console.warn('[social] isUsernameAvailable failed:', error.message);
    return { available: false, message: 'No se pudo validar el nombre.' };
  }
  if (!data || data.length === 0) return { available: true };
  if (data[0].id === userId) return { available: true };
  return { available: false, message: 'Ese nombre de usuario ya está en uso.' };
}

export async function searchProfilesByUsername(query: string): Promise<FriendProfile[]> {
  if (!supabase || query.trim().length < 2) return [];
  const userId = await getCurrentUserId();
  if (!userId) return [];
  const normalized = normalizeUsername(query);

  const { data, error } = await supabase
    .from('profiles')
    .select('id,username,display_name')
    .ilike('username', `%${normalized}%`)
    .limit(15);

  if (error) {
    console.warn('[social] searchProfilesByUsername failed:', error.message);
    return [];
  }

  // unique by username just in case table constraint is missing
  const dedup = new Map<string, FriendProfile>();
  ((data ?? []) as FriendProfile[])
    .filter((profile) => profile.id !== userId)
    .forEach((profile) => {
      if (!dedup.has(profile.username)) dedup.set(profile.username, profile);
    });
  return [...dedup.values()];
}

export async function sendFriendRequestByUserId(toUserId: string): Promise<{ ok: boolean; message: string }> {
  if (!supabase) return { ok: false, message: 'Supabase no configurado.' };
  const fromUserId = await getCurrentUserId();
  if (!fromUserId) return { ok: false, message: 'Sesión no disponible.' };
  if (fromUserId === toUserId) return { ok: false, message: 'No puedes enviarte solicitud.' };

  const clerk = getClerkInstance();
  const senderDraftName =
    clerk.user?.username ||
    clerk.user?.firstName ||
    clerk.user?.emailAddresses?.[0]?.emailAddress?.split('@')[0] ||
    'Usuario';
  await syncOwnProfile(senderDraftName);

  const existing = await supabase
    .from('friend_requests')
    .select('id,status')
    .eq('from_user_id', fromUserId)
    .eq('to_user_id', toUserId)
    .in('status', ['pending', 'accepted'])
    .limit(1);
  if (!existing.error && (existing.data?.length ?? 0) > 0) {
    return { ok: false, message: 'Ya existe una solicitud activa.' };
  }

  const [senderProfileRes, recipientProfileRes] = await Promise.all([
    supabase.from('profiles').select('username,display_name').eq('id', fromUserId).maybeSingle(),
    supabase.from('profiles').select('*').eq('id', toUserId).maybeSingle(),
  ]);

  const senderName =
    (senderProfileRes.data as any)?.display_name ||
    (senderProfileRes.data as any)?.username ||
    'Alguien';
  const recipientName =
    (recipientProfileRes.data as any)?.display_name ||
    (recipientProfileRes.data as any)?.username ||
    'usuario';

  const { error } = await supabase.from('friend_requests').insert({
    from_user_id: fromUserId,
    to_user_id: toUserId,
    status: 'pending',
  });
  if (error) {
    console.warn('[social] sendFriendRequestByUserId failed:', error.message);
    return { ok: false, message: 'No se pudo enviar la solicitud.' };
  }

  const recipientToken = (recipientProfileRes.data as any)?.expo_push_token as string | undefined;
  if (recipientToken) {
    try {
      await sendExpoPushNotification(
        recipientToken,
        'Nueva solicitud de amistad',
        `${senderName} quiere ser tu amigo/a.`
      );
    } catch (pushError) {
      console.warn('[social] push send failed:', pushError);
    }
  }

  return { ok: true, message: `Solicitud enviada a ${recipientName}.` };
}

export async function getIncomingFriendRequests(): Promise<FriendRequestItem[]> {
  if (!supabase) return [];
  const userId = await getCurrentUserId();
  if (!userId) return [];
  const { data, error } = await supabase
    .from('friend_requests')
    .select('*')
    .eq('to_user_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('[social] getIncomingFriendRequests failed:', error.message);
    return [];
  }
  const requests = (data ?? []) as FriendRequestItem[];
  const fromIds = requests.map((r) => r.from_user_id);
  if (fromIds.length === 0) return [];
  const profilesRes = await supabase.from('profiles').select('id,username,display_name').in('id', fromIds);
  const map = new Map((profilesRes.data ?? []).map((p: any) => [p.id, p as FriendProfile]));
  return requests.map((request) => {
    const fromProfile = map.get(request.from_user_id);
    const fallbackFromRequest =
      (request as any).from_display_name ||
      (request as any).from_username ||
      (request as any).sender_name ||
      undefined;
    return {
      ...request,
      fromProfile,
      fromName: fromProfile?.display_name || fromProfile?.username || fallbackFromRequest || 'Usuario',
    };
  });
}

export async function respondFriendRequest(
  requestId: string,
  decision: 'accepted' | 'declined'
): Promise<{ ok: boolean; message: string }> {
  if (!supabase) return { ok: false, message: 'Supabase no configurado.' };
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, message: 'Sesión no disponible.' };

  const reqRes = await supabase
    .from('friend_requests')
    .select('id,from_user_id,to_user_id,status')
    .eq('id', requestId)
    .eq('to_user_id', userId)
    .single();
  if (reqRes.error || !reqRes.data) {
    return { ok: false, message: 'Solicitud no encontrada.' };
  }
  const request = reqRes.data as any;
  const upd = await supabase.from('friend_requests').update({ status: decision }).eq('id', requestId);
  if (upd.error) {
    console.warn('[social] respondFriendRequest update failed:', upd.error.message);
    return { ok: false, message: 'No se pudo actualizar solicitud.' };
  }

  if (decision === 'accepted') {
    const payload = [{ user_id: request.to_user_id, friend_id: request.from_user_id }];
    const fr = await supabase
      .from('friends')
      .upsert(payload, { onConflict: 'user_id,friend_id', ignoreDuplicates: true });
    if (fr.error) {
      console.warn('[social] respondFriendRequest upsert friends failed:', fr.error.message);
      // Friendship is still represented by accepted request; keep UX successful.
    }
  }
  return { ok: true, message: decision === 'accepted' ? 'Solicitud aceptada.' : 'Solicitud rechazada.' };
}

export async function getFriendsCount(): Promise<number> {
  if (!supabase) return 0;
  const userId = await getCurrentUserId();
  if (!userId) return 0;
  const ids = await getAcceptedFriendIds(userId);
  return ids.length;
}

export async function getPendingFriendRequestsCount(): Promise<number> {
  if (!supabase) return 0;
  const userId = await getCurrentUserId();
  if (!userId) return 0;
  const { count, error } = await supabase
    .from('friend_requests')
    .select('id', { count: 'exact', head: true })
    .eq('to_user_id', userId)
    .eq('status', 'pending');
  if (error) {
    console.warn('[social] getPendingFriendRequestsCount failed:', error.message);
    return 0;
  }
  return count ?? 0;
}

export async function getFriendsList(): Promise<FriendProfile[]> {
  if (!supabase) return [];
  const userId = await getCurrentUserId();
  if (!userId) return [];
  const friendIds = await getAcceptedFriendIds(userId);
  if (friendIds.length === 0) return [];
  const profilesRes = await supabase.from('profiles').select('id,username,display_name').in('id', friendIds);
  if (profilesRes.error) return [];
  return (profilesRes.data ?? []) as FriendProfile[];
}

export async function getFriendLibrary(friendId: string): Promise<TrackedItem[]> {
  if (!supabase) return [];
  const res = await supabase
    .from('library_items')
    .select('id,media_type,external_id,title,poster_path,status,rating,watched_at,started_at,finished_at,created_at')
    .eq('user_id', friendId)
    .order('created_at', { ascending: false });
  if (res.error) {
    console.warn('[social] getFriendLibrary failed:', res.error.message);
    return [];
  }
  return (res.data ?? []).map((row: any) => ({
    id: row.id,
    mediaType: row.media_type,
    externalId: row.external_id,
    title: row.title,
    posterPath: row.poster_path ?? undefined,
    status: row.status,
    rating: row.rating ?? undefined,
    watchedAt: row.watched_at ?? undefined,
    startedAt: row.started_at ?? undefined,
    finishedAt: row.finished_at ?? undefined,
    dateAdded: row.created_at,
  })) as TrackedItem[];
}

export async function getFriendLibraryItem(
  friendId: string,
  mediaType: 'movie' | 'tv' | 'game',
  externalId: number
): Promise<TrackedItem | null> {
  if (!supabase) return null;
  const res = await supabase
    .from('library_items')
    .select('id,media_type,external_id,title,poster_path,status,rating,watched_at,started_at,finished_at,created_at')
    .eq('user_id', friendId)
    .eq('media_type', mediaType)
    .eq('external_id', externalId)
    .maybeSingle();
  if (res.error || !res.data) return null;
  const row = res.data as any;
  return {
    id: row.id,
    mediaType: row.media_type,
    externalId: row.external_id,
    title: row.title,
    posterPath: row.poster_path ?? undefined,
    status: row.status,
    rating: row.rating ?? undefined,
    watchedAt: row.watched_at ?? undefined,
    startedAt: row.started_at ?? undefined,
    finishedAt: row.finished_at ?? undefined,
    dateAdded: row.created_at,
  } as TrackedItem;
}

export async function getFriendsRatingsForItem(
  mediaType: 'movie' | 'tv' | 'game',
  externalId: number,
  limit = 4
): Promise<FriendItemRating[]> {
  if (!supabase) return [];
  const userId = await getCurrentUserId();
  if (!userId) return [];
  const friendIds = await getAcceptedFriendIds(userId);
  if (friendIds.length === 0) return [];

  const [itemsRes, profilesRes] = await Promise.all([
    supabase
      .from('library_items')
      .select('user_id,rating,status')
      .in('user_id', friendIds)
      .eq('media_type', mediaType)
      .eq('external_id', externalId)
      .not('rating', 'is', null),
    supabase.from('profiles').select('id,username,display_name').in('id', friendIds),
  ]);

  if (itemsRes.error) {
    console.warn('[social] getFriendsRatingsForItem items failed:', itemsRes.error.message);
    return [];
  }

  const nameById = new Map(
    ((profilesRes.data ?? []) as FriendProfile[]).map((profile) => [
      profile.id,
      profile.display_name || profile.username || 'Amigo/a',
    ])
  );

  const mapped = (itemsRes.data ?? [])
    .map((row: any) => ({
      friendId: row.user_id as string,
      friendName: nameById.get(row.user_id) || 'Amigo/a',
      rating: Number(row.rating),
      status: row.status as string,
    }))
    .filter((row) => !Number.isNaN(row.rating))
    .sort((a, b) => b.rating - a.rating)
    .slice(0, limit);

  return mapped;
}

export async function getFriendsActivity(limit = 12): Promise<FriendActivityItem[]> {
  if (!supabase) return [];
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const friendIds = await getAcceptedFriendIds(userId);
  if (friendIds.length === 0) return [];

  const profilesRes = await supabase
    .from('profiles')
    .select('id,username,display_name')
    .in('id', friendIds);
  const profiles = (profilesRes.data ?? []) as FriendProfile[];
  const nameById = new Map(
    profiles.map((profile) => [profile.id, profile.display_name || profile.username || 'Amiga/o'])
  );

  const itemsRes = await supabase
    .from('library_items')
    .select('id,user_id,title,external_id,media_type,status,watched_at,started_at,finished_at,created_at')
    .in('user_id', friendIds)
    .order('created_at', { ascending: false })
    .limit(limit * 4);

  if (itemsRes.error) {
    console.warn('[social] getFriendsActivity items query failed:', itemsRes.error.message);
    return [];
  }

  const mapped = (itemsRes.data ?? []).map((row: any) => ({
    id: row.id as string,
    friendId: row.user_id as string,
    friendName: nameById.get(row.user_id as string) ?? 'Amiga/o',
    title: row.title as string,
    externalId: Number(row.external_id),
    mediaType: row.media_type as 'movie' | 'tv' | 'game',
    status: (row.status as string) || 'planned',
    activityDate:
      (row.finished_at as string | null) ||
      (row.watched_at as string | null) ||
      (row.started_at as string | null) ||
      (row.created_at as string),
  }));

  return mapped.slice(0, limit);
}
