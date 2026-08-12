import { requireOptionalNativeModule } from "expo-modules-core";

export type NativePeerPlatform = "android" | "android-tv" | "ios";
export type NativePeerConnection =
  | "wifi-direct"
  | "local-network"
  | "multipeer"
  | "ble";

export type NativePeer = {
  id: string;
  name: string;
  platform: NativePeerPlatform;
  connection: NativePeerConnection;
  deviceKey?: string;
  availability?: "discovered" | "connecting" | "ready" | "unavailable";
  isTransferReady?: boolean;
  statusMessage?: string;
  wifiDirectAddress?: string;
  availableConnections?: NativePeerConnection[];
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

export type NativeIncomingTransferRequest = {
  transferId: string;
  peerId: string;
  peerName: string;
  fileNames: string[];
  sizeBytes: number;
  requestedAt: number;
};

export type NativeTransferEvent = {
  transferId: string;
  peerId: string;
  fileName?: string;
  mimeType?: string;
  bytesTransferred: number;
  totalBytes: number;
  status:
    | "queued"
    | "in-progress"
    | "paused"
    | "completed"
    | "failed"
    | "rejected"
    | "cancelled";
  errorMessage?: string;
  savedFilePath?: string;
  checksum?: string;
  integrityVerified?: boolean;
};

export type NativeChunkProtocol = {
  protocol: "crossbeam-chunk-v2" | "crossbeam-chunk-v3";
  version: number;
  chunkSizeBytes: number;
  supportsChunkAck: boolean;
  supportsPause: boolean;
  supportsResume: boolean;
  supportsRetry: boolean;
};

export type NativeBackgroundTransferConfig = {
  url: string;
  method: "GET" | "POST" | "PUT";
  headers?: Record<string, string>;
  timeout?: number;
  retryCount?: number;
};

export type NativeBackgroundTransferStatus = {
  transferId: string;
  progress: number;
  bytesTransferred: number;
  totalBytes: number;
  status: "pending" | "running" | "completed" | "failed" | "paused";
  error?: string;
};

export type CrossBeamNativeEventsMap = {
  onPeerFound: (peer: NativePeer) => void;
  onPeerLost: (event: { id: string }) => void;
  onTransferProgress: (event: NativeTransferEvent) => void;
  onIncomingTransferRequest: (request: NativeIncomingTransferRequest) => void;
  onBackgroundTransferProgress: (
    status: NativeBackgroundTransferStatus,
  ) => void;
  onBackgroundTransferStatus: (status: NativeBackgroundTransferStatus) => void;
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
  getChunkProtocol(): Promise<NativeChunkProtocol>;
  startDiscovery(): Promise<void>;
  stopDiscovery(): Promise<void>;
  getDiscoveredPeers(): Promise<NativePeer[]>;
  connectToWifiDirectPeer?(peerId: string): Promise<NativePeer>;
  disconnectWifiDirect?(): Promise<void>;
  cleanupPartialTransfers?(maxAgeMs: number): Promise<number>;
  respondToIncomingTransfer(
    transferId: string,
    accepted: boolean,
  ): Promise<void>;
  sendFiles(request: NativeTransferRequest): Promise<{ transferId: string }>;
  cancelTransfer(transferId: string): Promise<void>;
  pauseTransfer(transferId: string): Promise<void>;
  resumeTransfer(transferId: string): Promise<void>;
  // Phase B: Authentication & Security
  storeSecureValue(alias: string, value: string): Promise<string>;
  retrieveSecureValue(alias: string, encryptedValue: string): Promise<string>;
  startBackgroundTransfer?(
    transferId: string,
    config: NativeBackgroundTransferConfig,
  ): Promise<void>;
  getBackgroundTransferStatus?(
    transferId: string,
  ): Promise<NativeBackgroundTransferStatus | null>;
  pauseBackgroundTransfer?(transferId: string): Promise<void>;
  resumeBackgroundTransfer?(transferId: string): Promise<void>;
  cancelBackgroundTransfer?(transferId: string): Promise<void>;
  addBackgroundTransferListener?(
    callback: (status: NativeBackgroundTransferStatus) => void,
  ): (() => void) | null;
  configureBackgroundSession?(identifier: string): void;
  showIncomingNotification?(
    transferId: string,
    title: string,
    body: string,
  ): Promise<boolean>;
  dismissIncomingNotification?(transferId: string): Promise<boolean>;
  startForegroundService?(): Promise<boolean>;
  stopForegroundService?(): Promise<boolean>;
};

const nativeModule =
  requireOptionalNativeModule<CrossBeamNativeModule>("CrossBeamNative");

export const CrossBeamNative = nativeModule;
export const CrossBeamNativeEvents = nativeModule;
