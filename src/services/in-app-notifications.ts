import { Alert, Platform } from 'react-native';

type NotifyKind = 'success' | 'error' | 'warning' | 'info';

type SileoModule = {
  success: (payload: { title: string; description?: string }) => void;
  error: (payload: { title: string; description?: string }) => void;
  warning: (payload: { title: string; description?: string }) => void;
  info: (payload: { title: string; description?: string }) => void;
};

function getSileo(): SileoModule | null {
  if (Platform.OS !== 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('sileo') as SileoModule;
  } catch {
    return null;
  }
}

export function showInAppNotification(kind: NotifyKind, title: string, description?: string) {
  const sileo = getSileo();
  if (sileo) {
    sileo[kind]({ title, description });
    return;
  }

  if (Platform.OS !== 'web') {
    Alert.alert(title, description);
    return;
  }

  console.log(`[notify:${kind}] ${title}${description ? ` - ${description}` : ''}`);
}

export async function requestWebNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (Platform.OS !== 'web') return 'unsupported';
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.requestPermission();
}

