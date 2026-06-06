import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';

type NotificationsModule = typeof import('expo-notifications');

const shouldSkipNotifications = () =>
  Platform.OS === 'android' && isRunningInExpoGo();

let notificationsModulePromise: Promise<NotificationsModule | null> | null =
  null;

const getNotifications = async () => {
  if (Platform.OS === 'web' || shouldSkipNotifications()) {
    return null;
  }

  notificationsModulePromise ??= import('expo-notifications').then(
    (Notifications) => {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });

      return Notifications;
    },
  );

  return notificationsModulePromise;
};

export const notificationService = {
  /**
   * Shows or updates a progress notification for a file transfer.
   */
  updateProgress: async (id: string, fileName: string, progress: number) => {
    const Notifications = await getNotifications();
    if (!Notifications) return;

    await Notifications.setNotificationChannelAsync('transfer-progress', {
      name: 'Transfer Progress',
      importance: Notifications.AndroidImportance.LOW,
      showBadge: false,
    });

    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: {
        title: `Beaming: ${fileName}`,
        body: `${Math.round(progress * 100)}% complete`,
        data: { id },
      },
      trigger: null,
    });
  },

  /**
   * Shows a completion notification.
   */
  showComplete: async (fileName: string) => {
    const Notifications = await getNotifications();
    if (!Notifications) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Transfer Complete',
        body: `${fileName} has been received successfully.`,
      },
      trigger: null,
    });
  },

  /**
   * Request permissions.
   */
  requestPermissions: async () => {
    const Notifications = await getNotifications();
    if (!Notifications) return false;

    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  },
};
