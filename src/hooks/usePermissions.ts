import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as MediaLibrary from 'expo-media-library';

export const usePermissions = () => {
  const requestStoragePermissions = async (): Promise<boolean> => {
    try {
      if (Platform.OS === 'ios') {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        return status === 'granted' || (status as any) === 'limited';
      }

      if (Platform.OS === 'android') {
        const osVersion = parseInt(Device.osVersion || '0', 10);

        // Android 13+ (SDK 33+) requires granular media permissions
        // Expo Media Library handles this if plugins are configured in app.json
        const { status } = await MediaLibrary.requestPermissionsAsync();
        
        if (status === 'granted' || (status as any) === 'limited') {
          return true;
        }

        console.warn(`[Permissions] Storage access ${status}. SDK Version: ${osVersion}`);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[Permissions] Error requesting media permissions:', error);
      return false;
    }
  };

  return {
    requestStoragePermissions,
  };
};
