import * as Linking from "expo-linking";
import { Platform } from "react-native";

export interface DeepLinkParams {
  action?: "send" | "receive" | "open" | "pair";
  deviceId?: string;
  fileName?: string;
  transferId?: string;
  pairingCode?: string;
  [key: string]: string | undefined;
}

const prefix = Linking.createURL("/");

export const deepLinkService = {
  /**
   * Generate a deep link URL for cross-device continuity
   */
  generateDeepLink(action: string, params: Record<string, string>): string {
    const queryParams = new URLSearchParams(params);
    return `${prefix}${action}?${queryParams.toString()}`;
  },

  /**
   * Parse deep link URL to extract action and parameters
   */
  parseDeepLink(url: string): DeepLinkParams | null {
    try {
      const parsed = Linking.parse(url);
      const path = parsed.path?.replace(/^\//, "");

      if (!path) return null;

      // Extract action from path (e.g., "send", "receive", "pair")
      const segments = path.split("/");
      const action = segments[0] as
        | "send"
        | "receive"
        | "open"
        | "pair"
        | undefined;

      // Extract query parameters
      const params: DeepLinkParams = { action };

      if (parsed.queryParams) {
        for (const [key, value] of Object.entries(parsed.queryParams)) {
          if (typeof value === "string") {
            params[key] = value;
          }
        }
      }

      return params;
    } catch (error) {
      console.error("Failed to parse deep link:", error);
      return null;
    }
  },

  /**
   * Listen for deep links when app is running
   */
  addDeepLinkListener(
    callback: (params: DeepLinkParams) => void,
  ): (() => void) | null {
    try {
      const subscription = Linking.addEventListener("url", ({ url }) => {
        const params = this.parseDeepLink(url);
        if (params) {
          callback(params);
        }
      });

      return () => subscription.remove();
    } catch (error) {
      console.error("Failed to add deep link listener:", error);
      return null;
    }
  },

  /**
   * Handle initial URL if app was launched via deep link
   */
  async getInitialURL(): Promise<DeepLinkParams | null> {
    try {
      const url = await Linking.getInitialURL();
      if (url != null) {
        return this.parseDeepLink(url);
      }
    } catch (error) {
      console.error("Failed to get initial URL:", error);
    }
    return null;
  },

  /**
   * Generate a link that can be shared and opened in other apps
   */
  generateShareableLink(
    action: string,
    params: Record<string, string>,
  ): string {
    // On iOS, use the custom scheme. On Android, use http URL if available.
    const scheme =
      Platform.OS === "ios" ? "crossbeamapp://" : "https://crossbeam.app/";
    const queryParams = new URLSearchParams(params);
    return `${scheme}${action}?${queryParams.toString()}`;
  },

  /**
   * Configure Universal Links for iOS
   * This should be called once during app initialization
   */
  configureUniversalLinks(): void {
    if (Platform.OS !== "ios") return;

    // Universal Links are configured via app.json and Apple-app-site-association file on server
    // This is a placeholder for any runtime configuration if needed
    console.log("Universal Links configured for iOS");
  },
};
