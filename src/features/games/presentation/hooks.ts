/**
 * Custom hooks para videojuegos con React Query
 * Presentation layer: Manejo de datos y estado
 */

import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { CACHE_TIMES } from '../../../constants/config';
import { Game, PaginatedResponse } from '../../../types';
import { gameRepository } from '../data/repositories';
import { GameSortOption, Period } from '../domain/repositories';

export const usePopularGames = (
  page: number = 1,
  enabled: boolean = true
): UseQueryResult<PaginatedResponse<Game>> => {
  return useQuery({
    queryKey: ['games', 'popular', page],
    queryFn: () => gameRepository.getPopularGames(page),
    staleTime: CACHE_TIMES.POPULAR,
    gcTime: CACHE_TIMES.POPULAR * 2,
    enabled,
  });
};

export const useSearchGames = (
  query: string,
  page: number = 1,
  enabled: boolean = true
): UseQueryResult<PaginatedResponse<Game>> => {
  return useQuery({
    queryKey: ['games', 'search', query, page],
    queryFn: () => gameRepository.searchGames(query, page),
    staleTime: CACHE_TIMES.SEARCH,
    gcTime: CACHE_TIMES.SEARCH * 2,
    enabled: enabled && query.length > 0,
  });
};

export const useGameDetails = (id: number): UseQueryResult<Game> => {
  return useQuery({
    queryKey: ['games', 'details', id],
    queryFn: () => gameRepository.getGameDetails(id),
    staleTime: CACHE_TIMES.DETAIL,
    gcTime: CACHE_TIMES.DETAIL * 2,
    enabled: Number.isFinite(id) && id > 0,
  });
};

export const useNewGames = (
  period: Period,
  enabled: boolean = true
): UseQueryResult<PaginatedResponse<Game>> => {
  return useQuery({
    queryKey: ['games', 'new', period],
    queryFn: () => gameRepository.getNewGames(period),
    staleTime: CACHE_TIMES.POPULAR,
    gcTime: CACHE_TIMES.POPULAR * 2,
    enabled,
  });
};

export const useTrendingGames = (
  period: Period,
  enabled: boolean = true
): UseQueryResult<PaginatedResponse<Game>> => {
  return useQuery({
    queryKey: ['games', 'trending', period],
    queryFn: () => gameRepository.getTrendingGames(period),
    staleTime: CACHE_TIMES.POPULAR,
    gcTime: CACHE_TIMES.POPULAR * 2,
    enabled,
  });
};

export const useGamesBySort = (
  sortBy: GameSortOption,
  page: number = 1,
  enabled: boolean = true
): UseQueryResult<PaginatedResponse<Game>> => {
  return useQuery({
    queryKey: ['games', 'sorted', sortBy, page],
    queryFn: () => gameRepository.getGamesBySort(sortBy, page),
    staleTime: CACHE_TIMES.POPULAR,
    gcTime: CACHE_TIMES.POPULAR * 2,
    enabled,
  });
};
