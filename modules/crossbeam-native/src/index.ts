import { requireOptionalNativeModule } from 'expo-modules-core';

export type NativePeerPlatform = 'android' | 'android-tv' | 'ios';
export type NativePeerConnection = 'wifi-direct' | 'local-network' | 'multipeer' | 'ble';

export type NativePeer = {
  id: string;
  name: string;
  platform: NativePeerPlatform;
  connection: NativePeerConnection;
  host?: string;
  port?: number;
  isTrusted: boolean;
  lastSeenAt: number;
};

export type NativeSelectedFile = {
  id: string;
  name: string;
  uri: string;
  sizeBytes: number;
  mimeType?: string;
};

export type NativeTransferRequest = {
  peerId: string;
  files: NativeSelectedFile[];
};

export type NativeTransferEvent = {
  transferId: string;
  peerId: string;
  fileName?: string;
  bytesTransferred: number;
  totalBytes: number;
  status: 'queued' | 'in-progress' | 'paused' | 'completed' | 'failed' | 'cancelled';
  errorMessage?: string;
};

export type CrossBeamNativeEventsMap = {
  onPeerFound: (peer: NativePeer) => void;
  onPeerLost: (event: { id: string }) => void;
  onTransferProgress: (event: NativeTransferEvent) => void;
};

export type NativeEventSubscription = {
  remove(): void;
};

export type CrossBeamNativeModule = {
  addListener<EventName extends keyof CrossBeamNativeEventsMap>(
    eventName: EventName,
    listener: CrossBeamNativeEventsMap[EventName],
  ): NativeEventSubscription;
  isAvailable(): Promise<boolean>;
  getPlatformCapabilities(): Promise<string[]>;
  startDiscovery(): Promise<void>;
  stopDiscovery(): Promise<void>;
  getDiscoveredPeers(): Promise<NativePeer[]>;
  sendFiles(request: NativeTransferRequest): Promise<{ transferId: string }>;
  cancelTransfer(transferId: string): Promise<void>;
  pauseTransfer(transferId: string): Promise<void>;
  resumeTransfer(transferId: string): Promise<void>;
  // Phase B: Authentication & Security
  storeSecureValue(alias: String, value: string): Promise<string>;
  retrieveSecureValue(alias: String, encryptedValue: string): Promise<string>;
};

const nativeModule = requireOptionalNativeModule<CrossBeamNativeModule>('CrossBeamNative');

export const CrossBeamNative = nativeModule;
export const CrossBeamNativeEvents = nativeModule;
