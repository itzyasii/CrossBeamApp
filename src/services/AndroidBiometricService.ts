import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { CrossBeamNative } from '../native/crossbeamNative';

export interface AndroidSecureSession {
  token: string;
  userId: string;
  expiresAt: number;
}

class AndroidBiometricService {
  private static instance: AndroidBiometricService;
  private readonly SESSION_KEY_ALIAS = 'crossbeam_session_key';

  private constructor() {}

  public static getInstance(): AndroidBiometricService {
    if (!AndroidBiometricService.instance) {
      AndroidBiometricService.instance = new AndroidBiometricService();
    }
    return AndroidBiometricService.instance;
  }

  public async isBiometricAvailable(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return compatible && enrolled;
  }

  public async authenticate(reason: string): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });
    
    return result.success;
  }

  public async storeSession(userId: string, token: string, expirationMinutes: number = 60): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    if (!CrossBeamNative) return false;

    try {
      const session: AndroidSecureSession = {
        token,
        userId,
        expiresAt: Date.now() + expirationMinutes * 60 * 1000,
      };

      const encrypted = await CrossBeamNative.storeSecureValue(
        `${this.SESSION_KEY_ALIAS}_${userId}`,
        JSON.stringify(session)
      );

      // We might want to store the encrypted string in SharedPreferences/AsyncStorage
      // But for now, we just return true if encryption succeeded.
      // In a real app, you'd store the result of storeSecureValue in AsyncStorage.
      return !!encrypted;
    } catch (error) {
      console.error('Failed to store secure session on Android:', error);
      return false;
    }
  }

  public async getSession(userId: string, encryptedSession: string): Promise<AndroidSecureSession | null> {
    if (Platform.OS !== 'android') return null;
    if (!CrossBeamNative) return null;

    try {
      const isAuthenticated = await this.authenticate('Access your CrossBeam session');
      if (!isAuthenticated) return null;

      const decrypted = await CrossBeamNative.retrieveSecureValue(
        `${this.SESSION_KEY_ALIAS}_${userId}`,
        encryptedSession
      );

      return JSON.parse(decrypted) as AndroidSecureSession;
    } catch (error) {
      console.error('Failed to retrieve secure session on Android:', error);
      return null;
    }
  }
}

export default AndroidBiometricService.getInstance();
