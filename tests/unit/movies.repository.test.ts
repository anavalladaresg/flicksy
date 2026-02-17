/**
 * Tests unitarios para el repositorio de películas
 */

import { MovieRepository } from '../../src/features/movies/data/repositories';

// Mock de tmdbHttp
jest.mock('../../src/services/http', () => ({
  tmdbHttp: {
    get: jest.fn(),
  },
}));

describe('MovieRepository', () => {
  let repository: MovieRepository;
  let mockGet: jest.Mock;

  beforeEach(() => {
    const { tmdbHttp } = require('../../src/services/http');
    mockGet = tmdbHttp.get;
    repository = new MovieRepository();
    jest.clearAllMocks();
  });

  describe('getPopularMovies', () => {
    it('debe retornar películas populares formateadas correctamente', async () => {
      const mockResponse = {
        data: {
          results: [
            {
              id: 1,
              title: 'Test Movie',
              overview: 'Test overview',
              poster_path: '/test.jpg',
              backdrop_path: '/backdrop.jpg',
              release_date: '2024-01-01',
              vote_average: 8.5,
            },
          ],
          page: 1,
          total_pages: 10,
          total_results: 100,
        },
      };

      mockGet.mockResolvedValueOnce(mockResponse);

      const result = await repository.getPopularMovies(1);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].title).toBe('Test Movie');
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(10);
      expect(result.totalResults).toBe(100);
    });

    it('debe manejar errores correctamente', async () => {
      mockGet.mockRejectedValueOnce(new Error('Network error'));

      await expect(repository.getPopularMovies(1)).rejects.toThrow();
    });
  });

  describe('searchMovies', () => {
    it('debe buscar películas con query', async () => {
      const mockResponse = {
        data: {
          results: [
            {
              id: 1,
              title: 'Inception',
              overview: 'A mind-bending thriller',
              poster_path: '/inception.jpg',
              release_date: '2010-07-16',
              vote_average: 8.8,
            },
          ],
          page: 1,
          total_pages: 1,
          total_results: 1,
        },
      };

      mockGet.mockResolvedValueOnce(mockResponse);

      const result = await repository.searchMovies({
        query: 'inception',
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].title).toBe('Inception');
      expect(mockGet).toHaveBeenCalledWith('/search/movie', {
        params: {
          query: 'inception',
          page: 1,
        },
      });
    });
  });

  describe('getMovieDetails', () => {
    it('debe retornar detalles completos de una película', async () => {
      const mockResponse = {
        data: {
          id: 1,
          title: 'Test Movie',
          overview: 'Test overview',
          poster_path: '/test.jpg',
          release_date: '2024-01-01',
          vote_average: 8.5,
          runtime: 120,
          genres: [
            { id: 1, name: 'Action' },
            { id: 2, name: 'Drama' },
          ],
        },
      };

      mockGet.mockResolvedValueOnce(mockResponse);

      const result = await repository.getMovieDetails(1);

      expect(result.title).toBe('Test Movie');
      expect(result.runtime).toBe(120);
      expect(result.genres).toHaveLength(2);
      expect(mockGet).toHaveBeenCalledWith('/movie/1', {
        params: {
          append_to_response: 'credits,videos',
        },
      });
    });
  });
});
