/**
 * Tipos globales de la aplicación
 * Centraliza todos los tipos utilizados en features y componentes
 */

// ============= PELÍCULAS =============
export interface Movie {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  runtime?: number;
  genres?: Genre[];
  production_companies?: ProductionCompany[];
}

export interface MovieResponse {
  results: Movie[];
  page: number;
  total_pages: number;
  total_results: number;
}

// ============= SERIES DE TV =============
export interface TVShow {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  vote_average: number;
  number_of_seasons?: number;
  number_of_episodes?: number;
  genres?: Genre[];
}

export interface TVShowResponse {
  results: TVShow[];
  page: number;
  total_pages: number;
  total_results: number;
}

// ============= VIDEOJUEGOS =============
export interface Game {
  id: number;
  name: string;
  summary?: string;
  description?: string;
  cover?: Cover;
  release_dates?: ReleaseDate[];
  rating?: number;
  genres?: GameGenre[];
  platforms?: Platform[];
  storyline?: string;
}

export interface Cover {
  id: number;
  url?: string;
  image_id?: string;
  width?: number;
  height?: number;
}

export interface ReleaseDate {
  id: number;
  date: number;
  platform: { id: number; name: string };
  region: number;
}

export interface GameGenre {
  id: number;
  name: string;
}

export interface Platform {
  id: number;
  name: string;
  abbreviation?: string;
}

// ============= COMUNES =============
export interface Genre {
  id: number;
  name: string;
}

export interface ProductionCompany {
  id: number;
  name: string;
  logo_path: string | null;
}

// ============= TRACKING =============
export type MediaType = 'movie' | 'tv' | 'game';

export interface TrackedItem {
  id: string; // UUID o similar
  externalId: number;
  mediaType: MediaType;
  title: string;
  posterPath?: string;
  dateAdded: string;
  rating?: number;
  notes?: string;
  watchedAt?: string; // Para películas
  startedAt?: string; // Para series/juegos
  finishedAt?: string; // Para series/juegos
  status: 'watching' | 'completed' | 'planned' | 'dropped' | 'playing';
}

// ============= ERRORES =============
export interface ApiError {
  code: string;
  message: string;
  status?: number;
  originalError?: Error;
}

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status?: number,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// ============= PAGINACIÓN =============
export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  totalPages: number;
  totalResults: number;
}

// ============= QUERY PARAMS =============
export interface SearchParams {
  query: string;
  page?: number;
}

export interface DiscoverParams {
  page?: number;
  sort_by?: string;
  with_genres?: string;
}
