/**
 * Funciones utilitarias para la aplicación
 */

/**
 * Formatea una fecha a formato legible
 */
export const formatDate = (dateString: string): string => {
  if (!dateString) return 'N/A';
  
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
};

/**
 * Obtiene el año de una fecha
 */
export const getYear = (dateString: string): number => {
  if (!dateString) return 0;
  return new Date(dateString).getFullYear();
};

/**
 * Trunca un string a una longitud máxima
 */
export const truncate = (
  text: string,
  length: number = 100
): string => {
  if (!text || text.length <= length) return text;
  return text.substring(0, length) + '...';
};

/**
 * Valida si es una URL válida
 */
export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Formatea un número como rating
 */
export const formatRating = (rating: number | undefined): string => {
  if (!rating) return 'N/A';
  return rating.toFixed(1);
};

/**
 * Debounce helper para búsquedas
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

/**
 * Obtiene un color basado en el estado
 */
export const getStatusColor = (
  status: 'watching' | 'completed' | 'planned' | 'dropped' | 'playing'
): string => {
  const colors = {
    watching: '#2196F3', // Azul
    completed: '#4CAF50', // Verde
    planned: '#FF9800', // Naranja
    dropped: '#F44336', // Rojo
    playing: '#9C27B0', // Púrpura
  };

  return colors[status] || '#666';
};

/**
 * Obtiene un icono basado en el tipo de media
 */
export const getMediaIcon = (
  mediaType: 'movie' | 'tv' | 'game'
): string => {
  const icons = {
    movie: 'movie',
    tv: 'tv',
    game: 'sports-esports',
  };

  return icons[mediaType];
};

/**
 * Formatea un número de duración en minutos a horas y minutos
 */
export const formatDuration = (minutes: number): string => {
  if (!minutes) return 'N/A';
  
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
};

/**
 * Genera un UUID simple
 */
export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Compara dos arrays por referencia
 */
export const arraysEqual = <T>(a: T[], b: T[]): boolean => {
  if (a.length !== b.length) return false;
  return a.every((item, index) => item === b[index]);
};
