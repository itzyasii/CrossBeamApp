export type ConnectionType = 'wifi-direct' | 'hotspot' | 'lan';

export type DevicePlatform = 'android' | 'ios' | 'android-tv';

export type Device = {
  id: string;
  name: string;
  platform: DevicePlatform;
  connection: ConnectionType;
  lastSeenAt: number;
};

export type TransferStatus = 'queued' | 'in-progress' | 'paused' | 'completed' | 'failed' | 'rejected';

export type TransferJob = {
  id: string;
  fileNames: string[];
  sizeBytes: number;
  progress: number;
  status: TransferStatus;
  fromDeviceName: string;
  toDeviceName: string;
  encrypted: boolean;
  startedAt: number;
  updatedAt: number;
};

export type IncomingTransferRequest = {
  id: string;
  fromDeviceName: string;
  fileNames: string[];
  sizeBytes: number;
  requestedAt: number;
};
