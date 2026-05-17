import { useCallback, useState, useEffect } from "react";
import {
  biometricService,
  BiometricSession,
} from "@/services/BiometricService";

export interface AuthState {
  isAuthenticated: boolean;
  userId?: string;
  session?: BiometricSession;
  isBiometricAvailable: boolean;
  biometricTypes: string[];
  isAuthenticating: boolean;
  error?: string;
}

/**
 * Enhanced biometric authentication hook with session management
 */
export const useEnhancedBiometrics = () => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    isBiometricAvailable: false,
    biometricTypes: [],
    isAuthenticating: false,
  });

  // Initialize biometric availability on mount
  useEffect(() => {
    const initBiometrics = async () => {
      const available = await biometricService.isBiometricAvailable();
      const types = await biometricService.getAvailableBiometrics();

      setAuthState((prev) => ({
        ...prev,
        isBiometricAvailable: available,
        biometricTypes: types.map((t) => t.toString()),
      }));
    };

    initBiometrics();
  }, []);

  const authenticate = useCallback(
    async (userId: string, reason: string = "Authenticate to continue") => {
      try {
        setAuthState((prev) => ({
          ...prev,
          isAuthenticating: true,
          error: undefined,
        }));

        if (!authState.isBiometricAvailable) {
          throw new Error("Biometric authentication is not available");
        }

        const success = await biometricService.authenticate(reason);
        if (!success) {
          throw new Error("Authentication failed");
        }

        // Generate or retrieve session token
        const token = `token_${Date.now()}_${Math.random().toString(36).slice(2)}`;

        // Create secure session
        const sessionCreated = await biometricService.createSecureSession(
          userId,
          token,
          60,
        );

        if (!sessionCreated) {
          throw new Error("Failed to create secure session");
        }

        setAuthState((prev) => ({
          ...prev,
          isAuthenticated: true,
          userId,
          session: {
            token,
            userId,
            expiresAt: Date.now() + 60 * 60 * 1000,
            createdAt: Date.now(),
          },
          isAuthenticating: false,
        }));

        return true;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Authentication error";
        setAuthState((prev) => ({
          ...prev,
          isAuthenticating: false,
          error: errorMessage,
        }));
        return false;
      }
    },
    [authState.isBiometricAvailable],
  );

  const logout = useCallback(async () => {
    try {
      if (authState.userId) {
        await biometricService.clearSecureSession(authState.userId);
        await biometricService.clearAllCredentials();
      }

      setAuthState({
        isAuthenticated: false,
        isBiometricAvailable: authState.isBiometricAvailable,
        biometricTypes: authState.biometricTypes,
        isAuthenticating: false,
      });

      return true;
    } catch (error) {
      console.error("Logout failed:", error);
      return false;
    }
  }, [
    authState.userId,
    authState.isBiometricAvailable,
    authState.biometricTypes,
  ]);

  const checkSession = useCallback(async (userId: string): Promise<boolean> => {
    try {
      const hasValid = await biometricService.hasValidSession(userId);
      return hasValid;
    } catch (error) {
      console.error("Session check failed:", error);
      return false;
    }
  }, []);

  const storeCredential = useCallback(
    async (key: string, value: string): Promise<boolean> => {
      try {
        return await biometricService.storeCredential(key, value);
      } catch (error) {
        console.error("Failed to store credential:", error);
        return false;
      }
    },
    [],
  );

  const getCredential = useCallback(
    async (key: string): Promise<string | null> => {
      try {
        return await biometricService.getCredential(key);
      } catch (error) {
        console.error("Failed to get credential:", error);
        return null;
      }
    },
    [],
  );

  return {
    ...authState,
    authenticate,
    logout,
    checkSession,
    storeCredential,
    getCredential,
  };
};
