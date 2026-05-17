export type Platform = 'android' | 'ios' | 'android-tv' | 'web';

export type DeviceStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'transferring'
  | 'offline'
  | 'error';

export type DeviceCapabilities = {
  supportsWiFiDirect: boolean;
  supportsMultipeer: boolean;
  supportsBluetooth: boolean;
  supportsMdns?: boolean;
  supportsWebSocket?: boolean;
  maxConcurrentTransfers?: number;
};

export type Device = {
  id: string;
  name: string;
  platform: Platform;
  ipAddress: string;
  port: number;
  status: DeviceStatus;
  signalStrength?: number;
  batteryLevel?: number;
  storageAvailable?: number;
  lastSeen: number;
  avatarColor: string;
  capabilities: DeviceCapabilities;
};

export type TransferStatus =
  | 'pending'
  | 'in-progress'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'paused';

export type TransferFile = {
  id: string;
  name: string;
  size: number;
  type: string;
  uri: string;
  bytesTransferred: number;
  checksum?: string;
  error?: string;
};

export type TransferPause = {
  pausedAt: number;
  resumedAt?: number;
};

export type Transfer = {
  id: string;
  fromDevice: Device;
  toDevice: Device;
  files: TransferFile[];
  status: TransferStatus;
  totalBytes: number;
  bytesTransferred: number;
  startTime: number;
  endTime?: number;
  pauses: Array<number | TransferPause>;
  resumeTime?: number;
  speed: number;
  remainingTime: number;
  progress: number;
  error?: string;
};

export type TransferHistory = {
  id: string;
  transferId?: string;
  fromDevice: Pick<Device, 'id' | 'name' | 'platform'>;
  toDevice: Pick<Device, 'id' | 'name' | 'platform'>;
  fileCount: number;
  totalBytes: number;
  status: 'completed' | 'failed' | 'cancelled';
  duration: number;
  timestamp: number;
  speed: number;
  error?: string;
};

export type NetworkState = {
  isWiFiConnected: boolean;
  isInternetReachable: boolean;
  isMetered: boolean;
  ipAddress?: string;
  ssid?: string;
};

export type AppSettings = {
  themePreference?: 'system' | 'light' | 'dark';
  enableNotifications: boolean;
  autoTransfer: boolean;
  enableMeteredNetworks: boolean;
  encryptionEnabled: boolean;
  compressionEnabled: boolean;
  discoveryIntervalMs: number;
};

export type TransferListener = (transfer: Transfer) => void;
export type DeviceDiscoveryListener = (devices: Device[]) => void;
export type NetworkStateListener = (state: NetworkState) => void;

