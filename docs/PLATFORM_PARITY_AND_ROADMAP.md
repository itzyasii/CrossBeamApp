# CrossBeam Platform Parity & Roadmap

## Current Parity

| Area | Android | iOS | Android TV |
| --- | --- | --- | --- |
| Shared React Native UI | Yes | Yes | Yes, with TV focus states |
| Local peer discovery | NSD, BLE, Wi-Fi Direct API | Multipeer Connectivity | NSD, BLE, Wi-Fi Direct API |
| File transfer | Socket stream transfer | Multipeer resource transfer | Socket stream transfer |
| Integrity checks | SHA-256 native path | Multipeer encrypted session; checksum work remains | SHA-256 native path |
| Secure storage | Android Keystore | Keychain | Android Keystore |
| Share intake | Android/iOS share intent module | Android/iOS share intent module | Receive-first flow |
| QR pairing | Scan and pair | Scan and pair | Display receiver QR |
| Background/long transfer UX | Keep-awake during active transfer | Keep-awake during active transfer | Keep-awake and receiver status |
| Pause/resume | Basic transfer state controls | Not available with MCSession resources | Basic transfer state controls |

## Important Platform Notes

- iOS Multipeer Connectivity does not expose arbitrary pause/resume for resource transfers. True parity requires an app-managed chunked stream protocol on iOS.
- Android TV should be treated as Android plus receiver-first UX, remote focus, Leanback launcher support, and conservative background behavior.
- Platform-specific features such as Siri Shortcuts, Handoff, and iCloud should remain additive iOS enhancements, not required core parity.

## Recommended Next Features

1. Device trust center: show paired devices, last seen, transport used, and revoke trust.
2. Transfer approval queue: receiver can accept, reject, or always trust a sender.
3. Chunked transfer protocol: unified pause/resume/retry across Android, iOS, and TV.
4. Receiver storage guard: estimate free space before accepting large transfers.
5. LAN diagnostics: show Wi-Fi status, local IP, discovery method, and blocked permissions.
6. TV ambient receiver mode: full-screen QR, recent sender list, and large progress bars.
7. Cross-platform clipboard beam: send text/links alongside files.
8. Transfer collections: group multi-file transfers into named batches.
9. Integrity report: show checksum, duration, speed, and path after completion.
10. Privacy audit screen: explain local-only behavior and show active permissions.

## UI Enhancements

- Add a device picker sheet before sending when more than one peer is visible.
- Add per-device capability chips: `Multipeer`, `Wi-Fi Direct`, `BLE`, `TV Receiver`.
- Use a compact transfer timeline for history rather than only cards.
- Add TV-specific large typography for transfer progress and remote-friendly spacing.
- Replace generic errors with actionable recovery buttons: retry discovery, open settings, reselect files.
- Add empty states that reflect platform: "Show this QR on TV" vs "Scan a TV or nearby phone".

