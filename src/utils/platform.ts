import { Platform } from "react-native";
import * as ExpoDevice from "expo-device";

import { DevicePlatform } from "@/types/domain";

export const getRuntimePlatform = (): DevicePlatform => {
  if (Platform.isTV) return "android-tv";
  return Platform.OS === "ios" ? "ios" : "android";
};

export const getRuntimePlatformLabel = (): string => {
  const platform = getRuntimePlatform();
  if (platform === "android-tv") return "Android TV";
  if (platform === "ios") return "iPhone / iPad";
  return "Android";
};

export const getDefaultDeviceName = (): string => {
  if (Platform.isTV) return ExpoDevice.deviceName || "Living Room TV";
  return ExpoDevice.deviceName || ExpoDevice.modelName || "This Device";
};
