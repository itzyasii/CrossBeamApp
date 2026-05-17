import * as SecureStore from "expo-secure-store";
import * as LocalAuthentication from "expo-local-authentication";
import { Platform } from "react-native";

export interface BiometricSession {
  token: string;
  userId: string;
  expiresAt: number;
  createdAt: number;
}

export const biometricService = {
  /**
   * Check if biometric authentication is available on device
   */
  async isBiometricAvailable(): Promise<boolean> {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      return compatible && enrolled;
    } catch (error) {
      console.error("Failed to check biometric availability:", error);
      return false;
    }
  },

  /**
   * Get available biometric types (FaceID, TouchID, etc.)
   */
  async getAvailableBiometrics(): Promise<
    LocalAuthentication.AuthenticationType[]
  > {
    try {
      return await LocalAuthentication.supportedAuthenticationTypesAsync();
    } catch (error) {
      console.error("Failed to get biometric types:", error);
      return [];
    }
  },

  /**
   * Authenticate user with biometric
   */
  async authenticate(reason: string): Promise<boolean> {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        disableDeviceFallback: Platform.OS === "ios",
        reason,
        fallbackLabel: "Use passcode instead",
      });
      return result.success;
    } catch (error) {
      console.error("Biometric authentication failed:", error);
      return false;
    }
  },

  /**
   * Create and store a secure session with biometric protection
   */
  async createSecureSession(
    userId: string,
    token: string,
    expirationMinutes: number = 60,
  ): Promise<boolean> {
    try {
      const now = Date.now();
      const expiresAt = now + expirationMinutes * 60 * 1000;

      const session: BiometricSession = {
        token,
        userId,
        expiresAt,
        createdAt: now,
      };

      await SecureStore.setItemAsync(
        `session_${userId}`,
        JSON.stringify(session),
      );

      return true;
    } catch (error) {
      console.error("Failed to create secure session:", error);
      return false;
    }
  },

  /**
   * Retrieve secure session (requires biometric auth first)
   */
  async getSecureSession(userId: string): Promise<BiometricSession | null> {
    try {
      // Verify biometric first
      const isAuthenticated = await this.authenticate(
        "Access your CrossBeam session",
      );
      if (!isAuthenticated) {
        return null;
      }

      const sessionJson = await SecureStore.getItemAsync(`session_${userId}`);
      if (!sessionJson) {
        return null;
      }

      const session = JSON.parse(sessionJson) as BiometricSession;

      // Check if session is expired
      if (session.expiresAt < Date.now()) {
        await this.clearSecureSession(userId);
        return null;
      }

      return session;
    } catch (error) {
      console.error("Failed to get secure session:", error);
      return null;
    }
  },

  /**
   * Clear secure session
   */
  async clearSecureSession(userId: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(`session_${userId}`);
    } catch (error) {
      console.error("Failed to clear secure session:", error);
    }
  },

  /**
   * Check if valid session exists (without requiring biometric)
   */
  async hasValidSession(userId: string): Promise<boolean> {
    try {
      const sessionJson = await SecureStore.getItemAsync(`session_${userId}`);
      if (!sessionJson) {
        return false;
      }

      const session = JSON.parse(sessionJson) as BiometricSession;
      return session.expiresAt > Date.now();
    } catch (error) {
      console.error("Failed to check session:", error);
      return false;
    }
  },

  /**
   * Store a credential securely in Keychain (iOS) / Secure Store (Android)
   */
  async storeCredential(key: string, value: string): Promise<boolean> {
    try {
      await SecureStore.setItemAsync(key, value);
      return true;
    } catch (error) {
      console.error("Failed to store credential:", error);
      return false;
    }
  },

  /**
   * Retrieve a stored credential
   */
  async getCredential(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.error("Failed to get credential:", error);
      return null;
    }
  },

  /**
   * Delete a stored credential
   */
  async deleteCredential(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error("Failed to delete credential:", error);
    }
  },

  /**
   * Clear all stored credentials (logout)
   */
  async clearAllCredentials(): Promise<void> {
    try {
      // On iOS, we can use SecureStore to clear all items
      // This is a simplified approach - in production, track all keys
      const keys = ["device_pairing_key", "session_auth_token", "user_id"];
      for (const key of keys) {
        await this.deleteCredential(key);
      }
    } catch (error) {
      console.error("Failed to clear all credentials:", error);
    }
  },
};
