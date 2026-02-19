import { gameRepository } from '../features/games/data/repositories';
import { movieRepository } from '../features/movies/data/repositories';
import { tvRepository } from '../features/tv/data/repositories';
import type { Game, Movie, TVShow } from '../types';

export interface AvatarOption {
  id: string;
  label: string;
  imageUrl: string;
  source: 'movie' | 'tv' | 'game';
  externalId: number;
}

const TMDB_AVATAR_BASE = 'https://image.tmdb.org/t/p/w342';

const PINNED_MEDIA_AVATARS: AvatarOption[] = [
  {
    id: 'movie-597',
    label: 'Titanic',
    imageUrl: 'https://image.tmdb.org/t/p/w342/9xjZS2rlVxm8SFx8kPC3aIGCOYQ.jpg',
    source: 'movie',
    externalId: 597,
  },
  {
    id: 'movie-550',
    label: 'Fight Club',
    imageUrl: 'https://image.tmdb.org/t/p/w342/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg',
    source: 'movie',
    externalId: 550,
  },
  {
    id: 'tv-1399',
    label: 'Game of Thrones',
    imageUrl: 'https://image.tmdb.org/t/p/w342/1XS1oqL89opfnbLl8WnZY1O1uJx.jpg',
    source: 'tv',
    externalId: 1399,
  },
  {
    id: 'tv-1668',
    label: 'Friends',
    imageUrl: 'https://image.tmdb.org/t/p/w342/2koX1xLkpTQM4IZebYvKysFW1Nh.jpg',
    source: 'tv',
    externalId: 1668,
  },
];

function mapMovieToAvatar(movie: Movie): AvatarOption | null {
  if (!movie.poster_path) return null;
  return {
    id: `movie-${movie.id}`,
    label: movie.title,
    imageUrl: `${TMDB_AVATAR_BASE}${movie.poster_path}`,
    source: 'movie',
    externalId: movie.id,
  };
}

function mapTvToAvatar(show: TVShow): AvatarOption | null {
  if (!show.poster_path) return null;
  return {
    id: `tv-${show.id}`,
    label: show.name,
    imageUrl: `${TMDB_AVATAR_BASE}${show.poster_path}`,
    source: 'tv',
    externalId: show.id,
  };
}

function mapGameToAvatar(game?: Game | null): AvatarOption | null {
  if (!game) return null;
  const imageUrl = game.cover?.image_id
    ? `https://images.igdb.com/igdb/image/upload/t_cover_big_2x/${game.cover.image_id}.jpg`
    : game.cover?.url
      ? game.cover.url.startsWith('//')
        ? `https:${game.cover.url}`.replace('/t_thumb/', '/t_cover_big_2x/')
        : game.cover.url.replace('/t_thumb/', '/t_cover_big_2x/')
      : null;
  if (!imageUrl) return null;
  return {
    id: `game-${game.id}`,
    label: game.name,
    imageUrl,
    source: 'game',
    externalId: game.id,
  };
}

export async function getAvatarOptions(limit = 100): Promise<AvatarOption[]> {
  const dedup = new Map<string, AvatarOption>();
  PINNED_MEDIA_AVATARS.forEach((item) => dedup.set(item.id, item));

  const settle = await Promise.allSettled([
    movieRepository.getPopularMovies(1),
    movieRepository.getPopularMovies(2),
    tvRepository.getPopularTVShows(1),
    tvRepository.getPopularTVShows(2),
    gameRepository.getPopularGames(1),
  ]);

  const [moviePage1, moviePage2, tvPage1, tvPage2, gamePage1] = settle;

  if (moviePage1.status === 'fulfilled') {
    moviePage1.value.data
      .map((item) => mapMovieToAvatar(item))
      .filter(Boolean)
      .forEach((item) => dedup.set((item as AvatarOption).id, item as AvatarOption));
  }
  if (moviePage2.status === 'fulfilled') {
    moviePage2.value.data
      .map((item) => mapMovieToAvatar(item))
      .filter(Boolean)
      .forEach((item) => dedup.set((item as AvatarOption).id, item as AvatarOption));
  }
  if (tvPage1.status === 'fulfilled') {
    tvPage1.value.data
      .map((item) => mapTvToAvatar(item))
      .filter(Boolean)
      .forEach((item) => dedup.set((item as AvatarOption).id, item as AvatarOption));
  }
  if (tvPage2.status === 'fulfilled') {
    tvPage2.value.data
      .map((item) => mapTvToAvatar(item))
      .filter(Boolean)
      .forEach((item) => dedup.set((item as AvatarOption).id, item as AvatarOption));
  }
  if (gamePage1.status === 'fulfilled') {
    gamePage1.value.data
      .map((item) => mapGameToAvatar(item))
      .filter(Boolean)
      .forEach((item) => dedup.set((item as AvatarOption).id, item as AvatarOption));
  }

  return Array.from(dedup.values()).slice(0, limit);
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function containsAllWords(value: string, normalizedQuery: string): boolean {
  const words = normalizedQuery.split(/\s+/).filter(Boolean);
  const normalizedValue = normalizeText(value);
  return words.every((word) => normalizedValue.includes(word));
}

export async function searchAvatarOptions(query: string): Promise<AvatarOption[]> {
  const cleaned = query.trim();
  if (cleaned.length < 2) return [];
  const normalizedQuery = normalizeText(cleaned);
  const dedup = new Map<string, AvatarOption>();

  const settle = await Promise.allSettled([
    movieRepository.searchMovies({ query: cleaned, page: 1 }),
    movieRepository.searchMovies({ query: cleaned, page: 2 }),
    tvRepository.searchTVShows({ query: cleaned, page: 1 }),
    tvRepository.searchTVShows({ query: cleaned, page: 2 }),
    gameRepository.searchGames(cleaned, 1),
    gameRepository.searchGames(cleaned, 2),
  ]);

  const [moviePage1, moviePage2, tvPage1, tvPage2, gamePage1, gamePage2] = settle;

  if (moviePage1.status === 'fulfilled') {
    moviePage1.value.data
      .filter((item) => containsAllWords(item.title, normalizedQuery))
      .map((item) => mapMovieToAvatar(item))
      .filter(Boolean)
      .forEach((item) => dedup.set((item as AvatarOption).id, item as AvatarOption));
  }
  if (moviePage2.status === 'fulfilled') {
    moviePage2.value.data
      .filter((item) => containsAllWords(item.title, normalizedQuery))
      .map((item) => mapMovieToAvatar(item))
      .filter(Boolean)
      .forEach((item) => dedup.set((item as AvatarOption).id, item as AvatarOption));
  }
  if (tvPage1.status === 'fulfilled') {
    tvPage1.value.data
      .filter((item) => containsAllWords(item.name, normalizedQuery))
      .map((item) => mapTvToAvatar(item))
      .filter(Boolean)
      .forEach((item) => dedup.set((item as AvatarOption).id, item as AvatarOption));
  }
  if (tvPage2.status === 'fulfilled') {
    tvPage2.value.data
      .filter((item) => containsAllWords(item.name, normalizedQuery))
      .map((item) => mapTvToAvatar(item))
      .filter(Boolean)
      .forEach((item) => dedup.set((item as AvatarOption).id, item as AvatarOption));
  }
  if (gamePage1.status === 'fulfilled') {
    gamePage1.value.data
      .filter((item) => containsAllWords(item.name, normalizedQuery))
      .map((item) => mapGameToAvatar(item))
      .filter(Boolean)
      .forEach((item) => dedup.set((item as AvatarOption).id, item as AvatarOption));
  }
  if (gamePage2.status === 'fulfilled') {
    gamePage2.value.data
      .filter((item) => containsAllWords(item.name, normalizedQuery))
      .map((item) => mapGameToAvatar(item))
      .filter(Boolean)
      .forEach((item) => dedup.set((item as AvatarOption).id, item as AvatarOption));
  }

  return Array.from(dedup.values());
}
