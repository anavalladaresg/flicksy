import { useEffect } from 'react';
import { Platform } from 'react-native';

export function useEscapeClose(enabled: boolean, onClose?: () => void) {
  useEffect(() => {
    if (!enabled || Platform.OS !== 'web' || !onClose) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, onClose]);
}
