import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';

import { IncomingApprovalRequest } from '@/services/platformFeatureService';
import { nativeCrossBeam } from '@/native/crossbeamNative';
import { formatBytes } from '@/utils/helpers';

type NotificationsModule = typeof import('expo-notifications');

const INCOMING_CATEGORY = 'incoming-transfer';
const INCOMING_CHANNEL = 'incoming-transfers';

const shouldSkipNotifications = () =>
  Platform.OS === 'android' && isRunningInExpoGo();

let notificationsModulePromise: Promise<NotificationsModule | null> | null =
  null;
let categoriesConfigured = false;

const getNotifications = async () => {
  if (Platform.OS === 'web' || shouldSkipNotifications()) {
    return null;
  }

  notificationsModulePromise ??= import('expo-notifications').then(
    async (Notifications) => {
      Notifications.setNotificationHandler({
        handleNotification: async (notification) => {
          const isIncoming =
            notification.request.content.categoryIdentifier ===
            INCOMING_CATEGORY;

          return {
            shouldShowAlert: true,
            shouldPlaySound: isIncoming,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
          };
        },
      });

      if (!categoriesConfigured) {
        categoriesConfigured = true;
        await Notifications.setNotificationCategoryAsync(INCOMING_CATEGORY, [
          {
            identifier: 'accept',
            buttonTitle: 'Accept',
            options: { opensAppToForeground: false },
          },
          {
            identifier: 'reject',
            buttonTitle: 'Reject',
            options: {
              isDestructive: true,
              opensAppToForeground: false,
            },
          },
        ]);

        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync(INCOMING_CHANNEL, {
            name: 'Incoming Transfers',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 180, 250],
            sound: 'default',
            enableVibrate: true,
          });

          await Notifications.setNotificationChannelAsync('transfer-progress', {
            name: 'Transfer Progress',
            importance: Notifications.AndroidImportance.LOW,
            showBadge: false,
          });
        }
      }

      return Notifications;
    },
  );

  return notificationsModulePromise;
};

export const notificationService = {
  updateProgress: async (id: string, fileName: string, progress: number) => {
    const Notifications = await getNotifications();
    if (!Notifications) return;

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

  showComplete: async (fileName: string) => {
    const Notifications = await getNotifications();
    if (!Notifications) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Transfer Complete',
        body: `${fileName} has been received successfully.`,
        sound: 'default',
      },
      trigger: null,
    });
  },

  showIncomingTransferRequest: async (approval: IncomingApprovalRequest) => {
    // For Android, prefer the native notification with broadcast actions so
    // notification actions can be handled without launching the JS app.
    if (Platform.OS === 'android') {
      try {
        const fileSummary =
          approval.fileNames.length > 1
            ? `${approval.fileNames.length} files`
            : approval.fileNames[0] ?? 'Unknown file';
        await nativeCrossBeam.showIncomingNotification(
          approval.transferId,
          'Incoming transfer',
          `${approval.fromDevice.name} wants to send ${fileSummary} (${formatBytes(approval.sizeBytes)})`,
        );
        return;
      } catch (e) {
        // fall back to expo notifications if native fails
        console.warn('[Notification] native showIncomingNotification failed:', e);
      }
    }

    const Notifications = await getNotifications();
    if (!Notifications) return;

    const fileSummary =
      approval.fileNames.length > 1
        ? `${approval.fileNames.length} files`
        : approval.fileNames[0] ?? 'Unknown file';

    await Notifications.scheduleNotificationAsync({
      identifier: `incoming-${approval.transferId}`,
      content: {
        title: 'Incoming transfer',
        body: `${approval.fromDevice.name} wants to send ${fileSummary} (${formatBytes(approval.sizeBytes)})`,
        sound: 'default',
        categoryIdentifier: INCOMING_CATEGORY,
        data: {
          type: 'incoming-transfer',
          transferId: approval.transferId,
          approvalId: approval.id,
        },
        ...(Platform.OS === 'android'
          ? { channelId: INCOMING_CHANNEL }
          : {}),
      },
      trigger: null,
    });
  },

  dismissIncomingTransferRequest: async (transferId: string) => {
    // Prefer native dismissal on Android (notifications created natively),
    // otherwise fall back to expo-notifications dismissal.
    if (Platform.OS === 'android') {
      try {
        await (nativeCrossBeam as any).dismissIncomingNotification(transferId);
        return;
      } catch (e) {
        console.warn('[Notification] native dismissIncomingNotification failed:', e);
      }
    }

    const Notifications = await getNotifications();
    if (!Notifications) return;
    await Notifications.dismissNotificationAsync(`incoming-${transferId}`);
  },

  requestPermissions: async () => {
    const Notifications = await getNotifications();
    if (!Notifications) return false;

    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
    return status === 'granted';
  },

  addResponseListener: (
    listener: (event: {
      transferId: string;
      approvalId?: string;
      action: 'accept' | 'reject' | 'open';
    }) => void,
  ): (() => void) | null => {
    if (Platform.OS === 'web' || shouldSkipNotifications()) return null;

    let subscription: { remove: () => void } | null = null;

    void getNotifications().then((Notifications) => {
      if (!Notifications) return;
      subscription = Notifications.addNotificationResponseReceivedListener(
        (response) => {
          const data = response.notification.request.content.data as {
            type?: string;
            transferId?: string;
            approvalId?: string;
          };
          if (data.type !== 'incoming-transfer' || !data.transferId) return;

          const actionId = response.actionIdentifier;
          if (actionId === 'accept') {
            listener({
              transferId: data.transferId,
              approvalId: data.approvalId,
              action: 'accept',
            });
            return;
          }
          if (actionId === 'reject') {
            listener({
              transferId: data.transferId,
              approvalId: data.approvalId,
              action: 'reject',
            });
            return;
          }

          listener({
            transferId: data.transferId,
            approvalId: data.approvalId,
            action: 'open',
          });
        },
      );
    });

    return () => subscription?.remove();
  },
};
