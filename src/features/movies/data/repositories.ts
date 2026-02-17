/**
 * Repositorio de películas con TMDb API
 * Data layer: Implementación concreta de la interfaz
 */

import { handleApiError } from '../../../services/errors';
import { tmdbHttp } from '../../../services/http';
import { Movie, PaginatedResponse, SearchParams } from '../../../types';
import { IMovieRepository } from '../domain/repositories';

export class MovieRepository implements IMovieRepository {
  async getPopularMovies(page: number = 1): Promise<PaginatedResponse<Movie>> {
    try {
      const response = await tmdbHttp.get('/movie/popular', {
        params: { page },
      });
      
      return {
        data: response.data.results,
        page: response.data.page,
        totalPages: response.data.total_pages,
        totalResults: response.data.total_results,
      };
    } catch (error) {
      throw handleApiError(error);
    }
  }

  async searchMovies(params: SearchParams): Promise<PaginatedResponse<Movie>> {
    try {
      const response = await tmdbHttp.get('/search/movie', {
        params: {
          query: params.query,
          page: params.page || 1,
        },
      });

      return {
        data: response.data.results,
        page: response.data.page,
        totalPages: response.data.total_pages,
        totalResults: response.data.total_results,
      };
    } catch (error) {
      throw handleApiError(error);
    }
  }

  async getMovieDetails(id: number): Promise<Movie> {
    try {
      const response = await tmdbHttp.get(`/movie/${id}`, {
        params: {
          append_to_response: 'credits,videos',
        },
      });

      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }
}

// Singleton instance
export const movieRepository = new MovieRepository();
