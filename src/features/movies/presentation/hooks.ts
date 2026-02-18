/**
 * Custom hooks para películas con React Query
 * Presentation layer: Manejo de datos y estado
 */

import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { CACHE_TIMES } from '../../../constants/config';
import { Movie, PaginatedResponse, SearchParams } from '../../../types';
import { movieRepository } from '../data/repositories';
import { MovieSortOption, Period } from '../domain/repositories';

export const usePopularMovies = (page: number = 1): UseQueryResult<PaginatedResponse<Movie>> => {
  return useQuery({
    queryKey: ['movies', 'popular', page],
    queryFn: () => movieRepository.getPopularMovies(page),
    staleTime: CACHE_TIMES.POPULAR,
    gcTime: CACHE_TIMES.POPULAR * 2,
  });
};

export const useSearchMovies = (
  params: SearchParams,
  enabled: boolean = true
): UseQueryResult<PaginatedResponse<Movie>> => {
  return useQuery({
    queryKey: ['movies', 'search', params.query, params.page],
    queryFn: () => movieRepository.searchMovies(params),
    staleTime: CACHE_TIMES.SEARCH,
    gcTime: CACHE_TIMES.SEARCH * 2,
    enabled,
  });
};

export const useMovieDetails = (id: number): UseQueryResult<Movie> => {
  return useQuery({
    queryKey: ['movies', 'details', id],
    queryFn: () => movieRepository.getMovieDetails(id),
    staleTime: CACHE_TIMES.DETAIL,
    gcTime: CACHE_TIMES.DETAIL * 2,
  });
};

export const useNewMovies = (period: Period): UseQueryResult<PaginatedResponse<Movie>> => {
  return useQuery({
    queryKey: ['movies', 'new', period],
    queryFn: () => movieRepository.getNewMovies(period),
    staleTime: CACHE_TIMES.POPULAR,
    gcTime: CACHE_TIMES.POPULAR * 2,
  });
};

export const useTrendingMovies = (period: Period): UseQueryResult<PaginatedResponse<Movie>> => {
  return useQuery({
    queryKey: ['movies', 'trending', period],
    queryFn: () => movieRepository.getTrendingMovies(period),
    staleTime: CACHE_TIMES.POPULAR,
    gcTime: CACHE_TIMES.POPULAR * 2,
  });
};

export const useMoviesBySort = (
  sortBy: MovieSortOption,
  page: number = 1,
  enabled: boolean = true
): UseQueryResult<PaginatedResponse<Movie>> => {
  return useQuery({
    queryKey: ['movies', 'sorted', sortBy, page],
    queryFn: () => movieRepository.getMoviesBySort(sortBy, page),
    staleTime: CACHE_TIMES.POPULAR,
    gcTime: CACHE_TIMES.POPULAR * 2,
    enabled,
  });
};
