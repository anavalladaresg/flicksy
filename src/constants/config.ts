/**
 * Configuración de la aplicación
 * APIs, endpoints, y constantes globales
 */

// APIs
export const TMDB_API_KEY = process.env.EXPO_PUBLIC_TMDB_API_KEY || '';
export const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
export const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

export const IGDB_CLIENT_ID = process.env.EXPO_PUBLIC_IGDB_CLIENT_ID || '';
export const IGDB_ACCESS_TOKEN = process.env.EXPO_PUBLIC_IGDB_ACCESS_TOKEN || '';
export const IGDB_BASE_URL = 'https://api.igdb.com/v4';

// Query Cache Times (en milisegundos)
export const CACHE_TIMES = {
  POPULAR: 1000 * 60 * 5, // 5 minutos
  SEARCH: 1000 * 60 * 10, // 10 minutos
  DETAIL: 1000 * 60 * 30, // 30 minutos
} as const;

// Paginación
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
} as const;

// AsyncStorage Keys
export const STORAGE_KEYS = {
  TRACKED_ITEMS: '@flicksy:tracked_items',
  USER_PREFERENCES: '@flicksy:user_preferences',
  SEARCH_HISTORY: '@flicksy:search_history',
  APP_THEME: '@flicksy:app_theme',
} as const;

// Feature Flags
export const FEATURES = {
  ENABLE_OFFLINE_MODE: true,
  ENABLE_RECOMMENDATIONS: true,
  ENABLE_SOCIAL_SHARING: false,
} as const;
