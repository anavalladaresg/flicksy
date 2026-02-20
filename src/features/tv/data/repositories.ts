/**
 * Repositorio de series TV con TMDb API
 * Data layer: Implementación concreta
 */

import { handleApiError } from '../../../services/errors';
import { tmdbHttp } from '../../../services/http';
import { PaginatedResponse, SearchParams, TVShow } from '../../../types';
import { ITVRepository, Period, TVSortOption } from '../domain/repositories';

const SPANISH_LANGUAGE = 'es-ES';

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

export class TVRepository implements ITVRepository {
  async getPopularTVShows(page: number = 1): Promise<PaginatedResponse<TVShow>> {
    try {
      const response = await tmdbHttp.get('/tv/popular', {
        params: { page, language: SPANISH_LANGUAGE },
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

  async searchTVShows(params: SearchParams): Promise<PaginatedResponse<TVShow>> {
    try {
      const response = await tmdbHttp.get('/search/tv', {
        params: {
          query: params.query,
          page: params.page || 1,
          language: SPANISH_LANGUAGE,
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

  async getTVShowsBySort(
    sortBy: TVSortOption,
    page: number = 1
  ): Promise<PaginatedResponse<TVShow>> {
    try {
      const response = await tmdbHttp.get('/discover/tv', {
        params: {
          page,
          sort_by: sortBy,
          include_adult: false,
          vote_count_gte: sortBy === 'vote_average.desc' ? 150 : 20,
          language: SPANISH_LANGUAGE,
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

  async getNewTVShows(period: Period): Promise<PaginatedResponse<TVShow>> {
    try {
      const { start, end } = getDateRange(period);
      const response = await tmdbHttp.get('/discover/tv', {
        params: {
          page: 1,
          sort_by: 'first_air_date.desc',
          'first_air_date.gte': start,
          'first_air_date.lte': end,
          include_adult: false,
          vote_count_gte: 10,
          language: SPANISH_LANGUAGE,
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

  async getTrendingTVShows(period: Period): Promise<PaginatedResponse<TVShow>> {
    try {
      let response;
      if (period === 'week') {
        response = await tmdbHttp.get('/trending/tv/week', {
          params: { page: 1, language: SPANISH_LANGUAGE },
        });
      } else {
        const { start, end } = getDateRange(period);
        response = await tmdbHttp.get('/discover/tv', {
          params: {
            page: 1,
            sort_by: 'popularity.desc',
            'first_air_date.gte': start,
            'first_air_date.lte': end,
            include_adult: false,
            vote_count_gte: 50,
            language: SPANISH_LANGUAGE,
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

  async getTVShowDetails(id: number): Promise<TVShow> {
    try {
      const response = await tmdbHttp.get(`/tv/${id}`, {
        params: {
          append_to_response: 'credits,videos,translations,watch/providers',
          language: SPANISH_LANGUAGE,
        },
      });

      const show = response.data;
      const spanishTranslation = show?.translations?.translations?.find(
        (translation: any) =>
          translation?.iso_639_1 === 'es' && translation?.data?.overview
      );

      if (spanishTranslation?.data) {
        return {
          ...show,
          name: spanishTranslation.data.name || show.name,
          overview: spanishTranslation.data.overview || show.overview,
        };
      }

      return show;
    } catch (error) {
      throw handleApiError(error);
    }
  }
}

// Singleton instance
export const tvRepository = new TVRepository();
