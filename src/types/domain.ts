  export type ConnectionType = "wifi-direct" | "hotspot" | "lan" | "local-network" | "multipeer" | "ble";

export type DevicePlatform = "android" | "ios" | "android-tv";
export type DeviceAvailability =
  | "discovered"
  | "connecting"
  | "ready"
  | "unavailable";

export type Device = {
  id: string;
  name: string;
  platform: DevicePlatform;
  connection: ConnectionType;
  deviceKey?: string;
  availability?: DeviceAvailability;
  isTransferReady?: boolean;
  statusMessage?: string;
  wifiDirectAddress?: string;
  availableConnections?: ConnectionType[];
  lastSeenAt: number;
  isTrusted?: boolean;
};

export type TransferHistory = TransferJob;

export type TransferStatus =
  | "blocked"
  | "queued"
  | "in-progress"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled"
  | "rejected";

export type SelectedFile = {
  id: string;
  name: string;
  sizeBytes: number;
  mimeType?: string;
  uri: string;
};

export type TransferFileResult = {
  name: string;
  mimeType?: string;
  sizeBytes?: number;
  savedUri?: string;
  checksum?: string;
  integrityVerified: boolean;
  status: "pending" | "transferring" | "completed" | "failed";
  errorMessage?: string;
};

export type TransferJob = {
  id: string;
  // Canonical shape (multi-file support).
  fileNames: string[];
  // Backward compatibility with earlier single-file model.
  fileName?: string;
  sizeBytes: number;
  progress: number;
  bytesTransferred?: number;
  totalBytes?: number;
  status: TransferStatus;
  fromDeviceName: string;
  toDeviceName: string;
  encrypted: boolean;
  startedAt: number;
  updatedAt: number;
  errorMessage?: string;
  mimeType?: string;
  localFilePaths?: string[];
  savedFilePaths?: string[];
  checksum?: string;
  integrityVerified?: boolean;
  peerId?: string;
  sourceFiles?: SelectedFile[];
  fileResults?: TransferFileResult[];
  retryable?: boolean;
};

export type IncomingTransferRequest = {
  id: string;
  fromDeviceName: string;
  fileNames: string[];
  sizeBytes: number;
  requestedAt: number;
};
