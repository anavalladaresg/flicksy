/**
 * Repositorio de videojuegos con IGDB API
 * Data layer: Implementación concreta
 * 
 * Nota: IGDB usa Apicalypse query language, no REST estándar
 */

import { handleApiError } from '../../../services/errors';
import { igdbHttp } from '../../../services/http';
import { Game, PaginatedResponse } from '../../../types';
import { GameSortOption, IGameRepository, Period } from '../domain/repositories';

const LIMIT_PER_PAGE = 20;

function getUnixDateRange(period: Period): { start: number; end: number } {
  const end = Math.floor(Date.now() / 1000);
  const days = period === 'week' ? 7 : 30;
  const start = end - days * 24 * 60 * 60;
  return { start, end };
}

export class GameRepository implements IGameRepository {
  async getPopularGames(page: number = 1): Promise<PaginatedResponse<Game>> {
    try {
      const offset = (page - 1) * LIMIT_PER_PAGE;

      const response = await igdbHttp.post(
        '/games',
        `
          fields id,name,summary,cover.url,cover.image_id,rating,genres.name,platforms.name,release_dates.date;
          sort rating desc;
          limit ${LIMIT_PER_PAGE};
          offset ${offset};
          where rating != null;
        `,
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'text/plain',
          },
        }
      );

      return {
        data: response.data,
        page,
        totalPages: 50, // IGDB no proporciona total, asumimos un máximo
        totalResults: 1000,
      };
    } catch (error) {
      throw handleApiError(error);
    }
  }

  async searchGames(query: string, page: number = 1): Promise<PaginatedResponse<Game>> {
    try {
      const offset = (page - 1) * LIMIT_PER_PAGE;

      const response = await igdbHttp.post(
        '/games',
        `
          fields id,name,summary,cover.url,cover.image_id,rating,genres.name,platforms.name,release_dates.date;
          search "${query}";
          limit ${LIMIT_PER_PAGE};
          offset ${offset};
        `,
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'text/plain',
          },
        }
      );

      return {
        data: response.data,
        page,
        totalPages: 50,
        totalResults: response.data.length,
      };
    } catch (error) {
      throw handleApiError(error);
    }
  }

  async getGamesBySort(
    sortBy: GameSortOption,
    page: number = 1
  ): Promise<PaginatedResponse<Game>> {
    try {
      const offset = (page - 1) * LIMIT_PER_PAGE;
      const where =
        sortBy === 'first_release_date.desc'
          ? 'first_release_date != null'
          : sortBy === 'rating_count.desc'
            ? 'rating_count != null'
            : 'rating != null';
      const sortField = sortBy.replace('.desc', ' desc');

      const response = await igdbHttp.post(
        '/games',
        `
          fields id,name,summary,cover.url,cover.image_id,rating,rating_count,genres.name,platforms.name,release_dates.date,first_release_date;
          where ${where};
          sort ${sortField};
          limit ${LIMIT_PER_PAGE};
          offset ${offset};
        `,
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'text/plain',
          },
        }
      );

      return {
        data: response.data,
        page,
        totalPages: 50,
        totalResults: 1000,
      };
    } catch (error) {
      throw handleApiError(error);
    }
  }

  async getNewGames(period: Period): Promise<PaginatedResponse<Game>> {
    try {
      const { start, end } = getUnixDateRange(period);
      const response = await igdbHttp.post(
        '/games',
        `
          fields id,name,summary,cover.url,cover.image_id,rating,genres.name,platforms.name,release_dates.date,first_release_date;
          where first_release_date != null
            & first_release_date >= ${start}
            & first_release_date <= ${end};
          sort first_release_date desc;
          limit ${LIMIT_PER_PAGE};
        `,
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'text/plain',
          },
        }
      );

      return {
        data: response.data,
        page: 1,
        totalPages: 1,
        totalResults: response.data.length,
      };
    } catch (error) {
      throw handleApiError(error);
    }
  }

  async getTrendingGames(period: Period): Promise<PaginatedResponse<Game>> {
    try {
      const { start, end } = getUnixDateRange(period);
      const response = await igdbHttp.post(
        '/games',
        `
          fields id,name,summary,cover.url,cover.image_id,rating,rating_count,genres.name,platforms.name,release_dates.date,first_release_date;
          where first_release_date != null
            & first_release_date >= ${start}
            & first_release_date <= ${end}
            & rating_count != null;
          sort rating_count desc;
          limit ${LIMIT_PER_PAGE};
        `,
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'text/plain',
          },
        }
      );

      return {
        data: response.data,
        page: 1,
        totalPages: 1,
        totalResults: response.data.length,
      };
    } catch (error) {
      throw handleApiError(error);
    }
  }

  async getGameDetails(id: number): Promise<Game> {
    try {
      const response = await igdbHttp.post(
        '/games',
        `
          fields id,name,summary,cover.url,cover.image_id,rating,genres.name,
                  platforms.name,release_dates.date,storyline;
          where id = ${id};
        `,
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'text/plain',
          },
        }
      );

      if (response.data.length === 0) {
        throw new Error('Game not found');
      }

      return response.data[0];
    } catch (error) {
      throw handleApiError(error);
    }
  }
}

// Singleton instance
export const gameRepository = new GameRepository();
