# CrossBeamApp

CrossBeam is an ad-free React Native / Expo app shell for local, private file
sharing across Android phones, Android TV, and iOS phones.

## Current Status

This build intentionally does not fake peer discovery or file transfer. It
supports real file selection through the platform document picker, persistent
local settings/history foundations, and an honest UI that reports when native
transfer capabilities are unavailable.

Real Wi-Fi Direct, Android foreground transfer services, Android TV receive
mode, and iOS Multipeer Connectivity require native modules that are not
available from JavaScript in the Expo runtime alone.

## What Works Now

- Ad-free UI
- Real system document picker via `expo-document-picker`
- No fabricated nearby devices
- No simulated transfer progress
- Type-safe service and storage foundations
- Metallic / crystal design tokens
- Offline app startup
- Transfer history and settings storage wrappers

## Native Work Required

This repository now includes a local native module package at
`modules/crossbeam-native`.

Implemented native bridge surface:

- Android: DNS-SD / NSD discovery for `_crossbeam._tcp.` peers
- iOS: Multipeer Connectivity advertiser/browser for `crossbeam` peers
- Shared TypeScript adapter consumed by the app
- Platform permission declarations for local network, Wi-Fi, notifications, and
  foreground data sync

Remaining native work to meet the full production acceptance criteria:

- Android Wi-Fi Direct / Wi-Fi P2P group negotiation and socket transport
- Android foreground service and transfer progress notifications
- Android share target integration
- Android TV launcher, D-pad focus, receive mode, and large-file storage flow
- iOS authenticated invitation handling and MCSession resource transfer
- iOS Files save flow
- Secure pairing, key storage, session keys, streaming encryption, checksums,
  resumable checkpoints, and transfer queue persistence

Until the transfer adapters exist, CrossBeam refuses to show fake successful
transfers.

## Setup

```bash
npm install
npm run start
```

For native development builds:

```bash
npm run prebuild
npm run android
npm run ios
```

The native discovery bridge is not available in Expo Go. Use `expo run:android`,
`expo run:ios`, or an EAS development build.

For web preview:

```bash
npm run web
```

## Validation

```bash
npm run typecheck
npm run lint
```

## Platform Limitations

- Expo JavaScript cannot directly implement Android Wi-Fi Direct group
  negotiation or socket server foreground services.
- Expo JavaScript cannot directly implement iOS Multipeer Connectivity sessions.
- Background transfer behavior differs by operating system and must be handled
  in native code.
- Large-file transfer must be streamed in native code to avoid loading complete
  files into memory.

## Security Direction

The production transfer engine should use:

- Explicit receiver confirmation
- Device pairing with numeric or QR verification
- Secure key storage
- Session keys per transfer
- Streaming encryption when the transport is not already protected
- Checksum validation after transfer
- Path traversal protection for received filenames
