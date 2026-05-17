import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const notificationService = {
  /**
   * Shows or updates a progress notification for a file transfer.
   */
  updateProgress: async (id: string, fileName: string, progress: number) => {
    if (Platform.OS === 'web') return;

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
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  },
};
