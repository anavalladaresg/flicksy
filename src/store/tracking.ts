/**
 * Store global para items rastreados
 * Gestiona el estado de películas, series y videojuegos guardados localmente
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { STORAGE_KEYS } from '../constants/config';
import { MediaType, TrackedItem } from '../types';

export interface TrackingState {
  items: TrackedItem[];
  
  // Actions
  addItem: (item: Omit<TrackedItem, 'id' | 'dateAdded'>) => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, updates: Partial<TrackedItem>) => void;
  getItemsByType: (type: MediaType) => TrackedItem[];
  getItem: (id: string) => TrackedItem | undefined;
  clearAll: () => void;
}

export const useTrackingStore = create<TrackingState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) =>
        set((state) => ({
          items: state.items.some(
            (existing) =>
              existing.externalId === item.externalId && existing.mediaType === item.mediaType
          )
            ? state.items
            : [
                ...state.items,
                {
                  ...item,
                  id: `${item.mediaType}-${item.externalId}-${Date.now()}`,
                  dateAdded: new Date().toISOString(),
                },
              ],
        })),

      removeItem: (id) =>
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        })),

      updateItem: (id, updates) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, ...updates } : item
          ),
        })),

      getItemsByType: (type) => {
        const state = get();
        return state.items.filter((item) => item.mediaType === type);
      },

      getItem: (id) => {
        const state = get();
        return state.items.find((item) => item.id === id);
      },

      clearAll: () =>
        set(() => ({
          items: [],
        })),
    }),
    {
      name: STORAGE_KEYS.TRACKED_ITEMS,
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// Selectors para optimización de renders
export const useTrackedItems = () =>
  useTrackingStore((state) => state.items);

export const useTrackedMovies = () =>
  useTrackingStore((state) => state.getItemsByType('movie'));

export const useTrackedTV = () =>
  useTrackingStore((state) => state.getItemsByType('tv'));

export const useTrackedGames = () =>
  useTrackingStore((state) => state.getItemsByType('game'));
