import { Platform } from "react-native";
import * as AsyncStorage from "@react-native-async-storage/async-storage";

export interface UserActivity {
  activityType:
    | "com.crossbeam.send"
    | "com.crossbeam.receive"
    | "com.crossbeam.browse";
  title: string;
  userInfo?: Record<string, string>;
  webpageURL?: string;
}

export interface ContinuityContext {
  deviceId: string;
  timestamp: number;
  activityType: UserActivity["activityType"];
  data: Record<string, unknown>;
}

/**
 * Service for handling Handoff and Continuity on iOS
 * Allows activities to be continued on other Apple devices
 */
export const handoffService = {
  /**
   * Create an activity for Handoff
   */
  async createActivity(activity: UserActivity): Promise<boolean> {
    if (Platform.OS !== "ios") return false;

    try {
      // Store activity in AsyncStorage for later retrieval
      await AsyncStorage.setItem(
        `activity_${activity.activityType}`,
        JSON.stringify({
          ...activity,
          createdAt: Date.now(),
        }),
      );

      // In a real implementation, this would call native code to register the activity
      // with NSUserActivity for Handoff support
      return true;
    } catch (error) {
      console.error("Failed to create activity:", error);
      return false;
    }
  },

  /**
   * Get current activity
   */
  async getCurrentActivity(): Promise<UserActivity | null> {
    if (Platform.OS !== "ios") return null;

    try {
      const keys = await AsyncStorage.getAllKeys();
      const activityKeys = keys.filter((k) => k.startsWith("activity_"));

      if (activityKeys.length === 0) return null;

      // Get the most recent activity
      const mostRecentKey = activityKeys[0];
      const activityJson = await AsyncStorage.getItem(mostRecentKey);

      if (activityJson) {
        return JSON.parse(activityJson) as UserActivity;
      }

      return null;
    } catch (error) {
      console.error("Failed to get current activity:", error);
      return null;
    }
  },

  /**
   * Create a file send activity for Handoff
   */
  async createSendActivity(
    files: string[],
    targetDeviceId?: string,
  ): Promise<boolean> {
    const activity: UserActivity = {
      activityType: "com.crossbeam.send",
      title: "Sending Files with CrossBeam",
      userInfo: {
        files: files.join(","),
        targetDevice: targetDeviceId || "",
      },
      webpageURL: "https://crossbeam.app/send",
    };

    return this.createActivity(activity);
  },

  /**
   * Create a file receive activity for Handoff
   */
  async createReceiveActivity(deviceId: string): Promise<boolean> {
    const activity: UserActivity = {
      activityType: "com.crossbeam.receive",
      title: "Receiving Files from CrossBeam",
      userInfo: {
        deviceId,
      },
      webpageURL: "https://crossbeam.app/receive",
    };

    return this.createActivity(activity);
  },

  /**
   * Create a browse activity for Handoff
   */
  async createBrowseActivity(
    browsePath?: string,
    query?: string,
  ): Promise<boolean> {
    const activity: UserActivity = {
      activityType: "com.crossbeam.browse",
      title: "Browsing CrossBeam History",
      userInfo: {
        path: browsePath || "root",
        query: query || "",
      },
      webpageURL: "https://crossbeam.app/history",
    };

    return this.createActivity(activity);
  },

  /**
   * Store continuity context for cross-device communication
   */
  async storeContinuityContext(context: ContinuityContext): Promise<boolean> {
    try {
      await AsyncStorage.setItem(
        `continuity_${context.deviceId}`,
        JSON.stringify(context),
      );
      return true;
    } catch (error) {
      console.error("Failed to store continuity context:", error);
      return false;
    }
  },

  /**
   * Retrieve continuity context
   */
  async getContinuityContext(
    deviceId: string,
  ): Promise<ContinuityContext | null> {
    try {
      const contextJson = await AsyncStorage.getItem(`continuity_${deviceId}`);
      if (contextJson) {
        return JSON.parse(contextJson) as ContinuityContext;
      }
      return null;
    } catch (error) {
      console.error("Failed to get continuity context:", error);
      return null;
    }
  },

  /**
   * Clear old continuity contexts
   */
  async cleanupOldContexts(minutesOld: number = 60): Promise<number> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const continuityKeys = keys.filter((k) => k.startsWith("continuity_"));

      const cutoffTime = Date.now() - minutesOld * 60 * 1000;
      let clearedCount = 0;

      for (const key of continuityKeys) {
        const contextJson = await AsyncStorage.getItem(key);
        if (contextJson) {
          const context = JSON.parse(contextJson) as ContinuityContext;
          if (context.timestamp < cutoffTime) {
            await AsyncStorage.removeItem(key);
            clearedCount++;
          }
        }
      }

      return clearedCount;
    } catch (error) {
      console.error("Failed to cleanup contexts:", error);
      return 0;
    }
  },

  /**
   * Enable Handoff support (call once at app startup)
   */
  async enableHandoff(): Promise<void> {
    if (Platform.OS !== "ios") return;

    try {
      // This would be implemented in native iOS code to enable NSUserActivity handoff
      // For now, this is a placeholder for the initialization
      console.log("Handoff enabled");
    } catch (error) {
      console.error("Failed to enable Handoff:", error);
    }
  },

  /**
   * Check if Handoff is available on this device
   */
  async isHandoffAvailable(): Promise<boolean> {
    if (Platform.OS !== "ios") return false;

    try {
      // Check if there are other devices available for Handoff
      // This would require native implementation
      return true; // Placeholder
    } catch (error) {
      console.error("Failed to check Handoff availability:", error);
      return false;
    }
  },
};
