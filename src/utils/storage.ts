/**
 * AsyncStorage persistence service
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { TransferHistory, AppSettings } from '@/types';
import { APP_CONFIG, DEFAULT_SETTINGS } from '@/constants/config';

class StorageServiceImpl {
  /**
   * Save transfer history
   */
  async addToTransferHistory(transfer: TransferHistory): Promise<void> {
    try {
      const history = await this.getTransferHistory();
      const updated = [transfer, ...history].slice(0, APP_CONFIG.storage.maxHistoryItems);
      await AsyncStorage.setItem(
        APP_CONFIG.storage.historyStorageKey,
        JSON.stringify(updated)
      );
    } catch (error) {
      console.error('Error adding to transfer history:', error);
    }
  }

  async saveTransfer(transfer: TransferHistory): Promise<void> {
    await this.addToTransferHistory(transfer);
  }

  /**
   * Get transfer history
   */
  async getTransferHistory(): Promise<TransferHistory[]> {
    try {
      const data = await AsyncStorage.getItem(APP_CONFIG.storage.historyStorageKey);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting transfer history:', error);
      return [];
    }
  }

  /**
   * Clear transfer history
   */
  async clearTransferHistory(): Promise<void> {
    try {
      await AsyncStorage.removeItem(APP_CONFIG.storage.historyStorageKey);
    } catch (error) {
      console.error('Error clearing transfer history:', error);
    }
  }

  /**
   * Delete specific transfer from history
   */
  async deleteTransferFromHistory(transferId: string): Promise<void> {
    try {
      const history = await this.getTransferHistory();
      const updated = history.filter(t => t.transferId !== transferId);
      await AsyncStorage.setItem(
        APP_CONFIG.storage.historyStorageKey,
        JSON.stringify(updated)
      );
    } catch (error) {
      console.error('Error deleting transfer from history:', error);
    }
  }

  /**
   * Save paired device
   */
  async savePairedDevice(deviceId: string, deviceName: string): Promise<void> {
    try {
      const devices = await this.getPairedDevices();
      if (!devices.find(d => d.id === deviceId)) {
        devices.push({ id: deviceId, name: deviceName, pairedAt: Date.now() });
        await AsyncStorage.setItem(
          APP_CONFIG.storage.devicesStorageKey,
          JSON.stringify(devices)
        );
      }
    } catch (error) {
      console.error('Error saving paired device:', error);
    }
  }

  /**
   * Get paired devices
   */
  async getPairedDevices(): Promise<Array<{ id: string; name: string; pairedAt: number }>> {
    try {
      const data = await AsyncStorage.getItem(APP_CONFIG.storage.devicesStorageKey);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting paired devices:', error);
      return [];
    }
  }

  /**
   * Remove paired device
   */
  async removePairedDevice(deviceId: string): Promise<void> {
    try {
      const devices = await this.getPairedDevices();
      const updated = devices.filter(d => d.id !== deviceId);
      await AsyncStorage.setItem(
        APP_CONFIG.storage.devicesStorageKey,
        JSON.stringify(updated)
      );
    } catch (error) {
      console.error('Error removing paired device:', error);
    }
  }

  /**
   * Get app settings
   */
  async getSettings(): Promise<AppSettings> {
    try {
      const data = await AsyncStorage.getItem(APP_CONFIG.storage.settingsStorageKey);
      return data ? JSON.parse(data) : DEFAULT_SETTINGS;
    } catch (error) {
      console.error('Error getting settings:', error);
      return DEFAULT_SETTINGS;
    }
  }

  /**
   * Update specific setting
   */
  async updateSetting(key: string, value: any): Promise<void> {
    try {
      const settings = await this.getSettings();
      const updated = { ...settings, [key]: value };
      await AsyncStorage.setItem(
        APP_CONFIG.storage.settingsStorageKey,
        JSON.stringify(updated)
      );
    } catch (error) {
      console.error('Error updating setting:', error);
    }
  }

  /**
   * Update all settings
   */
  async updateSettings(settings: Partial<AppSettings>): Promise<void> {
    try {
      const current = await this.getSettings();
      const updated = { ...current, ...settings };
      await AsyncStorage.setItem(
        APP_CONFIG.storage.settingsStorageKey,
        JSON.stringify(updated)
      );
    } catch (error) {
      console.error('Error updating settings:', error);
    }
  }

  /**
   * Clear all data
   */
  async clearAllData(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        APP_CONFIG.storage.historyStorageKey,
        APP_CONFIG.storage.devicesStorageKey,
        APP_CONFIG.storage.settingsStorageKey,
      ]);
    } catch (error) {
      console.error('Error clearing all data:', error);
    }
  }

  /**
   * Get storage size info
   */
  async getStorageInfo(): Promise<{ used: number; free: number }> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      let used = 0;
      for (const key of keys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          used += value.length;
        }
      }
      // Note: This is an approximate calculation
      return { used, free: 0 };
    } catch (error) {
      console.error('Error getting storage info:', error);
      return { used: 0, free: 0 };
    }
  }
}

const storageService = new StorageServiceImpl();

export { storageService as StorageService };
export default storageService;
