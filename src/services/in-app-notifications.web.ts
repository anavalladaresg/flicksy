// Importación estática de Sileo para web
import { sileo } from 'sileo';
import { Fonts } from '@/constants/theme';
import { usePreferencesStore } from '@/src/store/preferences';

type NotifyKind = 'success' | 'error' | 'warning' | 'info';

// Función helper para obtener el tema actual desde el store
function getCurrentTheme(): 'light' | 'dark' {
  try {
    const themeMode = usePreferencesStore.getState().themeMode;
    
    if (themeMode === 'dark') return 'dark';
    if (themeMode === 'light') return 'light';
    
    // Si es 'system', verificar preferencia del sistema
    if (typeof window !== 'undefined' && window.matchMedia) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      return prefersDark ? 'dark' : 'light';
    }
    
    return 'light';
  } catch {
    // Fallback: verificar el DOM
    if (typeof window === 'undefined') return 'light';
    
    const html = document.documentElement;
    const body = document.body;
    
    if (html.classList.contains('dark') || body.classList.contains('dark')) {
      return 'dark';
    }
    
    const computedStyle = window.getComputedStyle(body);
    const bgColor = computedStyle.backgroundColor;
    
    if (bgColor && (bgColor.includes('rgb(11, 18, 32)') || bgColor.includes('rgb(17, 24, 39)'))) {
      return 'dark';
    }
    
    return 'light';
  }
}

// Función helper para obtener opciones de estilo según el tema
function getNotificationOptions(kind: NotifyKind, isDark: boolean) {
  const fontFamily = Fonts.web?.sans || "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  const palette = (() => {
    if (kind === 'success') {
      return isDark
        ? { fill: '#064E3B', title: '#F8FAFC', description: '#E2E8F0', accent: '#34D399' }
        : { fill: '#ECFDF3', title: '#14532D', description: '#166534', accent: '#16A34A' };
    }
    if (kind === 'error') {
      return isDark
        ? { fill: '#7F1D1D', title: '#F8FAFC', description: '#E2E8F0', accent: '#F87171' }
        : { fill: '#FEF2F2', title: '#7F1D1D', description: '#991B1B', accent: '#DC2626' };
    }
    if (kind === 'warning') {
      return isDark
        ? { fill: '#78350F', title: '#F8FAFC', description: '#E2E8F0', accent: '#FBBF24' }
        : { fill: '#FFFBEB', title: '#78350F', description: '#92400E', accent: '#D97706' };
    }
    return isDark
      ? { fill: '#0C4A6E', title: '#F8FAFC', description: '#E2E8F0', accent: '#38BDF8' }
      : { fill: '#F0F9FF', title: '#0C4A6E', description: '#075985', accent: '#0284C7' };
  })();

  return {
    autopilot: {
      expand: 500,
      collapse: 3000,
    },
    fill: palette.fill,
    roundness: 16,
    styles: {
      title: `font-family: ${fontFamily} !important; font-weight: 800 !important; font-size: 15px !important; line-height: 1.25 !important; color: ${palette.title} !important; -webkit-text-fill-color: ${palette.title} !important; text-align: left !important; opacity: 1 !important;`,
      description: `font-family: ${fontFamily} !important; font-weight: 600 !important; font-size: 13px !important; line-height: 1.35 !important; color: ${palette.description} !important; -webkit-text-fill-color: ${palette.description} !important; opacity: 1 !important;`,
      badge: `background-color: ${palette.accent} !important; color: #FFFFFF !important; width: 22px !important; height: 22px !important; min-width: 22px !important; min-height: 22px !important; border-radius: 999px !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; line-height: 1 !important; text-align: center !important; padding: 0 !important;`,
      button: `background-color: ${palette.accent}22 !important; color: ${palette.title} !important; font-family: ${fontFamily} !important; font-weight: 700 !important;`,
      container: `border: 1px solid ${palette.accent}66 !important; box-shadow: 0 10px 24px rgba(2, 6, 23, 0.35) !important; color: ${palette.title} !important;`,
    },
  };
}

export function showInAppNotification(kind: NotifyKind, title: string, description?: string) {
  const isDark = getCurrentTheme() === 'dark';
  const options = getNotificationOptions(kind, isDark);
  const payload = { 
    title, 
    description,
    ...options,
  };
  
  try {
    switch (kind) {
      case 'success':
        sileo.success(payload);
        return;
      case 'error':
        sileo.error(payload);
        return;
      case 'warning':
        sileo.warning(payload);
        return;
      case 'info':
        sileo.info(payload);
        return;
      default:
        // Fallback seguro usando sileo.show()
        sileo.show(payload);
        return;
    }
  } catch (error) {
    console.error('Error al mostrar notificación Sileo:', error);
    console.log(`[notify:${kind}] ${title}${description ? ` - ${description}` : ''}`);
  }
}

export async function requestWebNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.requestPermission();
}
