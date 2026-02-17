/**
 * Servicio de videojuegos con IGDB API
 * Domain layer: Define la interfaz de casos de uso
 */

import { Game, PaginatedResponse } from '../../../types';

export interface IGameRepository {
  getPopularGames(page?: number): Promise<PaginatedResponse<Game>>;
  searchGames(query: string, page?: number): Promise<PaginatedResponse<Game>>;
  getGameDetails(id: number): Promise<Game>;
}
