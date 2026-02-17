/**
 * Repositorio de videojuegos con IGDB API
 * Data layer: Implementación concreta
 * 
 * Nota: IGDB usa Apicalypse query language, no REST estándar
 */

import { handleApiError } from '../../../services/errors';
import { igdbHttp } from '../../../services/http';
import { Game, PaginatedResponse } from '../../../types';
import { IGameRepository } from '../domain/repositories';

const LIMIT_PER_PAGE = 20;

export class GameRepository implements IGameRepository {
  async getPopularGames(page: number = 1): Promise<PaginatedResponse<Game>> {
    try {
      const offset = (page - 1) * LIMIT_PER_PAGE;

      const response = await igdbHttp.post(
        '/games',
        `
          fields id,name,summary,cover.url,rating,genres.name,platforms.name,release_dates.date;
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
          fields id,name,summary,cover.url,rating,genres.name,platforms.name,release_dates.date;
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

  async getGameDetails(id: number): Promise<Game> {
    try {
      const response = await igdbHttp.post(
        '/games',
        `
          fields id,name,summary,description,cover.url,rating,genres.name,
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
