import { AppSettings, Platform } from '@/types';
import { ApiErrorCode } from '@/types/api';

export const APP_CONFIG = {
  network: {
    discoveryPort: 5353,
    transferPort: 5354,
    connectionTimeoutMs: 10_000,
    deviceTimeoutMs: 60_000,
    discoveryIntervalMs: 3_000,
    maxRetries: 3,
    retryBackoffMs: 500,
  },
  transfer: {
    maxFileSize: 5 * 1024 * 1024 * 1024,
    chunkSize: 1024 * 1024,
    maxConcurrentChunks: 4,
    maxConcurrentTransfers: 5,
    progressUpdateIntervalMs: 500,
    historyLimit: 100,
  },
  storage: {
    maxHistoryItems: 100,
    historyStorageKey: '@crossbeam/transfer-history',
    devicesStorageKey: '@crossbeam/paired-devices',
    settingsStorageKey: '@crossbeam/settings',
  },
  featureFlags: {
    notificationsEnabled: true,
    autoTransferEnabled: false,
    meteredNetworksEnabled: false,
    encryptionEnabled: true,
    compressionEnabled: true,
  },
} as const;

export const PLATFORM_CAPABILITIES: Record<Platform, string[]> = {
  android: ['nsd', 'wifi-direct', 'mdns'],
  ios: ['mdns', 'multipeer-connectivity'],
  'android-tv': ['nsd', 'wifi-direct', 'mdns', 'remote-control-focus'],
  web: ['mdns', 'websocket'],
};

export const DEFAULT_SETTINGS: AppSettings = {
  enableNotifications: true,
  autoTransfer: false,
  enableMeteredNetworks: false,
  encryptionEnabled: true,
  compressionEnabled: true,
  discoveryIntervalMs: APP_CONFIG.network.discoveryIntervalMs,
};

export const ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  NETWORK_UNAVAILABLE: 'Network is unavailable.',
  CONNECTION_FAILED: 'Could not connect to the selected device.',
  TRANSFER_FAILED: 'The transfer failed.',
  FILE_NOT_FOUND: 'The selected file could not be found.',
  INSUFFICIENT_STORAGE: 'The receiving device does not have enough storage.',
  INVALID_FILE_SIZE: 'The selected file size is not supported.',
  TRANSFER_TIMEOUT: 'The transfer timed out.',
  DEVICE_DISCONNECTED: 'The device disconnected.',
  INVALID_TRANSFER_ID: 'The transfer ID is invalid.',
  UNKNOWN_ERROR: 'Something went wrong.',
};

