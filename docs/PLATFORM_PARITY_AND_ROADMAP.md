# CrossBeam Platform Parity & Roadmap

## Current Parity

| Area | Android | iOS | Android TV |
| --- | --- | --- | --- |
| Shared React Native UI | Yes | Yes | Yes, with TV focus states |
| Local peer discovery | NSD, BLE, Wi-Fi Direct API | Multipeer Connectivity | NSD, BLE, Wi-Fi Direct API |
| File transfer | `crossbeam-chunk-v3` same-LAN socket stream | `crossbeam-chunk-v2` Multipeer stream | `crossbeam-chunk-v3` same-LAN socket stream |
| Integrity checks | SHA-256 file and chunk checks | SHA-256 file and chunk checks | SHA-256 file and chunk checks |
| Secure storage | Android Keystore | Keychain | Android Keystore |
| Share intake | Android/iOS share intent module | Android/iOS share intent module | Receive-first flow |
| QR pairing | Scan and pair | Scan and pair | Display receiver QR |
| Background/long transfer UX | Keep-awake during active transfer | Keep-awake during active transfer | Keep-awake and receiver status |
| Pause/resume | Active transfer plus checksum-bound partial checkpoints | Chunk checkpoint controls | Active transfer plus checksum-bound partial checkpoints |

## Important Platform Notes

- iOS uses an app-managed Multipeer stream for core transfers so pause/resume/retry can share the same chunk checkpoint model as Android and TV. The legacy MCSession resource delegate remains only as a compatibility fallback for older incoming resource transfers.
- Android TV has Leanback launcher/feature declarations, receiver-first UI, automatic discovery startup, and D-pad focus controls. A final localized store banner and physical-TV validation remain release gates.
- Android/TV v3 publishes received files through scoped-storage-compatible `MediaStore.Downloads` after an app-private partial file passes its full checksum.
- Android transport remains plaintext and unauthenticated. Do not describe a transfer as encrypted or a QR scan as verified until authenticated pairing and session encryption ship.
- Platform-specific features such as Siri Shortcuts, Handoff, and iCloud should remain additive iOS enhancements, not required core parity.

## Implemented Feature Set

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
11. Android share intake: normalize single/multiple files, MIME/size metadata, text, and links.
12. Transfer recovery: persist source descriptors and per-file results, mark process-interrupted jobs honestly, and expose explicit retry.

## UI Enhancements

- Add a device picker sheet before sending when more than one peer is visible.
- Add per-device capability chips: `Multipeer`, `Wi-Fi Direct`, `BLE`, `TV Receiver`.
- Use a compact transfer timeline for history rather than only cards.
- Add TV-specific large typography for transfer progress and remote-friendly spacing.
- Replace generic errors with actionable recovery buttons: retry discovery, open settings, reselect files.
- Add empty states that reflect platform: "Show this QR on TV" vs "Scan a TV or nearby phone".
