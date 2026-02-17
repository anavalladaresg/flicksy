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
const IGDB_BASE_URL = 'https://api.igdb.com/v4';

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
  config.headers = {
    ...config.headers,
    'Client-ID': IGDB_CLIENT_ID,
    Authorization: `Bearer ${IGDB_ACCESS_TOKEN}`,
  };
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
