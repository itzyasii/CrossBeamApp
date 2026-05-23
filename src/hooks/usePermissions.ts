import { PermissionsAndroid, Platform } from "react-native";
import * as Device from "expo-device";
import * as MediaLibrary from "expo-media-library";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { Camera } from "expo-camera";

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

      console.log(
        `[Permissions] All permissions requested. Overall status: ${allGranted}`,
      );
      return allGranted;
    } catch (error) {
      console.error("[Permissions] Error requesting permissions:", error);
      return false;
    }
  };

  const requestStoragePermissions = async (): Promise<boolean> => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      const granted = status === "granted" || (status as any) === "limited";
      console.log(`[Permissions] Storage access: ${status}`);
      return granted;
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

  const getMissingPermissions = async (): Promise<string[]> => {
    const missing: string[] = [];

    // Check storage
    const mediaPerm = await MediaLibrary.getPermissionsAsync();
    if (
      mediaPerm.status !== "granted" &&
      (mediaPerm as any).status !== "limited"
    ) {
      missing.push("Storage/Media");
    }

    // Check location
    const locPerm = await Location.getForegroundPermissionsAsync();
    if (locPerm.status !== "granted") {
      missing.push("Location");
    }

    // Check notifications
    const notifPerm = await Notifications.getPermissionsAsync();
    if (!notifPerm.granted) {
      missing.push("Notifications");
    }

    // Check camera
    const camPerm = await Camera.getCameraPermissionsAsync();
    if (camPerm.status !== "granted") {
      missing.push("Camera");
    }

    return missing;
  };

  return {
    requestAllPermissions,
    requestStoragePermissions,
    requestLocationPermissions,
    requestNotificationPermissions,
    requestCameraPermissions,
    requestBluetoothPermissions,
    getMissingPermissions,
  };
};
