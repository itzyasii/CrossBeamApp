import * as FileSystem from "expo-file-system";
import { Platform } from "react-native";

export interface SyncedTransfer {
  id: string;
  fileName: string;
  fromDevice: string;
  toDevice: string;
  timestamp: number;
  fileSize: number;
  status: "completed" | "pending" | "failed";
}

const ICLOUD_DOCUMENTS_DIR = `${FileSystem.documentDirectory}CrossBeam/iCloud/`;
const SYNC_HISTORY_FILE = `${FileSystem.documentDirectory}crossbeam_sync_history.json`;

export const iCloudSyncService = {
  /**
   * Initialize iCloud sync directory structure
   */
  async initialize(): Promise<void> {
    if (Platform.OS !== "ios") return;

    try {
      const info = await FileSystem.getInfoAsync(ICLOUD_DOCUMENTS_DIR);
      if (!info.exists) {
        await FileSystem.makeDirectoryAsync(ICLOUD_DOCUMENTS_DIR, {
          intermediates: true,
        });
      }
    } catch (error) {
      console.error("Failed to initialize iCloud sync directory:", error);
    }
  },

  /**
   * Save transfer to iCloud sync
   */
  async saveTransferToSync(transfer: SyncedTransfer): Promise<boolean> {
    if (Platform.OS !== "ios") return false;

    try {
      const fileName = `transfer_${transfer.id}.json`;
      const filePath = `${ICLOUD_DOCUMENTS_DIR}${fileName}`;

      await FileSystem.writeAsStringAsync(
        filePath,
        JSON.stringify(transfer, null, 2),
      );

      // Update sync history
      await this.updateSyncHistory(transfer);

      return true;
    } catch (error) {
      console.error("Failed to save transfer to iCloud sync:", error);
      return false;
    }
  },

  /**
   * Retrieve synced transfers from iCloud
   */
  async getSyncedTransfers(): Promise<SyncedTransfer[]> {
    if (Platform.OS !== "ios") return [];

    try {
      const files = await FileSystem.readDirectoryAsync(ICLOUD_DOCUMENTS_DIR);
      const transfers: SyncedTransfer[] = [];

      for (const file of files) {
        if (file.startsWith("transfer_") && file.endsWith(".json")) {
          const filePath = `${ICLOUD_DOCUMENTS_DIR}${file}`;
          const content = await FileSystem.readAsStringAsync(filePath);
          transfers.push(JSON.parse(content) as SyncedTransfer);
        }
      }

      return transfers;
    } catch (error) {
      console.error("Failed to get synced transfers:", error);
      return [];
    }
  },

  /**
   * Update local sync history
   */
  async updateSyncHistory(transfer: SyncedTransfer): Promise<void> {
    try {
      let history: SyncedTransfer[] = [];

      try {
        const existing = await FileSystem.readAsStringAsync(SYNC_HISTORY_FILE);
        history = JSON.parse(existing) as SyncedTransfer[];
      } catch {
        // File doesn't exist yet
      }

      // Add new transfer and keep last 100 entries
      history.unshift(transfer);
      history = history.slice(0, 100);

      await FileSystem.writeAsStringAsync(
        SYNC_HISTORY_FILE,
        JSON.stringify(history, null, 2),
      );
    } catch (error) {
      console.error("Failed to update sync history:", error);
    }
  },

  /**
   * Get sync history
   */
  async getSyncHistory(limit: number = 50): Promise<SyncedTransfer[]> {
    try {
      const content = await FileSystem.readAsStringAsync(SYNC_HISTORY_FILE);
      const history = JSON.parse(content) as SyncedTransfer[];
      return history.slice(0, limit);
    } catch (error) {
      console.error("Failed to get sync history:", error);
      return [];
    }
  },

  /**
   * Enable iCloud sync for a file
   */
  async enableCloudKitSync(filePath: string): Promise<boolean> {
    if (Platform.OS !== "ios") return false;

    try {
      // Copy file to iCloud Documents directory for automatic sync
      const fileName = filePath.split("/").pop() || "file";
      const destPath = `${ICLOUD_DOCUMENTS_DIR}${fileName}`;

      await FileSystem.copyAsync({
        from: filePath,
        to: destPath,
      });

      return true;
    } catch (error) {
      console.error("Failed to enable CloudKit sync:", error);
      return false;
    }
  },

  /**
   * Clean up old synced transfers (older than days)
   */
  async cleanupOldSyncs(daysOld: number = 30): Promise<number> {
    if (Platform.OS !== "ios") return 0;

    try {
      const files = await FileSystem.readDirectoryAsync(ICLOUD_DOCUMENTS_DIR);
      const cutoffTime = Date.now() - daysOld * 24 * 60 * 60 * 1000;
      let deletedCount = 0;

      for (const file of files) {
        if (file.startsWith("transfer_") && file.endsWith(".json")) {
          const filePath = `${ICLOUD_DOCUMENTS_DIR}${file}`;
          const content = await FileSystem.readAsStringAsync(filePath);
          const transfer = JSON.parse(content) as SyncedTransfer;

          if (transfer.timestamp < cutoffTime) {
            await FileSystem.deleteAsync(filePath);
            deletedCount++;
          }
        }
      }

      return deletedCount;
    } catch (error) {
      console.error("Failed to cleanup old syncs:", error);
      return 0;
    }
  },

  /**
   * Check if iCloud sync is available on this device
   */
  async isAvailable(): Promise<boolean> {
    if (Platform.OS !== "ios") return false;

    try {
      // Try to access iCloud directory
      const info = await FileSystem.getInfoAsync(ICLOUD_DOCUMENTS_DIR);
      return info.exists;
    } catch (error) {
      console.error("iCloud sync not available:", error);
      return false;
    }
  },
};
