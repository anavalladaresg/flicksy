/**
 * Servicio de series TV con TMDb API
 * Domain layer: Define la interfaz de casos de uso
 */

import { PaginatedResponse, SearchParams, TVShow } from '../../../types';

export type Period = 'week' | 'month';
export type TVSortOption =
  | 'popularity.desc'
  | 'vote_average.desc'
  | 'vote_count.desc'
  | 'first_air_date.desc';

export interface ITVRepository {
  getPopularTVShows(page?: number): Promise<PaginatedResponse<TVShow>>;
  getTVShowsBySort(sortBy: TVSortOption, page?: number): Promise<PaginatedResponse<TVShow>>;
  getNewTVShows(period: Period): Promise<PaginatedResponse<TVShow>>;
  getTrendingTVShows(period: Period): Promise<PaginatedResponse<TVShow>>;
  searchTVShows(params: SearchParams): Promise<PaginatedResponse<TVShow>>;
  getTVShowDetails(id: number): Promise<TVShow>;
}
