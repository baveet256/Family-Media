import { Platform } from 'react-native';
import Constants from 'expo-constants';

import { registerDeviceToken } from '@/lib/api';

/** Best-effort Expo push registration. Safe no-op on web / missing perms. */
export async function registerForPushNotifications(
  token: string,
): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  try {
    const Notifications = await import('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;

    const projectId =
      Constants.easConfig?.projectId ??
      Constants.expoConfig?.extra?.eas?.projectId;

    const push = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );

    await registerDeviceToken(token, push.data, Platform.OS);
    return push.data;
  } catch {
    return null;
  }
}
