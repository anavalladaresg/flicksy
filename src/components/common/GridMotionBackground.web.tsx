import { TMDB_IMAGE_BASE_URL } from '@/src/constants/config';
import { usePopularGames } from '@/src/features/games/presentation/hooks';
import { usePopularMovies } from '@/src/features/movies/presentation/hooks';
import { usePopularTVShows } from '@/src/features/tv/presentation/hooks';
import { Game } from '@/src/types';
import { gsap } from 'gsap';
import React, { FC, ReactNode, useEffect, useRef } from 'react';
import { Platform } from 'react-native';

function toGameImageUrl(game: Game): string | null {
  if (game.cover?.image_id) {
    return `https://images.igdb.com/igdb/image/upload/t_cover_big_2x/${game.cover.image_id}.jpg`;
  }
  if (!game.cover?.url) return null;
  const normalized = game.cover.url.startsWith('//')
    ? `https:${game.cover.url}`
    : game.cover.url.startsWith('http')
      ? game.cover.url
      : `https://${game.cover.url}`;
  return normalized.replace('/t_thumb/', '/t_cover_big_2x/');
}

interface GridMotionProps {
  items?: (string | ReactNode)[];
  gradientColor?: string;
}

const GridMotion: FC<GridMotionProps> = ({ items = [], gradientColor = 'black' }) => {
  const gridRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const mouseXRef = useRef<number>(window.innerWidth / 2);
  const mouseYRef = useRef<number>(window.innerHeight / 2);

  // Obtener imágenes populares
  const moviesQuery = usePopularMovies(1);
  const tvQuery = usePopularTVShows(1);
  const gamesQuery = usePopularGames(1, Platform.OS === 'web');

  // Combinar imágenes
  let images: string[] = [];
  if (moviesQuery.data?.data) {
    moviesQuery.data.data.forEach((movie) => {
      if (movie.poster_path) {
        images.push(`${TMDB_IMAGE_BASE_URL}${movie.poster_path}`);
      }
    });
  }
  if (tvQuery.data?.data) {
    tvQuery.data.data.forEach((show) => {
      if (show.poster_path) {
        images.push(`${TMDB_IMAGE_BASE_URL}${show.poster_path}`);
      }
    });
  }
  if (gamesQuery.data?.data) {
    gamesQuery.data.data.forEach((game) => {
      const imageUrl = toGameImageUrl(game);
      if (imageUrl) {
        images.push(imageUrl);
      }
    });
  }

  // Configuración de grid
  const width = typeof window !== 'undefined' ? window.innerWidth : 1920;
  const height = typeof window !== 'undefined' ? window.innerHeight : 1080;
  const rows = 4;
  // Más zoom: tarjetas más grandes y grid más grande
  const cardHeight = Math.ceil(height / rows) * 1.25; // 25% más grandes
  const cols = Math.ceil(width / cardHeight * 1.5);
  const cardWidth = Math.ceil(width / cols) * 1.25;
  const totalCards = rows * cols;

  // Repetir imágenes si faltan, usar placeholder si no hay ninguna
  let gridImages = [];
  const placeholder = 'https://via.placeholder.com/300x450/222/fff?text=Flicksy';
  const sourceImages = images.length > 0 ? images : [placeholder];
  for (let i = 0; i < totalCards; i++) {
    gridImages.push(sourceImages[i % sourceImages.length]);
  }

  useEffect(() => {
    gsap.ticker.lagSmoothing(0);
    const handleMouseMove = (e: MouseEvent): void => {
      mouseXRef.current = e.clientX;
    };
    // Animación horizontal por fila (solo por mouse, sin onda)
    const updateMotion = () => {
      for (let row = 0; row < rows; row++) {
        const direction = row % 2 === 0 ? 1 : -1;
        const maxMoveAmount = width * 0.18; // más desplazamiento
        const moveAmount = ((mouseXRef.current / width) * maxMoveAmount - maxMoveAmount / 2) * direction;
        const rowY = row * cardHeight - ((rows * cardHeight - height) / 2) + 160; // más abajo
        for (let col = 0; col < cols; col++) {
          const idx = row * cols + col;
          const card = gridRef.current?.children[0]?.children[idx] as HTMLDivElement | null;
          if (card) {
            const baseX = col * cardWidth - ((cols * cardWidth - width) / 2) + 220; // más a la derecha
            gsap.to(card, {
              x: baseX + moveAmount,
              y: rowY,
              rotate: 0,
              duration: 0.7,
              ease: 'power3.out',
              overwrite: 'auto',
            });
          }
        }
      }
    };
    const removeAnimationLoop = gsap.ticker.add(updateMotion);
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      removeAnimationLoop();
    };
  }, [gridImages, cols, rows, width, height]);

  if (Platform.OS !== 'web') return null;

  return (
    <div ref={gridRef} className="h-full w-full overflow-hidden">
      <section
        className="w-full h-screen overflow-hidden relative flex items-center justify-center"
        style={{
          background: `radial-gradient(circle, ${gradientColor} 0%, transparent 100%)`,
          transform: 'rotate(-15deg)',
          transformOrigin: 'center center',
        }}
      >
        <div className="absolute inset-0 pointer-events-none z-[4] bg-[length:250px]"></div>
        <div className="relative w-full h-full" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
          {gridImages.map((url, idx) => (
            <div
              key={idx}
              style={{
                width: cardWidth,
                height: cardHeight,
                position: 'absolute',
                left: 0,
                top: 0,
                zIndex: 2,
                borderRadius: 12,
                overflow: 'hidden',
                boxShadow: '0 4px 24px #0008',
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  backgroundImage: `url(${url})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />
            </div>
          ))}
        </div>
        <div className="relative w-full h-full top-0 left-0 pointer-events-none"></div>
      </section>
    </div>
  );
};

export default GridMotion;
