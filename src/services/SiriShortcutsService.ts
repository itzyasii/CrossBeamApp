import * as Linking from "expo-linking";
import { Platform } from "react-native";

export interface SiriShortcutData {
  name: string;
  description: string;
  actions: ShortcutAction[];
  icon?: string;
  color?: string;
}

export interface ShortcutAction {
  type: "send-file" | "receive-file" | "pair-device" | "open-history";
  params?: Record<string, string>;
}

/**
 * Service for creating and managing Siri Shortcuts
 * Shortcuts are defined via URL schemes and custom intents
 */
export const siriShortcutsService = {
  /**
   * Generate a deep link URL that can be used in Siri Shortcuts
   */
  generateShortcutDeepLink(
    action: string,
    params: Record<string, string>,
  ): string {
    const queryParams = new URLSearchParams(params);
    return `crossbeamapp://${action}?${queryParams.toString()}`;
  },

  /**
   * Create a Siri Shortcut by opening Shortcuts app with configuration
   */
  async createSiriShortcut(shortcut: SiriShortcutData): Promise<boolean> {
    if (Platform.OS !== "ios") return false;

    try {
      let shortcutDefinition = `Begin with ${shortcut.name}\n`;
      shortcutDefinition += `Description: ${shortcut.description}\n`;

      for (const action of shortcut.actions) {
        switch (action.type) {
          case "send-file":
            shortcutDefinition += `Ask for ${action.params?.fileType || "files"}\n`;
            shortcutDefinition += `Open "${this.generateShortcutDeepLink("send", action.params || {})}"\n`;
            break;

          case "receive-file":
            shortcutDefinition += `Open "${this.generateShortcutDeepLink("receive", {})}"\n`;
            break;

          case "pair-device":
            shortcutDefinition += `Ask for pairing code\n`;
            shortcutDefinition += `Open "${this.generateShortcutDeepLink("pair", action.params || {})}"\n`;
            break;

          case "open-history":
            shortcutDefinition += `Open "${this.generateShortcutDeepLink("open", { view: "history" })}"\n`;
            break;
        }
      }

      // Encode for iCloud/Shortcuts app
      const encodedShortcut = encodeURIComponent(shortcutDefinition);
      const shortcutsUrl = `shortcuts://import-shortcut/?url=${encodedShortcut}&name=${encodeURIComponent(shortcut.name)}`;

      return await Linking.openURL(shortcutsUrl);
    } catch (error) {
      console.error("Failed to create Siri Shortcut:", error);
      return false;
    }
  },

  /**
   * Add a predefined "Send File" shortcut
   */
  async addSendFileShortcut(): Promise<boolean> {
    if (Platform.OS !== "ios") return false;

    const shortcut: SiriShortcutData = {
      name: "Send File with CrossBeam",
      description: "Quick action to send files to nearby devices via CrossBeam",
      icon: "paperplane",
      color: "#6366f1",
      actions: [
        {
          type: "send-file",
          params: { fileType: "all" },
        },
      ],
    };

    return this.createSiriShortcut(shortcut);
  },

  /**
   * Add a predefined "Receive File" shortcut
   */
  async addReceiveFileShortcut(): Promise<boolean> {
    if (Platform.OS !== "ios") return false;

    const shortcut: SiriShortcutData = {
      name: "Receive Files with CrossBeam",
      description:
        "Quick action to receive files from nearby devices via CrossBeam",
      icon: "tray.and.arrow.down",
      color: "#06b6d4",
      actions: [
        {
          type: "receive-file",
        },
      ],
    };

    return this.createSiriShortcut(shortcut);
  },

  /**
   * Add a predefined "Quick Pair" shortcut
   */
  async addQuickPairShortcut(): Promise<boolean> {
    if (Platform.OS !== "ios") return false;

    const shortcut: SiriShortcutData = {
      name: "Quick Pair Device",
      description: "Quickly pair with a nearby device using CrossBeam",
      icon: "link",
      color: "#10b981",
      actions: [
        {
          type: "pair-device",
        },
      ],
    };

    return this.createSiriShortcut(shortcut);
  },

  /**
   * Open Shortcuts app to show all CrossBeam shortcuts
   */
  async openShortcutsApp(): Promise<boolean> {
    if (Platform.OS !== "ios") return false;

    try {
      return await Linking.openURL("shortcuts://");
    } catch (error) {
      console.error("Failed to open Shortcuts app:", error);
      return false;
    }
  },

  /**
   * Run a shortcut by name
   */
  async runShortcut(name: string, input?: string): Promise<boolean> {
    if (Platform.OS !== "ios") return false;

    try {
      const params = new URLSearchParams();
      params.append("shortcut", name);
      if (input) {
        params.append("input", input);
      }

      const url = `shortcuts://run-shortcut?${params.toString()}`;
      return await Linking.openURL(url);
    } catch (error) {
      console.error("Failed to run shortcut:", error);
      return false;
    }
  },

  /**
   * Get the Shortcuts import URL for a custom iCloud link
   */
  getShortcutsICloudUrl(shortcutId: string): string {
    return `https://www.icloud.com/shortcuts/${shortcutId}`;
  },

  /**
   * Check if Shortcuts app is installed
   */
  async isShortcutsInstailable(): Promise<boolean> {
    if (Platform.OS !== "ios") return false;

    try {
      const canOpen = await Linking.canOpenURL("shortcuts://");
      return canOpen;
    } catch (error) {
      console.error("Failed to check Shortcuts availability:", error);
      return false;
    }
  },
};
