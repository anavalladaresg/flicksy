import { Platform } from 'react-native';

type NotifyKind = 'success' | 'error' | 'warning' | 'info';

export function showInAppNotification(kind: NotifyKind, title: string, description?: string) {
  if (Platform.OS !== 'web') {
    // En móvil están deshabilitadas por requisito de producto.
    return;
  }

  // En web, usar la implementación específica que importa sileo correctamente
  // React Native automáticamente carga el archivo .web.ts cuando Platform.OS === 'web'
  console.log(`[notify:${kind}] ${title}${description ? ` - ${description}` : ''}`);
}

export async function requestWebNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (Platform.OS !== 'web') return 'unsupported';
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.requestPermission();
}
