import { Device, NetworkState, Platform, Transfer, TransferStatus } from './index';

export type ApiErrorCode =
  | 'NETWORK_UNAVAILABLE'
  | 'CONNECTION_FAILED'
  | 'TRANSFER_FAILED'
  | 'FILE_NOT_FOUND'
  | 'INSUFFICIENT_STORAGE'
  | 'INVALID_FILE_SIZE'
  | 'TRANSFER_TIMEOUT'
  | 'DEVICE_DISCONNECTED'
  | 'INVALID_TRANSFER_ID'
  | 'UNKNOWN_ERROR';

export type ErrorResponse = {
  ok: false;
  code: ApiErrorCode;
  message: string;
  details?: unknown;
};

export type SuccessResponse<T> = {
  ok: true;
  data: T;
};

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

export type DeviceDiscoveryRequest = {
  requesterId: string;
  platform: Platform;
  capabilities: string[];
};

export type DeviceDiscoveryResponse = {
  devices: Device[];
  network: NetworkState;
  discoveredAt: number;
};

export type DeviceConnectionRequest = {
  deviceId: string;
  pin?: string;
};

export type DeviceConnectionResponse = {
  device: Device;
  sessionId: string;
  expiresAt: number;
};

export type TransferInitiationRequest = {
  fromDeviceId: string;
  toDeviceId: string;
  files: Array<{
    name: string;
    size: number;
    type: string;
    checksum?: string;
  }>;
};

export type TransferInitiationResponse = {
  transfer: Transfer;
  uploadUrl?: string;
  chunkSize: number;
};

export type FileChunkRequest = {
  transferId: string;
  fileId: string;
  chunkIndex: number;
  totalChunks: number;
  offset: number;
  bytes: ArrayBuffer;
  checksum?: string;
};

export type FileChunkResponse = {
  transferId: string;
  fileId: string;
  chunkIndex: number;
  bytesReceived: number;
};

export type TransferProgressResponse = {
  transferId: string;
  status: TransferStatus;
  bytesTransferred: number;
  totalBytes: number;
  progress: number;
  speed: number;
  remainingTime: number;
};

export type TransferControlRequest = {
  transferId: string;
  action: 'pause' | 'resume' | 'cancel';
};

export type TransferControlResponse = {
  transferId: string;
  status: TransferStatus;
};

