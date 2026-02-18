import { TMDB_IMAGE_BASE_URL } from '@/src/constants/config';
import { usePopularGames } from '@/src/features/games/presentation/hooks';
import { usePopularMovies } from '@/src/features/movies/presentation/hooks';
import { usePopularTVShows } from '@/src/features/tv/presentation/hooks';
import { Game } from '@/src/types';
import React, { FC, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

interface GridMotionProps {
  gradientColor?: string;
}

function toGameImageUrl(game: Game): string | null {
  if (game.cover?.image_id) {
    return `https://images.igdb.com/igdb/image/upload/t_cover_big_2x/${game.cover.image_id}.jpg`;
  }

  if (!game.cover?.url) {
    return null;
  }

  const normalized = game.cover.url.startsWith('//')
    ? `https:${game.cover.url}`
    : game.cover.url.startsWith('http')
      ? game.cover.url
      : `https://${game.cover.url}`;

  return normalized.replace('/t_thumb/', '/t_cover_big_2x/');
}

function shuffle<T>(input: T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const ROWS = 6;
const CARD_RATIO = 2 / 3;
const CARD_HEIGHT = 240;
const GAP = 14;
const BASE_SPEED = 0.3;
const SPEED_STEP = 0.1;
const FALLBACK_POSTER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='480' viewBox='0 0 320 480'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0%25' stop-color='%230f172a'/%3E%3Cstop offset='100%25' stop-color='%23111827'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='320' height='480' fill='url(%23g)'/%3E%3C/svg%3E";

const GridMotionBackground: FC<GridMotionProps> = ({ gradientColor = '#0a7ea4' }) => {
  const moviesQuery = usePopularMovies(1);
  const tvQuery = usePopularTVShows(1);
  const gamesQuery = usePopularGames(1, Platform.OS === 'web');

  const [viewport, setViewport] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1440,
    height: typeof window !== 'undefined' ? window.innerHeight : 900,
  });

  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const onResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };

    onResize();
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const images = useMemo(() => {
    const fromMovies = (moviesQuery.data?.data ?? [])
      .filter((movie) => Boolean(movie.poster_path))
      .map((movie) => `${TMDB_IMAGE_BASE_URL}${movie.poster_path}`);

    const fromTV = (tvQuery.data?.data ?? [])
      .filter((show) => Boolean(show.poster_path))
      .map((show) => `${TMDB_IMAGE_BASE_URL}${show.poster_path}`);

    const fromGames = (gamesQuery.data?.data ?? [])
      .map((game) => toGameImageUrl(game))
      .filter((url): url is string => Boolean(url));

    return shuffle([...fromMovies, ...fromTV, ...fromGames]);
  }, [gamesQuery.data?.data, moviesQuery.data?.data, tvQuery.data?.data]);

  const cardWidth = Math.round(CARD_HEIGHT * CARD_RATIO);
  const visibleCols = Math.max(8, Math.ceil(viewport.width / (cardWidth + GAP)) + 2);
  const rowStride = visibleCols * (cardWidth + GAP);

  const rows = useMemo(() => {
    const fallbackCards = ['#0f172a', '#111827', '#1f2937', '#0b1220'];

    return Array.from({ length: ROWS }, (_, rowIndex) => {
      const source = images.length > 0 ? images : fallbackCards;
      const baseCards = Array.from({ length: visibleCols }, (_, colIndex) => {
        const pickIndex = (rowIndex * 11 + colIndex * 7) % source.length;
        return source[pickIndex];
      });

      return [...baseCards, ...baseCards];
    });
  }, [images, visibleCols]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const speeds = Array.from(
      { length: ROWS },
      (_, i) => (i % 2 === 0 ? 1 : -1) * (BASE_SPEED + i * SPEED_STEP)
    );
    const offsets = Array.from({ length: ROWS }, () => 0);
    let last = performance.now();
    let rafId = 0;

    const tick = () => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      for (let row = 0; row < ROWS; row += 1) {
        const el = rowRefs.current[row];
        if (!el) continue;

        offsets[row] += speeds[row] * dt * 60;
        if (offsets[row] > rowStride) offsets[row] -= rowStride;
        if (offsets[row] < -rowStride) offsets[row] += rowStride;

        el.style.transform = `translate3d(${offsets[row]}px, 0, 0)`;
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [rowStride]);

  if (Platform.OS !== 'web') {
    return null;
  }

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: '-18%',
          transform: 'rotate(-14deg) scale(1.08)',
          transformOrigin: 'center',
        }}
      >
        {rows.map((row, rowIndex) => {
          const top = rowIndex * (CARD_HEIGHT + GAP) - 80;

          return (
            <div
              key={`row-${rowIndex}`}
              ref={(el) => {
                rowRefs.current[rowIndex] = el;
              }}
              style={{
                position: 'absolute',
                top,
                left: -rowStride / 2,
                display: 'flex',
                gap: GAP,
                willChange: 'transform',
              }}
            >
              {row.map((card, cardIndex) => {
                const isImage = card.startsWith('http');

                return (
                  <div
                    key={`${rowIndex}-${cardIndex}`}
                    style={{
                      width: cardWidth,
                      height: CARD_HEIGHT,
                      borderRadius: 12,
                      overflow: 'hidden',
                      flexShrink: 0,
                      background: isImage ? '#111827' : card,
                      boxShadow: '0 12px 30px rgba(0,0,0,0.32)',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    {isImage ? (
                      <img
                        src={card}
                        alt=""
                        draggable={false}
                        loading="eager"
                        onError={(event) => {
                          const img = event.currentTarget;
                          if (img.src !== FALLBACK_POSTER) {
                            img.src = FALLBACK_POSTER;
                          }
                        }}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          display: 'block',
                        }}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle at center, rgba(10, 126, 164, 0.16) 0%, rgba(10, 126, 164, 0.06) 32%, transparent 72%), linear-gradient(180deg, rgba(2,6,23,0.78) 0%, rgba(2,6,23,0.9) 100%)`,
        }}
      />

      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle at center, transparent 0%, ${gradientColor}22 45%, #020617CC 100%)`,
        }}
      />
    </div>
  );
};

export default GridMotionBackground;
