import { PermissionsAndroid, Platform } from "react-native";
import { isRunningInExpoGo } from "expo";

import * as Device from "expo-device";
import * as Location from "expo-location";
import { Camera } from "expo-camera";

const nearbyWifiPermission = "android.permission.NEARBY_WIFI_DEVICES";
type NotificationsModule = typeof import("expo-notifications");

const shouldSkipNotifications = () =>
  Platform.OS === "android" && isRunningInExpoGo();

let notificationsModulePromise: Promise<NotificationsModule | null> | null =
  null;

const getNotifications = async () => {
  if (Platform.OS === "web" || shouldSkipNotifications()) {
    return null;
  }

  notificationsModulePromise ??= import("expo-notifications");
  return notificationsModulePromise;
};

export const usePermissions = () => {
  const requestAllPermissions = async (): Promise<boolean> => {
    try {
      let allGranted = true;

      // Storage/Media permissions (required for file selection)
      const mediaStatus = await requestStoragePermissions();
      allGranted = allGranted && mediaStatus;

      // Location permissions (required for Wi-Fi Direct/Bluetooth discovery on Android)
      const locationGranted = await requestLocationPermissions();
      allGranted = allGranted && locationGranted;

      // Notifications permissions (required for foreground transfers)
      const notificationsGranted = await requestNotificationPermissions();
      allGranted = allGranted && notificationsGranted;

      // Camera permissions (required for QR code pairing)
      const cameraGranted = await requestCameraPermissions();
      allGranted = allGranted && cameraGranted;

      // Bluetooth permissions (required for BLE discovery on Android 12+)
      const bluetoothGranted = await requestBluetoothPermissions();
      allGranted = allGranted && bluetoothGranted;

      // Nearby Wi-Fi permission (required for Wi-Fi Direct on Android 13+)
      const nearbyWifiGranted = await requestNearbyWifiPermissions();
      allGranted = allGranted && nearbyWifiGranted;

      console.log(
        `[Permissions] All permissions requested. Overall status: ${allGranted}`,
      );
      return allGranted;
    } catch (error) {
      console.error("[Permissions] Error requesting permissions:", error);
      return false;
    }
  };

  const requestDiscoveryPermissions = async (): Promise<boolean> => {
    try {
      const locationGranted = await requestLocationPermissions();
      const bluetoothGranted = await requestBluetoothPermissions();
      const nearbyWifiGranted = await requestNearbyWifiPermissions();

      const granted = locationGranted && bluetoothGranted && nearbyWifiGranted;
      console.log(
        `[Permissions] Discovery access: ${granted ? "granted" : "denied"}`,
      );
      return granted;
    } catch (error) {
      console.error(
        "[Permissions] Error requesting discovery permissions:",
        error,
      );
      return false;
    }
  };

  const requestStoragePermissions = async (): Promise<boolean> => {
    try {
      if (Platform.isTV) {
        return true;
      }

      if (Platform.OS === "android" && isRunningInExpoGo()) {
        console.log("[Permissions] Media library access limited in Expo Go");
        return true;
      }

      if (Platform.OS === "android") {
        // Android 13+ uses scoped media permissions and the document picker
        // does not require broad storage access.
        if (!Device.platformApiLevel || Device.platformApiLevel < 29) {
          const writeStatus = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          );
          if (writeStatus !== PermissionsAndroid.RESULTS.GRANTED) {
            console.log("[Permissions] Write storage denied");
            return false;
          }
        }
        return true;
      }

      // iOS document pickers and the share extension grant access only to the
      // items selected by the user, so broad photo-library access is not needed.
      return true;
    } catch (error) {
      console.error("[Permissions] Error requesting media permissions:", error);
      return false;
    }
  };

  const requestLocationPermissions = async (): Promise<boolean> => {
    try {
      if (Platform.OS === "android") {
        // Android requires fine location for Wi-Fi Direct and Bluetooth scanning
        const { status } = await Location.requestForegroundPermissionsAsync();
        const granted = status === "granted";
        console.log(`[Permissions] Location access: ${status}`);
        return granted;
      } else if (Platform.OS === "ios") {
        const { status } = await Location.requestForegroundPermissionsAsync();
        const granted = status === "granted";
        console.log(`[Permissions] Location access: ${status}`);
        return granted;
      }
      return true;
    } catch (error) {
      console.error(
        "[Permissions] Error requesting location permissions:",
        error,
      );
      return false;
    }
  };

  const requestNotificationPermissions = async (): Promise<boolean> => {
    try {
      const Notifications = await getNotifications();
      if (!Notifications) {
        console.log("[Permissions] Notifications unavailable in Expo Go");
        return true;
      }

      const { status } = await Notifications.requestPermissionsAsync();
      const granted = status === "granted";
      console.log(`[Permissions] Notifications access: ${status}`);
      return granted;
    } catch (error) {
      console.error(
        "[Permissions] Error requesting notification permissions:",
        error,
      );
      return false;
    }
  };

  const requestCameraPermissions = async (): Promise<boolean> => {
    try {
      const { status } = await Camera.requestCameraPermissionsAsync();
      const granted = status === "granted";
      console.log(`[Permissions] Camera access: ${status}`);
      return granted;
    } catch (error) {
      console.error(
        "[Permissions] Error requesting camera permissions:",
        error,
      );
      return false;
    }
  };

  const requestBluetoothPermissions = async (): Promise<boolean> => {
    try {
      if (
        Platform.OS === "android" &&
        Device.platformApiLevel &&
        Device.platformApiLevel >= 31
      ) {
        const statuses = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
        ]);
        const granted = Object.values(statuses).every(
          (status) => status === PermissionsAndroid.RESULTS.GRANTED,
        );
        console.log(
          `[Permissions] Bluetooth access: ${granted ? "granted" : "denied"}`,
        );
        return granted;
      }
      return true;
    } catch (error) {
      console.error(
        "[Permissions] Error requesting Bluetooth permissions:",
        error,
      );
      return false;
    }
  };

  const requestNearbyWifiPermissions = async (): Promise<boolean> => {
    try {
      if (
        Platform.OS === "android" &&
        Device.platformApiLevel &&
        Device.platformApiLevel >= 33
      ) {
        const status = await PermissionsAndroid.request(nearbyWifiPermission);
        const granted = status === PermissionsAndroid.RESULTS.GRANTED;
        console.log(
          `[Permissions] Nearby Wi-Fi access: ${granted ? "granted" : "denied"}`,
        );
        return granted;
      }
      return true;
    } catch (error) {
      console.error(
        "[Permissions] Error requesting nearby Wi-Fi permissions:",
        error,
      );
      return false;
    }
  };

  const getMissingPermissions = async (): Promise<string[]> => {
    const missing: string[] = [];

    const Notifications = await getNotifications();
    if (Notifications) {
      const notifPerm = await Notifications.getPermissionsAsync();
      if (!notifPerm.granted) {
        missing.push("Notifications");
      }
    }

    // Check camera
    const camPerm = await Camera.getCameraPermissionsAsync();
    if (camPerm.status !== "granted") {
      missing.push("Camera");
    }

    missing.push(...(await getMissingDiscoveryPermissions()));

    return Array.from(new Set(missing));
  };

  const getMissingDiscoveryPermissions = async (): Promise<string[]> => {
    const missing: string[] = [];

    const locPerm = await Location.getForegroundPermissionsAsync();
    if (locPerm.status !== "granted") {
      missing.push("Location");
    }

    if (
      Platform.OS === "android" &&
      Device.platformApiLevel &&
      Device.platformApiLevel >= 31
    ) {
      const statuses = await Promise.all([
        PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN),
        PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ),
        PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
        ),
      ]);
      if (!statuses.every(Boolean)) {
        missing.push("Bluetooth");
      }
    }

    if (
      Platform.OS === "android" &&
      Device.platformApiLevel &&
      Device.platformApiLevel >= 33 &&
      !(await PermissionsAndroid.check(nearbyWifiPermission))
    ) {
      missing.push("Nearby Wi-Fi");
    }

    return Array.from(new Set(missing));
  };

  return {
    requestAllPermissions,
    requestDiscoveryPermissions,
    requestStoragePermissions,
    requestLocationPermissions,
    requestNotificationPermissions,
    requestCameraPermissions,
    requestBluetoothPermissions,
    requestNearbyWifiPermissions,
    getMissingPermissions,
    getMissingDiscoveryPermissions,
  };
};
