/**
 * Repositorio de películas con TMDb API
 * Data layer: Implementación concreta de la interfaz
 */

import { handleApiError } from '../../../services/errors';
import { tmdbHttp } from '../../../services/http';
import { Movie, PaginatedResponse, SearchParams } from '../../../types';
import { IMovieRepository, MovieSortOption, Period } from '../domain/repositories';

function getDateRange(period: Period): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  const days = period === 'week' ? 7 : 30;
  start.setDate(end.getDate() - days);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

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

  async getMoviesBySort(
    sortBy: MovieSortOption,
    page: number = 1
  ): Promise<PaginatedResponse<Movie>> {
    try {
      const response = await tmdbHttp.get('/discover/movie', {
        params: {
          page,
          sort_by: sortBy,
          include_adult: false,
          include_video: false,
          vote_count_gte: sortBy === 'vote_average.desc' ? 150 : 20,
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

  async getNewMovies(period: Period): Promise<PaginatedResponse<Movie>> {
    try {
      const { start, end } = getDateRange(period);
      const response = await tmdbHttp.get('/discover/movie', {
        params: {
          page: 1,
          sort_by: 'primary_release_date.desc',
          'primary_release_date.gte': start,
          'primary_release_date.lte': end,
          include_adult: false,
          include_video: false,
          vote_count_gte: 10,
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

  async getTrendingMovies(period: Period): Promise<PaginatedResponse<Movie>> {
    try {
      let response;
      if (period === 'week') {
        response = await tmdbHttp.get('/trending/movie/week', {
          params: { page: 1 },
        });
      } else {
        const { start, end } = getDateRange(period);
        response = await tmdbHttp.get('/discover/movie', {
          params: {
            page: 1,
            sort_by: 'popularity.desc',
            'primary_release_date.gte': start,
            'primary_release_date.lte': end,
            include_adult: false,
            include_video: false,
            vote_count_gte: 50,
          },
        });
      }

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
          append_to_response: 'credits,videos,translations',
        },
      });

      const movie = response.data;
      const spanishTranslation = movie?.translations?.translations?.find(
        (translation: any) =>
          translation?.iso_639_1 === 'es' && translation?.data?.overview
      );

      if (spanishTranslation?.data) {
        return {
          ...movie,
          title: spanishTranslation.data.title || movie.title,
          overview: spanishTranslation.data.overview || movie.overview,
        };
      }

      return movie;
    } catch (error) {
      throw handleApiError(error);
    }
  }
}

// Singleton instance
export const movieRepository = new MovieRepository();
