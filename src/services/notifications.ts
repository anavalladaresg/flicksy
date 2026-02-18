import Constants from 'expo-constants';
import { Platform } from 'react-native';

let configured = false;
let projectIdWarned = false;

type NotificationsModule = {
  AndroidImportance: { MAX: number };
  setNotificationHandler: (handler: unknown) => void;
  setNotificationChannelAsync: (name: string, config: unknown) => Promise<void>;
  getPermissionsAsync: () => Promise<{ status: string }>;
  requestPermissionsAsync: () => Promise<{ status: string }>;
  getExpoPushTokenAsync: (options?: { projectId?: string }) => Promise<{ data: string }>;
  scheduleNotificationAsync: (options: unknown) => Promise<void>;
};

function getNotificationsModule(): NotificationsModule | null {
  try {
    const moduleName = 'expo-notifications';
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(moduleName) as NotificationsModule;
  } catch {
    return null;
  }
}

export function configureNotifications() {
  const Notifications = getNotificationsModule();
  if (!Notifications) return;
  if (configured) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  configured = true;
}

export async function registerPushToken(): Promise<string | null> {
  const Notifications = getNotificationsModule();
  if (!Notifications) return null;
  if (Platform.OS === 'web') return null;

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0E7490',
      });
    }

    const permissions = await Notifications.getPermissionsAsync();
    let finalStatus = permissions.status;
    if (finalStatus !== 'granted') {
      const request = await Notifications.requestPermissionsAsync();
      finalStatus = request.status;
    }
    if (finalStatus !== 'granted') return null;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) {
      if (!projectIdWarned) {
        console.warn('[notifications] Missing EAS projectId. Skipping push token registration.');
        projectIdWarned = true;
      }
      return null;
    }

    const response = await Notifications.getExpoPushTokenAsync({ projectId });
    return response.data ?? null;
  } catch (error) {
    console.warn('[notifications] registerPushToken failed:', error);
    return null;
  }
}

export async function sendLocalNotification(title: string, body: string) {
  const Notifications = getNotificationsModule();
  if (!Notifications) return;
  if (Platform.OS === 'web') return;
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: null,
  });
}

export async function sendExpoPushNotification(toToken: string, title: string, body: string) {
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: toToken,
      sound: 'default',
      title,
      body,
    }),
  });
}
