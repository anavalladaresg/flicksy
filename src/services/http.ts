/**
 * Cliente HTTP centralizado con Axios
 * Maneja interceptores, errores y configuración común
 */

import axios, { AxiosInstance } from 'axios';

// Valores por defecto para APIs
const TMDB_API_KEY = process.env.EXPO_PUBLIC_TMDB_API_KEY || '';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

const IGDB_CLIENT_ID = process.env.EXPO_PUBLIC_IGDB_CLIENT_ID || '';
const IGDB_ACCESS_TOKEN = process.env.EXPO_PUBLIC_IGDB_ACCESS_TOKEN || '';
const isWebRuntime = typeof window !== 'undefined';
const isLocalWebRuntime =
  isWebRuntime && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const IGDB_LOCAL_PROXY_URL = process.env.EXPO_PUBLIC_IGDB_LOCAL_PROXY_URL || 'http://127.0.0.1:8787/api/igdb';
const IGDB_WEB_PROXY_URL = (
  isLocalWebRuntime
    ? IGDB_LOCAL_PROXY_URL
    : process.env.EXPO_PUBLIC_IGDB_PROXY_URL || '/api/igdb'
).replace(/\/$/, '');
const IGDB_BASE_URL = isWebRuntime ? IGDB_WEB_PROXY_URL : 'https://api.igdb.com/v4';
const DEBUG_IGDB = process.env.EXPO_PUBLIC_DEBUG_IGDB === 'true';

// ============= TMDB HTTP CLIENT =============
export const tmdbHttp: AxiosInstance = axios.create({
  baseURL: TMDB_BASE_URL,
  timeout: 10000,
  params: {
    language: 'es-ES',
  },
});

// ============= IGDB HTTP CLIENT =============
export const igdbHttp: AxiosInstance = axios.create({
  baseURL: IGDB_BASE_URL,
  timeout: 10000,
});

// ============= REQUEST INTERCEPTORS =============
tmdbHttp.interceptors.request.use((config) => {
  config.params = {
    ...config.params,
    api_key: TMDB_API_KEY,
  };
  return config;
});

igdbHttp.interceptors.request.use((config) => {
  // Web calls go through the Vercel proxy, which injects IGDB credentials server-side.
  if (isWebRuntime) {
    // Fallback robusto para proxies que no resuelven bien rutas catch-all:
    // enviamos el endpoint también en query (?path=games), en lugar de depender solo de /api/igdb/games.
    const rawUrl = String(config.url || '');
    const endpoint = rawUrl.replace(/^\/+/, '').split('?')[0];
    if (endpoint) {
      config.url = '/';
      config.params = {
        ...(config.params || {}),
        path: endpoint,
      };
    }

    if (DEBUG_IGDB) {
      console.log('[IGDB][web][request]', {
        baseURL: config.baseURL,
        originalEndpoint: endpoint || '(empty)',
        finalUrl: config.url,
        params: config.params,
      });
    }
  } else {
    config.headers = {
      ...config.headers,
      'Client-ID': IGDB_CLIENT_ID,
      Authorization: `Bearer ${IGDB_ACCESS_TOKEN}`,
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    };
  }
  return config;
});

// ============= RESPONSE ERROR HANDLER =============
function handleError(error: unknown) {
  if (axios.isAxiosError(error)) {
    const message = (error.response?.data as any)?.status_message || error.message;
    return Promise.reject(new Error(message));
  }
  return Promise.reject(error);
}

tmdbHttp.interceptors.response.use((response) => response, handleError);
igdbHttp.interceptors.response.use((response) => response, handleError);

if (DEBUG_IGDB) {
  igdbHttp.interceptors.response.use(
    (response) => {
      console.log('[IGDB][response]', {
        status: response.status,
        requestUrl: response.config?.baseURL + String(response.config?.url || ''),
        requestParams: response.config?.params,
      });
      return response;
    },
    (error) => {
      console.log('[IGDB][response][error]', {
        status: error?.response?.status,
        data: error?.response?.data,
        requestUrl: error?.config?.baseURL + String(error?.config?.url || ''),
        requestParams: error?.config?.params,
      });
      return Promise.reject(error);
    }
  );
}
