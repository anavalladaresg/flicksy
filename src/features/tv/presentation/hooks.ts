/**
 * Custom hooks para series TV con React Query
 * Presentation layer: Manejo de datos y estado
 */

import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { CACHE_TIMES } from '../../../constants/config';
import { PaginatedResponse, SearchParams, TVShow } from '../../../types';
import { tvRepository } from '../data/repositories';

export const usePopularTVShows = (page: number = 1): UseQueryResult<PaginatedResponse<TVShow>> => {
  return useQuery({
    queryKey: ['tv', 'popular', page],
    queryFn: () => tvRepository.getPopularTVShows(page),
    staleTime: CACHE_TIMES.POPULAR,
    gcTime: CACHE_TIMES.POPULAR * 2,
  });
};

export const useSearchTVShows = (
  params: SearchParams,
  enabled: boolean = true
): UseQueryResult<PaginatedResponse<TVShow>> => {
  return useQuery({
    queryKey: ['tv', 'search', params.query, params.page],
    queryFn: () => tvRepository.searchTVShows(params),
    staleTime: CACHE_TIMES.SEARCH,
    gcTime: CACHE_TIMES.SEARCH * 2,
    enabled,
  });
};

export const useTVShowDetails = (id: number): UseQueryResult<TVShow> => {
  return useQuery({
    queryKey: ['tv', 'details', id],
    queryFn: () => tvRepository.getTVShowDetails(id),
    staleTime: CACHE_TIMES.DETAIL,
    gcTime: CACHE_TIMES.DETAIL * 2,
  });
};
