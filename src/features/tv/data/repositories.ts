/**
 * Repositorio de series TV con TMDb API
 * Data layer: Implementación concreta
 */

import { handleApiError } from '../../../services/errors';
import { tmdbHttp } from '../../../services/http';
import { PaginatedResponse, SearchParams, TVShow } from '../../../types';
import { ITVRepository } from '../domain/repositories';

export class TVRepository implements ITVRepository {
  async getPopularTVShows(page: number = 1): Promise<PaginatedResponse<TVShow>> {
    try {
      const response = await tmdbHttp.get('/tv/popular', {
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

  async searchTVShows(params: SearchParams): Promise<PaginatedResponse<TVShow>> {
    try {
      const response = await tmdbHttp.get('/search/tv', {
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

  async getTVShowDetails(id: number): Promise<TVShow> {
    try {
      const response = await tmdbHttp.get(`/tv/${id}`, {
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
export const tvRepository = new TVRepository();
