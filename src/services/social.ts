import { supabase } from './supabase';
import type { TrackedItem } from '../types';
import { getClerkInstance } from '@clerk/clerk-expo';

export interface FriendProfile {
  id: string;
  username: string;
  display_name?: string | null;
  avatar_url?: string | null;
}

const PROFILE_SELECT_WITH_AVATAR = 'id,username,display_name,avatar_url';
const PROFILE_SELECT_BASE = 'id,username,display_name';
let profilesAvatarColumnSupported: boolean | null = null;
let avatarColumnProbePromise: Promise<boolean> | null = null;

function isMissingAvatarColumnError(error: any): boolean {
  const raw = String(error?.message || error?.details || '').toLowerCase();
  return raw.includes('avatar_url') && (raw.includes('column') || raw.includes('schema cache'));
}

async function hasProfilesAvatarColumn(): Promise<boolean> {
  if (!supabase) return false;
  if (profilesAvatarColumnSupported === true) return true;
  if (avatarColumnProbePromise) return avatarColumnProbePromise;

  avatarColumnProbePromise = (async () => {
    const probe = await supabase.from('profiles').select('avatar_url').limit(1);
    if (probe.error && isMissingAvatarColumnError(probe.error)) {
      profilesAvatarColumnSupported = false;
    } else {
      profilesAvatarColumnSupported = true;
    }
    return profilesAvatarColumnSupported;
  })();

  const supported = await avatarColumnProbePromise;
  avatarColumnProbePromise = null;
  return supported;
}

function normalizeProfileRow(row: any): FriendProfile {
  return {
    id: row.id,
    username: row.username,
    display_name: row.display_name,
    avatar_url: row.avatar_url ?? null,
  };
}

async function queryProfilesByIds(ids: string[]): Promise<FriendProfile[]> {
  if (!supabase || ids.length === 0) return [];
  if (await hasProfilesAvatarColumn()) {
    const withAvatar = await supabase.from('profiles').select(PROFILE_SELECT_WITH_AVATAR).in('id', ids);
    if (!withAvatar.error) return ((withAvatar.data ?? []) as any[]).map(normalizeProfileRow);
    if (isMissingAvatarColumnError(withAvatar.error)) profilesAvatarColumnSupported = false;
  }
  const base = await supabase.from('profiles').select(PROFILE_SELECT_BASE).in('id', ids);
  if (base.error) return [];
  return ((base.data ?? []) as any[]).map(normalizeProfileRow);
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

export interface FriendCompatibility {
  friendId: string;
  compatibility: number;
  sharedItems: number;
  sharedRatedItems: number;
}

async function getCurrentUserId(): Promise<string | null> {
  const clerk = getClerkInstance();
  const userId = clerk.user?.id ?? null;
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

export async function syncOwnProfile(
  username: string,
  options?: {
    displayName?: string;
    fallbackAvatarUrl?: string | null;
    overwriteUsername?: boolean;
  }
): Promise<void> {
  if (!supabase) return;
  const userId = await getCurrentUserId();
  if (!userId) return;
  const normalized = normalizeUsername(username);
  if (!normalized) return;

  const currentProfileRes = await supabase
    .from('profiles')
    .select('username,avatar_url')
    .eq('id', userId)
    .maybeSingle();

  const supportsAvatar = await hasProfilesAvatarColumn();
  let avatarToKeep: string | null = null;
  if (supportsAvatar && currentProfileRes.error && isMissingAvatarColumnError(currentProfileRes.error)) {
    profilesAvatarColumnSupported = false;
  } else {
    const currentAvatar = (currentProfileRes.data as any)?.avatar_url ?? null;
    avatarToKeep = currentAvatar || options?.fallbackAvatarUrl || null;
  }

  const existingUsername = normalizeUsername((currentProfileRes.data as any)?.username ?? '');
  const usernameToPersist =
    options?.overwriteUsername || !existingUsername ? normalized : existingUsername;

  const basePayload: any = {
    id: userId,
    username: usernameToPersist,
    display_name: options?.displayName?.trim() || username.trim(),
    updated_at: new Date().toISOString(),
  };
  const withAvatarPayload = { ...basePayload, avatar_url: avatarToKeep };
  const firstTry = await supabase.from('profiles').upsert(
    profilesAvatarColumnSupported ? withAvatarPayload : basePayload,
    { onConflict: 'id' }
  );
  if (firstTry.error && isMissingAvatarColumnError(firstTry.error)) {
    profilesAvatarColumnSupported = false;
    const fallbackTry = await supabase.from('profiles').upsert(basePayload, { onConflict: 'id' });
    if (fallbackTry.error) {
      console.warn('[social] syncOwnProfile failed:', fallbackTry.error.message);
      return;
    }
    return;
  }
  if (firstTry.error) {
    console.warn('[social] syncOwnProfile failed:', firstTry.error.message);
    return;
  }
}

export async function getOwnProfile(): Promise<FriendProfile | null> {
  if (!supabase) return null;
  const userId = await getCurrentUserId();
  if (!userId) return null;
  if (await hasProfilesAvatarColumn()) {
    const withAvatar = await supabase
      .from('profiles')
      .select(PROFILE_SELECT_WITH_AVATAR)
      .eq('id', userId)
      .maybeSingle();
    if (!withAvatar.error && withAvatar.data) return normalizeProfileRow(withAvatar.data);
    if (withAvatar.error && isMissingAvatarColumnError(withAvatar.error)) {
      profilesAvatarColumnSupported = false;
    }
  }
  const base = await supabase
    .from('profiles')
    .select(PROFILE_SELECT_BASE)
    .eq('id', userId)
    .maybeSingle();
  if (base.error || !base.data) return null;
  return normalizeProfileRow(base.data);
}

export async function updateOwnAvatar(avatarUrl: string | null): Promise<{ ok: boolean; message: string }> {
  if (!supabase) return { ok: false, message: 'Supabase no configurado.' };
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, message: 'Sesión no disponible.' };
  if (!(await hasProfilesAvatarColumn())) {
    return { ok: false, message: 'Tu base de datos aún no soporta foto personalizada.' };
  }
  const res = await supabase
    .from('profiles')
    .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() } as any)
    .eq('id', userId);
  if (res.error) {
    if (isMissingAvatarColumnError(res.error)) {
      profilesAvatarColumnSupported = false;
      return { ok: false, message: 'Tu base de datos aún no soporta foto personalizada.' };
    }
    return { ok: false, message: 'No se pudo guardar la foto de perfil.' };
  }
  return { ok: true, message: 'Foto de perfil actualizada.' };
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

  let data: any[] = [];
  if (await hasProfilesAvatarColumn()) {
    const withAvatar = await supabase
      .from('profiles')
      .select(PROFILE_SELECT_WITH_AVATAR)
      .ilike('username', `%${normalized}%`)
      .limit(15);
    if (!withAvatar.error) {
      data = withAvatar.data ?? [];
    } else if (isMissingAvatarColumnError(withAvatar.error)) {
      profilesAvatarColumnSupported = false;
    }
  }
  if (data.length === 0) {
    const base = await supabase
      .from('profiles')
      .select(PROFILE_SELECT_BASE)
      .ilike('username', `%${normalized}%`)
      .limit(15);
    if (base.error) {
      console.warn('[social] searchProfilesByUsername failed:', base.error.message);
      return [];
    }
    data = base.data ?? [];
  }

  // unique by username just in case table constraint is missing
  const dedup = new Map<string, FriendProfile>();
  (data as any[])
    .filter((profile) => profile.id !== userId)
    .forEach((profile) => {
      const normalizedRow = normalizeProfileRow(profile);
      if (!dedup.has(normalizedRow.username)) dedup.set(normalizedRow.username, normalizedRow);
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

  const recipientProfileRes = await supabase.from('profiles').select('*').eq('id', toUserId).maybeSingle();
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

  return { ok: true, message: `Solicitud enviada a ${recipientName}.` };
}

export async function getOutgoingFriendRequestIds(): Promise<string[]> {
  if (!supabase) return [];
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('friend_requests')
    .select('to_user_id,status')
    .eq('from_user_id', userId)
    .in('status', ['pending', 'accepted']);

  if (error) {
    console.warn('[social] getOutgoingFriendRequestIds failed:', error.message);
    return [];
  }

  return Array.from(
    new Set(
      (data ?? [])
        .map((row: any) => row.to_user_id as string | undefined)
        .filter((id): id is string => Boolean(id))
    )
  );
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
  const profiles = await queryProfilesByIds(fromIds);
  const map = new Map(profiles.map((p) => [p.id, p as FriendProfile]));
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
  return queryProfilesByIds(friendIds);
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
    queryProfilesByIds(friendIds),
  ]);

  if (itemsRes.error) {
    console.warn('[social] getFriendsRatingsForItem items failed:', itemsRes.error.message);
    return [];
  }

  const nameById = new Map(
    (profilesRes as FriendProfile[]).map((profile) => [
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

  const profiles = await queryProfilesByIds(friendIds);
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

function normalizeCompatibilityRating(value: unknown): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  const normalized = value > 10 ? value / 10 : value;
  return Math.max(0, Math.min(10, normalized));
}

function normalizeCompatibilityStatus(value: unknown): 'planned' | 'in_progress' | 'completed' | 'dropped' | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'watching' || normalized === 'playing' || normalized === 'in_progress' || normalized === 'in-progress') {
    return 'in_progress';
  }
  if (normalized === 'completed' || normalized === 'watched' || normalized === 'played') {
    return 'completed';
  }
  if (normalized === 'planned' || normalized === 'plan_to_watch' || normalized === 'plan_to_play') {
    return 'planned';
  }
  if (normalized === 'dropped') {
    return 'dropped';
  }
  return null;
}

export async function getFriendsCompatibility(): Promise<Record<string, FriendCompatibility>> {
  if (!supabase) return {};
  const userId = await getCurrentUserId();
  if (!userId) return {};

  const friendIds = await getAcceptedFriendIds(userId);
  if (friendIds.length === 0) return {};

  const [ownItemsRes, friendsItemsRes] = await Promise.all([
    supabase
      .from('library_items')
      .select('external_id,media_type,rating,status')
      .eq('user_id', userId),
    supabase
      .from('library_items')
      .select('user_id,external_id,media_type,rating,status')
      .in('user_id', friendIds),
  ]);

  if (ownItemsRes.error || friendsItemsRes.error) {
    if (ownItemsRes.error) console.warn('[social] getFriendsCompatibility own items failed:', ownItemsRes.error.message);
    if (friendsItemsRes.error) console.warn('[social] getFriendsCompatibility friend items failed:', friendsItemsRes.error.message);
    return {};
  }

  const ownByKey = new Map<
    string,
    {
      rating: number | null;
      status: 'planned' | 'in_progress' | 'completed' | 'dropped' | null;
    }
  >();
  (ownItemsRes.data ?? []).forEach((row: any) => {
    ownByKey.set(`${row.media_type}:${row.external_id}`, {
      rating: normalizeCompatibilityRating(row.rating),
      status: normalizeCompatibilityStatus(row.status),
    });
  });
  const ownKeys = new Set(ownByKey.keys());

  const groupedByFriend = new Map<string, any[]>();
  (friendsItemsRes.data ?? []).forEach((row: any) => {
    const list = groupedByFriend.get(row.user_id) ?? [];
    list.push(row);
    groupedByFriend.set(row.user_id, list);
  });

  const result: Record<string, FriendCompatibility> = {};
  friendIds.forEach((friendId) => {
    const friendRows = groupedByFriend.get(friendId) ?? [];
    const friendKeys = new Set(friendRows.map((row) => `${row.media_type}:${row.external_id}`));
    let sharedItems = 0;
    let sharedRatedItems = 0;
    let ratingDiffSum = 0;
    let statusMatches = 0;
    let statusComparable = 0;

    friendRows.forEach((row) => {
      const own = ownByKey.get(`${row.media_type}:${row.external_id}`);
      if (!own) return;

      sharedItems += 1;

      const ownRating = own.rating;
      const friendRating = normalizeCompatibilityRating(row.rating);
      if (typeof ownRating === 'number' && typeof friendRating === 'number') {
        sharedRatedItems += 1;
        ratingDiffSum += Math.abs(ownRating - friendRating);
      }

      const friendStatus = normalizeCompatibilityStatus(row.status);
      if (own.status && friendStatus) {
        statusComparable += 1;
        if (own.status === friendStatus) statusMatches += 1;
      }
    });

    const overlapScore =
      sharedItems > 0
        ? (sharedItems / Math.max(1, Math.max(ownKeys.size, friendKeys.size))) * 100
        : 0;
    const ratingScore =
      sharedRatedItems > 0 ? Math.max(0, 100 - (ratingDiffSum / sharedRatedItems) * 12.5) : null;
    const statusScore = statusComparable > 0 ? (statusMatches / statusComparable) * 100 : null;

    let compatibility = 0;
    if (sharedItems > 0) {
      let weightedScore = overlapScore * 0.4;
      let totalWeight = 0.4;
      if (ratingScore !== null) {
        weightedScore += ratingScore * 0.45;
        totalWeight += 0.45;
      }
      if (statusScore !== null) {
        weightedScore += statusScore * 0.15;
        totalWeight += 0.15;
      }
      compatibility = weightedScore / totalWeight;
    }

    result[friendId] = {
      friendId,
      compatibility: Math.round(Math.max(0, Math.min(100, compatibility))),
      sharedItems,
      sharedRatedItems,
    };
  });

  return result;
}
