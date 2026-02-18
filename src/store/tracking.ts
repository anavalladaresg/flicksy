/**
 * Store global para items rastreados
 * Mantiene persistencia local y sincroniza con Supabase cuando está configurado.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getClerkInstance } from '@clerk/clerk-expo';
import { create } from 'zustand/index.js';
import { createJSONStorage, persist } from 'zustand/middleware.js';
import { STORAGE_KEYS } from '../constants/config';
import { supabase } from '../services/supabase';
import { MediaType, TrackedItem } from '../types';

type TrackedStatus = TrackedItem['status'];

interface RemoteTrackedRow {
  id: string;
  media_type: MediaType;
  external_id: number;
  title: string;
  poster_path: string | null;
  status: TrackedStatus;
  rating: number | null;
  watched_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  release_year?: number | null;
  genres?: string[] | null;
  platforms?: string[] | null;
  estimated_hours?: number | null;
  runtime_minutes?: number | null;
  seasons_at_add?: number | null;
}

type RemoteTrackedUpsert = {
  user_id: string;
  media_type: MediaType;
  external_id: number;
  title: string;
  poster_path?: string | null;
  status: TrackedStatus;
  rating?: number | null;
  watched_at?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  release_year?: number | null;
  genres?: string[] | null;
  platforms?: string[] | null;
  estimated_hours?: number | null;
  runtime_minutes?: number | null;
  seasons_at_add?: number | null;
};

function rowToTrackedItem(row: RemoteTrackedRow): TrackedItem {
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
    releaseYear: row.release_year ?? undefined,
    genres: row.genres ?? undefined,
    platforms: row.platforms ?? undefined,
    estimatedHours: row.estimated_hours ?? undefined,
    runtimeMinutes: row.runtime_minutes ?? undefined,
    seasonsAtAdd: row.seasons_at_add ?? undefined,
  };
}

function trackedItemToUpsert(item: TrackedItem, userId: string): RemoteTrackedUpsert {
  return {
    user_id: userId,
    media_type: item.mediaType,
    external_id: item.externalId,
    title: item.title,
    poster_path: item.posterPath ?? null,
    status: item.status,
    rating: item.rating ?? null,
    watched_at: item.watchedAt ?? null,
    started_at: item.startedAt ?? null,
    finished_at: item.finishedAt ?? null,
    release_year: item.releaseYear ?? null,
    genres: item.genres ?? null,
    platforms: item.platforms ?? null,
    estimated_hours: item.estimatedHours ?? null,
    runtime_minutes: item.runtimeMinutes ?? null,
    seasons_at_add: item.seasonsAtAdd ?? null,
  };
}

async function getUserId(): Promise<string | null> {
  const clerk = getClerkInstance();
  const clerkUserId = clerk.user?.id ?? null;
  if (clerkUserId) return clerkUserId;
  return null;
}

function minimalUpsertPayload(item: TrackedItem, userId: string) {
  return {
    user_id: userId,
    media_type: item.mediaType,
    external_id: item.externalId,
    title: item.title,
    poster_path: item.posterPath ?? null,
    status: item.status,
    rating: item.rating ?? null,
    watched_at: item.watchedAt ?? null,
    started_at: item.startedAt ?? null,
    finished_at: item.finishedAt ?? null,
  };
}

async function upsertRemoteItem(item: TrackedItem): Promise<void> {
  if (!supabase) return;
  const userId = await getUserId();
  if (!userId) {
    console.warn('[tracking] No authenticated user. Skipping remote upsert.');
    return;
  }

  const fullPayload = trackedItemToUpsert(item, userId);
  const { error } = await supabase
    .from('library_items')
    .upsert(fullPayload, { onConflict: 'user_id,media_type,external_id' });

  if (!error) return;

  console.warn('[tracking] Full upsert failed. Retrying with minimal payload:', error.message);
  const { error: fallbackError } = await supabase
    .from('library_items')
    .upsert(minimalUpsertPayload(item, userId), { onConflict: 'user_id,media_type,external_id' });

  if (fallbackError) {
    console.warn('[tracking] Minimal upsert failed:', fallbackError.message);
  }
}

async function deleteRemoteItem(item: TrackedItem): Promise<void> {
  if (!supabase) return;
  const userId = await getUserId();
  if (!userId) {
    console.warn('[tracking] No authenticated user. Skipping remote delete.');
    return;
  }

  const { error } = await supabase
    .from('library_items')
    .delete()
    .eq('user_id', userId)
    .eq('media_type', item.mediaType)
    .eq('external_id', item.externalId);

  if (error) {
    console.warn('[tracking] Delete failed:', error.message);
  }
}

async function clearRemoteItems(): Promise<void> {
  if (!supabase) return;
  const userId = await getUserId();
  if (!userId) {
    console.warn('[tracking] No authenticated user. Skipping remote clear.');
    return;
  }
  const { error } = await supabase.from('library_items').delete().eq('user_id', userId);
  if (error) {
    console.warn('[tracking] Clear failed:', error.message);
  }
}

export interface TrackingState {
  items: TrackedItem[];
  remoteReady: boolean;

  // Actions
  addItem: (item: Omit<TrackedItem, 'id' | 'dateAdded'>) => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, updates: Partial<TrackedItem>) => void;
  getItemsByType: (type: MediaType) => TrackedItem[];
  getItem: (id: string) => TrackedItem | undefined;
  clearAll: () => void;
  bootstrapRemote: () => Promise<void>;
}

export const useTrackingStore = create<TrackingState>()(
  persist(
    (set, get) => ({
      items: [],
      remoteReady: false,

      addItem: (item) => {
        const newItem: TrackedItem = {
          ...item,
          id: `${item.mediaType}-${item.externalId}-${Date.now()}`,
          dateAdded: new Date().toISOString(),
        };

        set((state) => ({
          items: state.items.some(
            (existing) => existing.externalId === item.externalId && existing.mediaType === item.mediaType
          )
            ? state.items
            : [...state.items, newItem],
        }));

        void upsertRemoteItem(newItem);
      },

      removeItem: (id) => {
        const target = get().items.find((item) => item.id === id);
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        }));

        if (!target) return;
        void deleteRemoteItem(target);
      },

      updateItem: (id, updates) => {
        let updatedItem: TrackedItem | null = null;

        set((state) => ({
          items: state.items.map((item) => {
            if (item.id !== id) return item;
            updatedItem = { ...item, ...updates };
            return updatedItem;
          }),
        }));

        if (!updatedItem) return;
        void upsertRemoteItem(updatedItem);
      },

      getItemsByType: (type) => {
        const state = get();
        return state.items.filter((item) => item.mediaType === type);
      },

      getItem: (id) => {
        const state = get();
        return state.items.find((item) => item.id === id);
      },

      clearAll: () => {
        set(() => ({
          items: [],
        }));
        void clearRemoteItems();
      },

      bootstrapRemote: async () => {
        if (!supabase) return;
        if (get().remoteReady) return;

        const userId = await getUserId();
        if (!userId) return;

        const fullQuery = await supabase
          .from('library_items')
          .select(
            'id,media_type,external_id,title,poster_path,status,rating,watched_at,started_at,finished_at,created_at,release_year,genres,platforms,estimated_hours,runtime_minutes,seasons_at_add'
          )
          .eq('user_id', userId);

        let remoteRows = (fullQuery.data ?? []) as RemoteTrackedRow[];
        if (fullQuery.error) {
          if (fullQuery.error.code === '42703') {
            const minimalQuery = await supabase
              .from('library_items')
              .select('id,media_type,external_id,title,poster_path,status,rating,watched_at,started_at,finished_at,created_at')
              .eq('user_id', userId);
            if (minimalQuery.error) {
              console.warn('[tracking] Remote bootstrap failed:', minimalQuery.error.message);
              return;
            }
            remoteRows = (minimalQuery.data ?? []) as RemoteTrackedRow[];
          } else {
            console.warn('[tracking] Remote bootstrap failed:', fullQuery.error.message);
            return;
          }
        }

        const remoteItems = remoteRows.map(rowToTrackedItem);

        set({
          items: remoteItems,
          remoteReady: true,
        });
      },
    }),
    {
      name: STORAGE_KEYS.TRACKED_ITEMS,
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        void state.bootstrapRemote();
      },
    }
  )
);

// Selectors para optimización de renders
export const useTrackedItems = () => useTrackingStore((state) => state.items);

export const useTrackedMovies = () => useTrackingStore((state) => state.getItemsByType('movie'));

export const useTrackedTV = () => useTrackingStore((state) => state.getItemsByType('tv'));

export const useTrackedGames = () => useTrackingStore((state) => state.getItemsByType('game'));
