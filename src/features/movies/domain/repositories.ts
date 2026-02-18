/**
 * Servicio de películas con TMDb API
 * Domain layer: Define la interfaz de casos de uso
 */

import { Movie, PaginatedResponse, SearchParams } from '../../../types';

export type Period = 'week' | 'month';
export type MovieSortOption =
  | 'popularity.desc'
  | 'vote_average.desc'
  | 'vote_count.desc'
  | 'primary_release_date.desc';

export interface IMovieRepository {
  getPopularMovies(page?: number): Promise<PaginatedResponse<Movie>>;
  getMoviesBySort(sortBy: MovieSortOption, page?: number): Promise<PaginatedResponse<Movie>>;
  getNewMovies(period: Period): Promise<PaginatedResponse<Movie>>;
  getTrendingMovies(period: Period): Promise<PaginatedResponse<Movie>>;
  searchMovies(params: SearchParams): Promise<PaginatedResponse<Movie>>;
  getMovieDetails(id: number): Promise<Movie>;
}
