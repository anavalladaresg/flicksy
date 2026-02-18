/**
 * Servicio de videojuegos con IGDB API
 * Domain layer: Define la interfaz de casos de uso
 */

import { Game, PaginatedResponse } from '../../../types';

export type Period = 'week' | 'month';
export type GameSortOption = 'rating_count.desc' | 'rating.desc' | 'first_release_date.desc';

export interface IGameRepository {
  getPopularGames(page?: number): Promise<PaginatedResponse<Game>>;
  getGamesBySort(sortBy: GameSortOption, page?: number): Promise<PaginatedResponse<Game>>;
  getNewGames(period: Period): Promise<PaginatedResponse<Game>>;
  getTrendingGames(period: Period): Promise<PaginatedResponse<Game>>;
  searchGames(query: string, page?: number): Promise<PaginatedResponse<Game>>;
  getGameDetails(id: number): Promise<Game>;
}
