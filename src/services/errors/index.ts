/**
 * Manejo centralizado de errores
 * Proporciona funciones helper para manejar errores de forma consistente
 */

import { ApiError, AppError } from '../../types';

export function handleApiError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (typeof error === 'object' && error !== null && 'code' in error) {
    const apiError = error as ApiError;
    return new AppError(
      apiError.code,
      apiError.message,
      apiError.status,
      apiError.originalError
    );
  }

  if (error instanceof Error) {
    return new AppError('UNKNOWN_ERROR', error.message, undefined, error);
  }

  return new AppError('UNKNOWN_ERROR', String(error));
}

export function isNetworkError(error: unknown): boolean {
  if (error instanceof AppError) {
    return ['ECONNABORTED', 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT'].includes(
      error.code
    );
  }
  return false;
}

export function getErrorMessage(error: unknown): string {
  const appError = handleApiError(error);
  
  const errorMessages: Record<string, string> = {
    'UNKNOWN_ERROR': 'Ocurrió un error desconocido',
    'ECONNABORTED': 'La conexión fue abortada',
    'ENOTFOUND': 'No se pudo conectar al servidor',
    'ECONNREFUSED': 'El servidor rechazó la conexión',
    'ETIMEDOUT': 'La solicitud excedió el tiempo máximo',
    '404': 'Recurso no encontrado',
    '500': 'Error del servidor',
  };

  return errorMessages[appError.code] || appError.message || 'Error desconocido';
}

export function logError(error: unknown, context?: string): void {
  const appError = handleApiError(error);
  const prefix = context ? `[${context}]` : '';
  
  console.error(`${prefix} Error: ${appError.code}`, {
    message: appError.message,
    status: appError.status,
    originalError: appError.originalError,
  });
}
