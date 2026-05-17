# iOS Industry Standard Features - Phase 2-4 Implementation Guide

## Phase 2: Authentication & Security

### Overview

Enhanced biometric authentication with secure session management and Keychain integration for production-grade security.

### Components

#### 2.1 Enhanced Biometric Authentication (`useEnhancedBiometrics`)

Extends basic biometric auth with:

- Session token generation and validation
- Automatic session expiration
- Error tracking and user feedback
- Credential storage in Keychain

**Usage:**

```typescript
import { useEnhancedBiometrics } from '@/hooks/useEnhancedBiometrics';

function LoginScreen() {
  const {
    isAuthenticated,
    authenticate,
    logout,
    isAuthenticating,
    error
  } = useEnhancedBiometrics();

  const handleLogin = async () => {
    const success = await authenticate('user123', 'Login to CrossBeam');
    if (success) {
      // Navigate to main app
    }
  };

  return (
    <Button onPress={handleLogin} disabled={isAuthenticating}>
      {isAuthenticating ? 'Authenticating...' : 'Login with Face ID'}
    </Button>
  );
}
```

#### 2.2 Session Token Management

Secure session handling with automatic refresh:

```typescript
import { biometricService } from "@/services/BiometricService";

// Create session after successful auth
await biometricService.createSecureSession(userId, token, 60); // 60 min expiry

// Check if session is valid
const isValid = await biometricService.hasValidSession(userId);

// Retrieve session (requires biometric auth)
const session = await biometricService.getSecureSession(userId);
```

#### 2.3 Keychain Integration

Secure credential storage:

```typescript
// Store credentials
await biometricService.storeCredential("device_pairing_key", keyValue);
await biometricService.storeCredential("auth_token", tokenValue);

// Retrieve credentials
const key = await biometricService.getCredential("device_pairing_key");

// Clear on logout
await biometricService.clearAllCredentials();
```

### Implementation Checklist

- [ ] Integrate `useEnhancedBiometrics` into login flow
- [ ] Add session validation middleware in navigation
- [ ] Store pairing keys securely in Keychain
- [ ] Implement automatic session refresh
- [ ] Add logout functionality
- [ ] Test on real device with Face ID/Touch ID

---

## Phase 3: Smart Features

### Overview

Advanced iOS features for user engagement and device continuity.

### Components

#### 3.1 Siri Shortcuts Integration

Allow users to create voice commands for quick actions:

**Quick Setup:**

```typescript
import { siriShortcutsService } from '@/services/SiriShortcutsService';

// Add buttons to Settings screen
<Button
  title="Add Send File Shortcut"
  onPress={() => siriShortcutsService.addSendFileShortcut()}
/>

<Button
  title="Add Receive File Shortcut"
  onPress={() => siriShortcutsService.addReceiveFileShortcut()}
/>
```

**Custom Shortcuts:**

```typescript
const customShortcut = {
  name: "Send to Specific Device",
  description: "Quick share to your iPad",
  actions: [
    {
      type: "send-file",
      params: { targetDevice: "iPad-Pro" },
    },
  ],
};

await siriShortcutsService.createSiriShortcut(customShortcut);
```

**Voice Command Example:**

- "Hey Siri, send file with CrossBeam"
- "Hey Siri, receive files"
- "Hey Siri, pair device"

#### 3.2 Handoff & Continuity Support

Continue activities across Apple devices:

**Implementation:**

```typescript
import { handoffService } from "@/services/HandoffService";

// When user starts sending files on iPhone
await handoffService.createSendActivity(["file1.pdf", "file2.jpg"]);

// When user starts receiving
await handoffService.createReceiveActivity("device-id-123");

// On the receiving device, continue activity
const activity = await handoffService.getCurrentActivity();
if (activity?.activityType === "com.crossbeam.send") {
  // Auto-navigate to receive screen
}
```

**Continuity Types:**

- Send Files → Continue on iPad/Mac
- Receive Files → Continue on different device
- Browse History → Resume on iPhone

#### 3.3 App Groups Setup

Enable communication between main app and extensions:

**Configuration (Already in app.json):**

```json
"com.apple.security.application-groups": [
  "group.com.crossbeam.app"
]
```

**Usage:**

```typescript
// Shared storage for extensions
const groupPath = `${FileSystem.documentDirectory}group.com.crossbeam.app/`;

// Share data with extension
const sharedData = { files: [...], timestamp: Date.now() };
await FileSystem.writeAsStringAsync(
  `${groupPath}transfer_data.json`,
  JSON.stringify(sharedData)
);

// Extension can read this data
```

### Implementation Checklist

- [ ] Create Siri Shortcuts UI in Settings
- [ ] Test voice commands with Siri
- [ ] Implement activity creation at key points
- [ ] Test Handoff between devices
- [ ] Verify App Groups data sharing
- [ ] Test extension communication

---

## Phase 4: Background Operations & Advanced

### Overview

Production-grade background transfers, notifications, widgets, and app clips.

### Components

#### 4.1 Background File Transfer

Using URLSession for transfers that survive app backgrounding:

**Implementation:**

```typescript
import { backgroundTransferService } from "@/services/BackgroundTransferService";

// Configure background session
backgroundTransferService.configureBackgroundSession(
  "com.crossbeam.bg-transfer",
);

// Start background transfer
const success = await backgroundTransferService.startBackgroundTransfer(
  "transfer-123",
  {
    url: "https://device.local:5000/transfer",
    method: "POST",
    timeout: 300000, // 5 minutes
    retryCount: 3,
  },
);

// Listen for progress
const unsubscribe = backgroundTransferService.addBackgroundTransferListener(
  (status) => {
    console.log(`Transfer: ${status.progress * 100}%`);
  },
);

// Pause/Resume/Cancel
await backgroundTransferService.pauseBackgroundTransfer(transferId);
await backgroundTransferService.resumeBackgroundTransfer(transferId);
await backgroundTransferService.cancelBackgroundTransfer(transferId);
```

#### 4.2 Push Notifications

Real-time transfer status updates:

**Enhanced Notifications:**

```typescript
import { notificationService } from "@/services/notificationService";

// Track transfer progress
const onProgress = (progress) => {
  await notificationService.updateProgress(transferId, fileName, progress);
};

// Completion notification
const onComplete = () => {
  await notificationService.showComplete(fileName);
};
```

**Native Setup in XCode:**

1. Target → Signing & Capabilities
2. Add "Push Notifications"
3. Configure APNs certificate

#### 4.3 Lock Screen & Home Screen Widgets

Quick access widgets for iOS 16+:

**Widget Types:**

- Lock Screen: Show recent transfers, quick send button
- Home Screen: Transfer history, device status
- Smart Stack: Contextual widgets

**Implementation Strategy:**

1. Create WidgetKit target in XCode
2. Define widget entry point (timeline data)
3. Create SwiftUI widget views
4. Share data via App Groups

**Example Widget Data:**

```typescript
interface WidgetData {
  recentTransfers: Transfer[];
  activeTransfersCount: number;
  lastSyncTime: number;
  isOnline: boolean;
}

// Update widget data in App Groups container
const widgetPath = `${groupPath}widget_data.json`;
await FileSystem.writeAsStringAsync(widgetPath, JSON.stringify(widgetData));
```

#### 4.4 App Clips

Sub-5MB app slice for quick file transfer without full app installation:

**Use Cases:**

- Receive file via AirDrop → Run app clip
- Scan QR code → Launch app clip
- Click link → Install and run app clip

**App Clip Features:**

- Request user permission for Camera/Files
- Handle deep link to specific transfer
- Suggest full app installation

**Implementation:**

```typescript
// Detect if running in app clip
import { ExpoClipService } from '@/services/ExpoClipService';

if (ExpoClipService.isRunningInAppClip()) {
  // Show "Get Full App" button after successful action
  <Button
    title="Get Full CrossBeam App"
    onPress={() => Linking.openURL('https://apps.apple.com/...')}
  />
}
```

### Implementation Checklist

- [ ] Implement URLSession background transfer bridge
- [ ] Add background transfer UI indicators
- [ ] Configure push notifications backend
- [ ] Create WidgetKit targets in XCode
- [ ] Design lock screen widgets
- [ ] Test widgets with sample data
- [ ] Create app clip target in XCode
- [ ] Test app clip installation flow
- [ ] Implement full app upsell in app clip

---

## Testing Strategy by Phase

### Phase 2: Authentication

- [ ] Test Face ID on simulator (Settings → Device → Face ID)
- [ ] Test Touch ID on real device
- [ ] Test session expiration (modify timestamp in Keychain)
- [ ] Test credential storage and retrieval
- [ ] Test logout clears credentials

### Phase 3: Smart Features

- [ ] Test Siri Shortcuts with different actions
- [ ] Test Handoff between iPhone and iPad
- [ ] Test App Groups data sharing (use App Groups container in Xcode)
- [ ] Record Siri commands
- [ ] Test activity continuation

### Phase 4: Background & Advanced

- [ ] Test background transfer with network throttling
- [ ] Kill app during transfer and verify resumption
- [ ] Test widget data updates in real-time
- [ ] Test lock screen widget with different data
- [ ] Install and test app clip on real device
- [ ] Test app clip → full app upgrade flow

---

## Deployment Considerations

### Code Signing

All features require valid Apple Developer account:

- Team ID in provisioning profile
- Signing certificates for development/distribution
- Entitlements file with all capabilities

### App Store Guidelines

1. **Background Transfers**: Must use URLSession (not NSURLConnection)
2. **Widgets**: Must use WidgetKit, not Notification Center
3. **Siri**: Must have clear user value
4. **Handoff**: Transparent data handling
5. **App Clips**: Must request minimal permissions

### Privacy & Security

- Keychain for sensitive data (not UserDefaults)
- CloudKit for sync (automatic encryption)
- Request location permission only if needed
- No unsolicited notifications
- Implement privacy labels in App Store Connect

---

## Future Enhancements

1. **Spatial Computing**
   - visionOS app for Apple Vision Pro
   - Immersive transfer UI

2. **Health Integration**
   - Activity tracking for transfers
   - HealthKit integration

3. **HomeKit Integration**
   - Control HomeKit scenes before/after transfer
   - Home hub automation

4. **Wallet Integration**
   - Pairing pass in Apple Wallet
   - Express mode support

5. **CarPlay Support**
   - Audio-only transfer controls
   - Siri voice commands while driving
