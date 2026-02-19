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
const isWebRuntime = typeof window !== 'undefined';
const IGDB_BACKOFF_MS = 120000;
let igdbUnavailableUntil = 0;

function emptyPage(page = 1): PaginatedResponse<Game> {
  return {
    data: [],
    page,
    totalPages: 1,
    totalResults: 0,
  };
}

function shouldSkipIgdbRequest(): boolean {
  return isWebRuntime && Date.now() < igdbUnavailableUntil;
}

function applyIgdbBackoff(error: unknown) {
  if (!isWebRuntime) return;
  const message = String((error as any)?.message || '').toLowerCase();
  if (message.includes('load failed') || message.includes('network error') || message.includes('failed to fetch')) {
    igdbUnavailableUntil = Date.now() + IGDB_BACKOFF_MS;
  }
}

function getUnixDateRange(period: Period): { start: number; end: number } {
  const end = Math.floor(Date.now() / 1000);
  const days = period === 'week' ? 7 : 30;
  const start = end - days * 24 * 60 * 60;
  return { start, end };
}

export class GameRepository implements IGameRepository {
  async getPopularGames(page: number = 1): Promise<PaginatedResponse<Game>> {
    if (shouldSkipIgdbRequest()) return emptyPage(page);
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
      applyIgdbBackoff(error);
      if (isWebRuntime) return emptyPage(page);
      throw handleApiError(error);
    }
  }

  async searchGames(query: string, page: number = 1): Promise<PaginatedResponse<Game>> {
    if (shouldSkipIgdbRequest()) return emptyPage(page);
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
      applyIgdbBackoff(error);
      if (isWebRuntime) return emptyPage(page);
      throw handleApiError(error);
    }
  }

  async getGamesBySort(
    sortBy: GameSortOption,
    page: number = 1
  ): Promise<PaginatedResponse<Game>> {
    if (shouldSkipIgdbRequest()) return emptyPage(page);
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
      applyIgdbBackoff(error);
      if (isWebRuntime) return emptyPage(page);
      throw handleApiError(error);
    }
  }

  async getNewGames(period: Period): Promise<PaginatedResponse<Game>> {
    if (shouldSkipIgdbRequest()) return emptyPage(1);
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
      applyIgdbBackoff(error);
      if (isWebRuntime) return emptyPage(1);
      throw handleApiError(error);
    }
  }

  async getTrendingGames(period: Period): Promise<PaginatedResponse<Game>> {
    if (shouldSkipIgdbRequest()) return emptyPage(1);
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
      applyIgdbBackoff(error);
      if (isWebRuntime) return emptyPage(1);
      throw handleApiError(error);
    }
  }

  async getGameDetails(id: number): Promise<Game> {
    if (shouldSkipIgdbRequest()) {
      throw handleApiError(new Error('Servicio de juegos no disponible temporalmente.'));
    }
    try {
      const response = await igdbHttp.post(
        '/games',
        `
          fields id,name,summary,cover.url,cover.image_id,rating,genres.name,
                  platforms.name,release_dates.date,storyline,
                  screenshots.image_id,screenshots.url,
                  involved_companies.developer,involved_companies.publisher,
                  involved_companies.company.name,involved_companies.company.id;
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
      applyIgdbBackoff(error);
      throw handleApiError(error);
    }
  }
}

// Singleton instance
export const gameRepository = new GameRepository();
