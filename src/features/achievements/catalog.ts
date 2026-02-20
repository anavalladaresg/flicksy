import { TrackedItem } from '../../types';

export type AchievementCategory = 'Objetivos' | 'Descubrimiento' | 'Coleccionismo';
export type AchievementRarity = 'Común' | 'Raro' | 'Epico' | 'Legendario';

export type AchievementDefinition = {
  id: string;
  title: string;
  description: string;
  category: AchievementCategory;
  icon: string;
  rarity: AchievementRarity;
  unlockWhen: (stats: AchievementStats) => boolean;
};

export type AchievementInput = {
  trackedItems: TrackedItem[];
  topGenresCount: number;
  monthlyMovieGoal: number;
  monthlyGameGoal: number;
  movieGoalProgress: number;
  gameGoalProgress: number;
  goalPeriodStatuses: Record<string, 'success' | 'fail'>;
};

type AchievementStats = {
  libraryCount: number;
  ratedCount: number;
  completedCount: number;
  mediaTypeCount: number;
  topGenresCount: number;
  goalSuccessCount: number;
  movieGoalReached: boolean;
  gameGoalReached: boolean;
};

function buildStats(input: AchievementInput): AchievementStats {
  const mediaTypeSet = new Set(input.trackedItems.map((item) => item.mediaType));
  const ratedCount = input.trackedItems.filter((item) => typeof item.rating === 'number').length;
  const completedCount = input.trackedItems.filter((item) => item.status === 'completed').length;
  const goalSuccessCount = Object.values(input.goalPeriodStatuses).filter((status) => status === 'success').length;

  return {
    libraryCount: input.trackedItems.length,
    ratedCount,
    completedCount,
    mediaTypeCount: mediaTypeSet.size,
    topGenresCount: input.topGenresCount,
    goalSuccessCount,
    movieGoalReached: input.movieGoalProgress >= input.monthlyMovieGoal,
    gameGoalReached: input.gameGoalProgress >= input.monthlyGameGoal,
  };
}

export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  {
    id: 'goals-first-win',
    title: 'Objetivo en marcha',
    description: 'Cumple al menos un objetivo semanal o mensual.',
    category: 'Objetivos',
    icon: 'flag',
    rarity: 'Común',
    unlockWhen: (stats) => stats.movieGoalReached || stats.gameGoalReached || stats.goalSuccessCount >= 1,
  },
  {
    id: 'goals-double-win',
    title: 'Doble objetivo',
    description: 'Cumple a la vez el objetivo de peliculas y juegos.',
    category: 'Objetivos',
    icon: 'verified',
    rarity: 'Raro',
    unlockWhen: (stats) => stats.movieGoalReached && stats.gameGoalReached,
  },
  {
    id: 'goals-consistent-3',
    title: 'Consistencia total',
    description: 'Completa 3 periodos con objetivos cumplidos.',
    category: 'Objetivos',
    icon: 'military-tech',
    rarity: 'Epico',
    unlockWhen: (stats) => stats.goalSuccessCount >= 3,
  },
  {
    id: 'discoverer-genres-3',
    title: 'Curioso',
    description: 'Explora al menos 3 generos distintos.',
    category: 'Descubrimiento',
    icon: 'travel-explore',
    rarity: 'Común',
    unlockWhen: (stats) => stats.topGenresCount >= 3,
  },
  {
    id: 'discoverer-all-media',
    title: 'Multiverso Flicksy',
    description: 'Registra peliculas, series y juegos.',
    category: 'Descubrimiento',
    icon: 'hub',
    rarity: 'Raro',
    unlockWhen: (stats) => stats.mediaTypeCount >= 3,
  },
  {
    id: 'discoverer-genres-8',
    title: 'Mente abierta',
    description: 'Llega a 8 generos diferentes en tu historial.',
    category: 'Descubrimiento',
    icon: 'flare',
    rarity: 'Epico',
    unlockWhen: (stats) => stats.topGenresCount >= 8,
  },
  {
    id: 'collector-library-25',
    title: 'Coleccionista',
    description: 'Guarda 25 items en tu biblioteca.',
    category: 'Coleccionismo',
    icon: 'collections-bookmark',
    rarity: 'Común',
    unlockWhen: (stats) => stats.libraryCount >= 25,
  },
  {
    id: 'collector-ratings-30',
    title: 'Critico oficial',
    description: 'Valora 30 items con puntuacion.',
    category: 'Coleccionismo',
    icon: 'star-rate',
    rarity: 'Raro',
    unlockWhen: (stats) => stats.ratedCount >= 30,
  },
  {
    id: 'collector-completed-50',
    title: 'Leyenda del backlog',
    description: 'Completa 50 items en total.',
    category: 'Coleccionismo',
    icon: 'workspace-premium',
    rarity: 'Legendario',
    unlockWhen: (stats) => stats.completedCount >= 50,
  },
];

export const ACHIEVEMENTS_BY_ID = ACHIEVEMENT_DEFINITIONS.reduce<Record<string, AchievementDefinition>>((acc, item) => {
  acc[item.id] = item;
  return acc;
}, {});

export function evaluateAchievementUnlocks(input: AchievementInput): AchievementDefinition[] {
  const stats = buildStats(input);
  return ACHIEVEMENT_DEFINITIONS.filter((achievement) => achievement.unlockWhen(stats));
}
