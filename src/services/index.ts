/**
 * Services index file
 */

export { default as NetworkService } from "./NetworkService";
export { default as DeviceDiscoveryService } from "./DeviceDiscoveryService";
export { default as FileTransferService } from "./FileTransferService";
export { default as fileTransferService } from "./FileTransferService";

// iOS Industry Standard Features
export { shareIntentService, useShareIntent } from "./ShareIntentService";
export { deepLinkService } from "./DeepLinkService";
export { biometricService } from "./BiometricService";
export { iCloudSyncService } from "./iCloudSyncService";
export { backgroundTransferService } from "./BackgroundTransferService";
export { siriShortcutsService } from "./SiriShortcutsService";
export { handoffService } from "./HandoffService";
