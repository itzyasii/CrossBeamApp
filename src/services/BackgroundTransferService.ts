import { Platform } from "react-native";
import { CrossBeamNative } from "crossbeam-native";

export interface BackgroundTransferConfig {
  url: string;
  method: "GET" | "POST" | "PUT";
  headers?: Record<string, string>;
  timeout?: number;
  retryCount?: number;
}

export interface BackgroundTransferStatus {
  transferId: string;
  progress: number;
  bytesTransferred: number;
  totalBytes: number;
  status: "pending" | "running" | "completed" | "failed" | "paused";
  error?: string;
}

/**
 * Service for handling background transfers on iOS using URLSession
 * This bridges native URLSession background configuration to JavaScript
 */
export const backgroundTransferService = {
  /**
   * Start a background transfer session
   */
  async startBackgroundTransfer(
    transferId: string,
    config: BackgroundTransferConfig,
  ): Promise<boolean> {
    if (Platform.OS !== "ios") {
      console.warn("Background transfer is iOS-specific");
      return false;
    }

    try {
      // Call native iOS background transfer module
      // This would be implemented in native iOS code
      if (CrossBeamNative?.startBackgroundTransfer) {
        await CrossBeamNative.startBackgroundTransfer(transferId, config);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Failed to start background transfer:", error);
      return false;
    }
  },

  /**
   * Get background transfer status
   */
  async getBackgroundTransferStatus(
    transferId: string,
  ): Promise<BackgroundTransferStatus | null> {
    if (Platform.OS !== "ios") return null;

    try {
      if (CrossBeamNative?.getBackgroundTransferStatus) {
        return await CrossBeamNative.getBackgroundTransferStatus(transferId);
      }
      return null;
    } catch (error) {
      console.error("Failed to get background transfer status:", error);
      return null;
    }
  },

  /**
   * Pause a background transfer
   */
  async pauseBackgroundTransfer(transferId: string): Promise<boolean> {
    if (Platform.OS !== "ios") return false;

    try {
      if (CrossBeamNative?.pauseBackgroundTransfer) {
        await CrossBeamNative.pauseBackgroundTransfer(transferId);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Failed to pause background transfer:", error);
      return false;
    }
  },

  /**
   * Resume a paused background transfer
   */
  async resumeBackgroundTransfer(transferId: string): Promise<boolean> {
    if (Platform.OS !== "ios") return false;

    try {
      if (CrossBeamNative?.resumeBackgroundTransfer) {
        await CrossBeamNative.resumeBackgroundTransfer(transferId);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Failed to resume background transfer:", error);
      return false;
    }
  },

  /**
   * Cancel a background transfer
   */
  async cancelBackgroundTransfer(transferId: string): Promise<boolean> {
    if (Platform.OS !== "ios") return false;

    try {
      if (CrossBeamNative?.cancelBackgroundTransfer) {
        await CrossBeamNative.cancelBackgroundTransfer(transferId);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Failed to cancel background transfer:", error);
      return false;
    }
  },

  /**
   * Listen for background transfer progress updates
   */
  addBackgroundTransferListener(
    callback: (status: BackgroundTransferStatus) => void,
  ): (() => void) | null {
    try {
      if (!CrossBeamNative?.addBackgroundTransferListener) {
        return null;
      }

      const unsubscribe =
        CrossBeamNative.addBackgroundTransferListener(callback);
      return unsubscribe || null;
    } catch (error) {
      console.error("Failed to add background transfer listener:", error);
      return null;
    }
  },

  /**
   * Configure background session identifier
   */
  configureBackgroundSession(identifier: string): void {
    if (Platform.OS !== "ios") return;

    try {
      if (CrossBeamNative?.configureBackgroundSession) {
        CrossBeamNative.configureBackgroundSession(identifier);
      }
    } catch (error) {
      console.error("Failed to configure background session:", error);
    }
  },
};
