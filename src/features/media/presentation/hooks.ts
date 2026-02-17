import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { getGameDetail, getPopularGames } from '../../../services/api/igdbService';
import {
  getMovieDetail,
  getPopularMovies,
  getPopularSeries,
  getSeriesDetail,
} from '../../../services/api/tmdbService';
import { Game, Movie, Series } from '../domain/entities';

type PaginatedItems<T> = {
  items: T[];
  page: number;
  totalPages: number;
};

export function usePopularMoviesQuery() {
  return useInfiniteQuery<PaginatedItems<Movie>>({
    queryKey: ['movies', 'popular'],
    queryFn: ({ pageParam }: { pageParam: number }) => getPopularMovies(pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
  });
}

export function usePopularSeriesQuery() {
  return useInfiniteQuery<PaginatedItems<Series>>({
    queryKey: ['series', 'popular'],
    queryFn: ({ pageParam }: { pageParam: number }) => getPopularSeries(pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
  });
}

export function usePopularGamesQuery() {
  return useInfiniteQuery<PaginatedItems<Game>>({
    queryKey: ['games', 'popular'],
    queryFn: ({ pageParam }: { pageParam: number }) => getPopularGames(pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
  });
}

export function useMovieDetailQuery(id: number) {
  return useQuery({
    queryKey: ['movie', id],
    queryFn: () => getMovieDetail(id),
  });
}

export function useSeriesDetailQuery(id: number) {
  return useQuery({
    queryKey: ['series', id],
    queryFn: () => getSeriesDetail(id),
  });
}

export function useGameDetailQuery(id: number) {
  return useQuery({
    queryKey: ['game', id],
    queryFn: () => getGameDetail(id),
  });
}
