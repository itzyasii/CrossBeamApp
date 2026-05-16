import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as MediaLibrary from 'expo-media-library';

export const usePermissions = () => {
  const requestStoragePermissions = async () => {
    if (Platform.OS === 'ios') {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      return status === 'granted';
    }

    if (Platform.OS === 'android') {
      const sdkInt = Device.osInternalBuildId ? parseInt(Device.osInternalBuildId, 10) : 0;
      const osVersion = parseInt(Device.osVersion || '0', 10);

      // Android 14+ (SDK 34+)
      if (osVersion >= 14) {
        const { status, canAskAgain } = await MediaLibrary.requestPermissionsAsync();
        // Handle partial access (User selected some photos)
        if (status === 'granted' || (status as any) === 'limited') {
          return true;
        }
        return false;
      }

      // Android 13 (SDK 33)
      if (osVersion >= 13) {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        return status === 'granted';
      }

      // Android 12 and below
      const { status } = await MediaLibrary.requestPermissionsAsync();
      return status === 'granted';
    }

    return true;
  };

  return {
    requestStoragePermissions,
  };
};
