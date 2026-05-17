import { Platform } from "react-native";
import { iCloudSyncService } from "@/services/iCloudSyncService";
import { deepLinkService } from "@/services/DeepLinkService";
import { handoffService } from "@/services/HandoffService";
import { biometricService } from "@/services/BiometricService";
import { siriShortcutsService } from "@/services/SiriShortcutsService";

/**
 * Initialize all iOS industry standard features
 * Call this once at app startup
 */
export async function initializeIOSFeatures(): Promise<void> {
  if (Platform.OS !== "ios") {
    return;
  }

  try {
    // Initialize iCloud sync
    console.log("[iOS Features] Initializing iCloud sync...");
    await iCloudSyncService.initialize();

    // Configure universal links
    console.log("[iOS Features] Configuring universal links...");
    deepLinkService.configureUniversalLinks();

    // Enable Handoff support
    console.log("[iOS Features] Enabling Handoff...");
    await handoffService.enableHandoff();

    // Log available biometric types
    console.log("[iOS Features] Checking biometric support...");
    const isBioAvailable = await biometricService.isBiometricAvailable();
    if (isBioAvailable) {
      const types = await biometricService.getAvailableBiometrics();
      console.log("[iOS Features] Available biometrics:", types);
    }

    // Check Siri Shortcuts availability
    console.log("[iOS Features] Checking Siri Shortcuts...");
    const hasShortcuts = await siriShortcutsService.isShortcutsInstailable();
    console.log("[iOS Features] Siri Shortcuts available:", hasShortcuts);

    console.log("[iOS Features] All iOS features initialized successfully");
  } catch (error) {
    console.error("[iOS Features] Initialization failed:", error);
  }
}

/**
 * Cleanup iOS features on app exit
 */
export async function cleanupIOSFeatures(): Promise<void> {
  if (Platform.OS !== "ios") {
    return;
  }

  try {
    console.log("[iOS Features] Cleaning up...");

    // Clean up old iCloud synced files
    const cleaned = await iCloudSyncService.cleanupOldSyncs(30);
    console.log(`[iOS Features] Cleaned up ${cleaned} old synced files`);

    // Clean up old continuity contexts
    const clearedContexts = await handoffService.cleanupOldContexts(60);
    console.log(
      `[iOS Features] Cleared ${clearedContexts} old continuity contexts`,
    );

    console.log("[iOS Features] Cleanup complete");
  } catch (error) {
    console.error("[iOS Features] Cleanup failed:", error);
  }
}

/**
 * Get feature availability summary
 */
export async function getIOSFeaturesSummary() {
  if (Platform.OS !== "ios") {
    return null;
  }

  try {
    const iCloudAvailable = await iCloudSyncService.isAvailable();
    const biometricAvailable = await biometricService.isBiometricAvailable();
    const shortcutsAvailable =
      await siriShortcutsService.isShortcutsInstailable();
    const handoffAvailable = await handoffService.isHandoffAvailable();

    return {
      iCloudSync: iCloudAvailable,
      Biometric: biometricAvailable,
      SiriShortcuts: shortcutsAvailable,
      Handoff: handoffAvailable,
    };
  } catch (error) {
    console.error("[iOS Features] Failed to get feature summary:", error);
    return null;
  }
}
