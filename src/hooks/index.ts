/**
 * Índice de exportaciones para hooks
 */

// Movie hooks
export {
    useMovieDetails, usePopularMovies,
    useSearchMovies
} from '../features/movies/presentation/hooks';

// TV hooks
export {
    usePopularTVShows,
    useSearchTVShows,
    useTVShowDetails
} from '../features/tv/presentation/hooks';

// Game hooks
export {
    useGameDetails, usePopularGames,
    useSearchGames
} from '../features/games/presentation/hooks';

// Store hooks
export {
    useTrackedGames, useTrackedItems,
    useTrackedMovies,
    useTrackedTV, useTrackingStore
} from '../store/tracking';

