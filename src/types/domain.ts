export type ConnectionType = 'wifi-direct' | 'hotspot' | 'lan';

export type Device = {
  id: string;
  name: string;
  platform: 'android' | 'ios' | 'android-tv';
  connection: ConnectionType;
  lastSeenAt: number;
};

export type TransferStatus =
  | 'queued'
  | 'in-progress'
  | 'paused'
  | 'completed'
  | 'failed';

export type TransferJob = {
  id: string;
  fileName: string;
  sizeBytes: number;
  progress: number;
  status: TransferStatus;
  fromDeviceName: string;
  toDeviceName: string;
  encrypted: boolean;
};
