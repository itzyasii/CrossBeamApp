import { useCallback, useState } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import { Alert } from 'react-native';

export const useBiometrics = () => {
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const authenticate = useCallback(async (reason: string = 'Unlock CrossBeam') => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        return true; // Fallback if no biometrics available
      }

      setIsAuthenticating(true);
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: reason,
        fallbackLabel: 'Use Passcode',
        disableDeviceFallback: false,
      });
      setIsAuthenticating(false);

      return result.success;
    } catch (error) {
      console.error('[Biometrics] Auth error:', error);
      setIsAuthenticating(false);
      return false;
    }
  }, []);

  return { authenticate, isAuthenticating };
};
