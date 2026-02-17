/**
 * Servicio de películas con TMDb API
 * Domain layer: Define la interfaz de casos de uso
 */

import { Movie, PaginatedResponse, SearchParams } from '../../../types';

export interface IMovieRepository {
  getPopularMovies(page?: number): Promise<PaginatedResponse<Movie>>;
  searchMovies(params: SearchParams): Promise<PaginatedResponse<Movie>>;
  getMovieDetails(id: number): Promise<Movie>;
}
