# iOS Industry Standard Features Implementation Guide

## Overview

This document describes the industry standard iOS features implemented for CrossBeamApp in Phase 1. Each feature includes setup instructions, usage examples, and platform-specific considerations.

## Phase 1: Core Share Integration

### 1. Share Extension (File Sharing with Other Apps)

**Location:** `src/services/ShareIntentService.ts`

The Share Extension allows users to share files from other apps into CrossBeam. It uses `expo-share-intent` which is already configured in `app.json`.

#### Key Features:

- Handle incoming files from other apps via Share Sheet
- Support for multiple file types (photos, documents, videos, etc.)
- Listen for share events while app is running
- Clear share data after processing

#### Usage:

```typescript
import { useShareIntent } from '@/services/ShareIntentService';

export function MyScreen() {
  const { sharedData, isLoading, error } = useShareIntent();

  if (sharedData?.files.length > 0) {
    // Handle shared files
    for (const file of sharedData.files) {
      console.log(`Received: ${file.name} (${file.mimeType})`);
    }
  }

  return <View>{/* UI here */}</View>;
}
```

#### Native Configuration (app.json):

Already configured in `app.json` with:

- Support for web URLs, web pages, images, movies, and files
- Custom URL scheme: `crossbeamapp://`
- Activation rules for different content types

#### iOS Target Setup (XCode):

Need to create Share Extension target in XCode:

```
File → New → Target → Share Extension
Set up entitlements for: App Groups, iCloud
Configure NSExtensionActivationRule to match supported types
```

### 2. Receive Share Intent

**Location:** `src/services/ShareIntentService.ts`

Complementary to Share Extension - handles receiving files shared TO CrossBeam.

#### Usage:

```typescript
const hasSharedFiles = await shareIntentService.hasSharedFiles();
const sharedData = await shareIntentService.getSharedFiles();

// Clear after processing
await shareIntentService.clearShareIntent();
```

### 3. Deep Linking & Universal Links

**Location:** `src/services/DeepLinkService.ts` and `src/hooks/useDeepLink.ts`

Enables opening CrossBeam from:

- iMessage/Email links
- Web pages
- Other apps
- Siri Shortcuts
- AirDrop

#### Supported Deep Link Actions:

- `send?deviceId=...&fileName=...` - Open send screen
- `receive` - Open receive mode
- `pair?pairingCode=...` - Pair with device
- `open?transferId=...` - Open transfer details

#### Usage:

```typescript
import { useDeepLink } from '@/hooks/useDeepLink';

export function AppContainer() {
  useDeepLink(); // Automatically handles deep links

  return <Navigation />;
}
```

#### Generate Links Programmatically:

```typescript
import { deepLinkService } from "@/services/DeepLinkService";

// Create a deep link to share
const link = deepLinkService.generateShareableLink("send", {
  deviceId: "device-123",
  fileName: "document.pdf",
});

// Share the link
await Linking.openURL(`mailto:?body=${encodeURIComponent(link)}`);
```

#### iOS Setup (app.json):

Already configured:

- Custom scheme: `crossbeamapp://`
- Associated domains for Universal Links (requires Apple Developer account)

#### Apple-app-site-association (On Server):

Create `/.well-known/apple-app-site-association` on your domain:

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAM_ID.com.crossbeam.app",
        "paths": ["/send/*", "/receive/*", "/pair/*", "/open/*"]
      }
    ]
  }
}
```

### 4. iCloud Sync with CloudKit

**Location:** `src/services/iCloudSyncService.ts`

Syncs transfer history across user's Apple devices via iCloud.

#### Key Features:

- Automatic sync of transfer history
- CloudKit backend for secure cloud storage
- Document-based sync (Documents/CrossBeam directory)
- Automatic cleanup of old synced files

#### Usage:

```typescript
import { iCloudSyncService } from "@/services/iCloudSyncService";

// Initialize on app startup
await iCloudSyncService.initialize();

// Save transfer to sync
await iCloudSyncService.saveTransferToSync({
  id: "transfer-123",
  fileName: "photo.jpg",
  fromDevice: "iPhone",
  toDevice: "iPad",
  timestamp: Date.now(),
  fileSize: 2048576,
  status: "completed",
});

// Retrieve synced transfers
const transfers = await iCloudSyncService.getSyncedTransfers();

// Cleanup old syncs (>30 days)
await iCloudSyncService.cleanupOldSyncs(30);
```

#### iOS Configuration (app.json):

Already configured:

- `com.apple.developer.icloud-container-identifiers`: `iCloud.com.crossbeam.app`
- `NSUbiquitousContainers` with document scope settings
- `UIFileSharingEnabled`: true for Files app integration

#### Enable CloudKit in XCode:

1. Target → Signing & Capabilities
2. Add Capability: iCloud
3. Select "CloudKit" checkbox
4. Container ID: `iCloud.com.crossbeam.app`
5. Enable Document Storage

## App Groups Configuration

**Location:** Configured in `app.json` under `entitlements`

Enables communication between main app and extensions (Share Extension, widgets, etc.).

#### Configuration:

```json
"com.apple.security.application-groups": [
  "group.com.crossbeam.app"
]
```

#### Usage:

```typescript
// Access group container
const groupContainerPath =
  FileSystem.documentDirectory + "group.com.crossbeam.app/";

// Share data between app and extensions
await FileSystem.writeAsStringAsync(
  `${groupContainerPath}shared_files.json`,
  JSON.stringify(files),
);
```

## Next Steps (Future Phases)

### Phase 2: Authentication

- Enhanced biometric auth with session management
- Keychain integration for secure token storage

### Phase 3: Smart Features

- Siri Shortcuts integration
- Handoff & Continuity support
- Advanced deep linking

### Phase 4: Background Operations

- Background file transfers
- Push notifications
- Widgets
- App Clips

## Testing

### On Simulator:

```bash
npm run dev:ios
```

### Share Extension Testing:

1. Open Files app
2. Select a file
3. Tap Share
4. Look for CrossBeam in share sheet
5. Tap CrossBeam to open share extension

### Deep Linking Testing:

```bash
# Test from terminal
xcrun simctl openurl booted "crossbeamapp://send?deviceId=test123"
```

### iCloud Sync Testing:

1. Enable iCloud Documents & Data on device
2. Run app on simulator or device
3. Verify files appear in iCloud Drive under CrossBeam folder

## Security Considerations

1. **App Groups**: Only grant minimum necessary permissions
2. **Keychain**: Use SecureStore for sensitive data only
3. **iCloud**: Files are encrypted at rest; don't store sensitive auth tokens
4. **Deep Links**: Validate all URL parameters to prevent injection attacks
5. **Share Extension**: Validate file types and sizes before processing

## Troubleshooting

### Share Extension not appearing:

- Check app.json NSExtensionActivationRule configuration
- Verify entitlements are set correctly in XCode
- Rebuild development build: `expo run:ios --clean`

### iCloud sync not working:

- Check that iCloud Documents & Data is enabled on device
- Verify CloudKit container ID matches in app.json
- Ensure Capability is enabled in XCode

### Deep links not working:

- Test with: `xcrun simctl openurl booted "crossbeamapp://..."`
- Check that custom scheme matches in app.json
- For Universal Links, verify apple-app-site-association is accessible

## Resources

- [Expo Share Intent Documentation](https://docs.expo.dev/versions/latest/sdk/share-intent/)
- [Expo Linking Documentation](https://docs.expo.dev/versions/latest/sdk/linking/)
- [Apple URLSchemes Documentation](https://developer.apple.com/documentation/xcode/defining-a-custom-url-scheme-for-your-app)
- [iOS Universal Links](https://developer.apple.com/ios/universal-links/)
- [CloudKit Documentation](https://developer.apple.com/icloud/cloudkit/)
- [iOS Share Extension Guide](https://developer.apple.com/design/human-interface-guidelines/share-sheet)
