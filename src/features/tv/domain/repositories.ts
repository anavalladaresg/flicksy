/**
 * Servicio de series TV con TMDb API
 * Domain layer: Define la interfaz de casos de uso
 */

import { PaginatedResponse, SearchParams, TVShow } from '../../../types';

export interface ITVRepository {
  getPopularTVShows(page?: number): Promise<PaginatedResponse<TVShow>>;
  searchTVShows(params: SearchParams): Promise<PaginatedResponse<TVShow>>;
  getTVShowDetails(id: number): Promise<TVShow>;
}
