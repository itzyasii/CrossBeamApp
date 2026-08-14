# CrossBeam release test matrix

| Area | Required coverage |
| --- | --- |
| Pairing | Valid, expired, malformed, wrong-app, replayed, and altered QR payloads |
| Discovery | Same Wi-Fi, Wi-Fi Direct, Bluetooth denied, location denied, network switch, device timeout |
| Files | Image, video, audio, PDF, text/link, zero-byte file, Unicode name, duplicate name, multi-file batch |
| Size | Small files, 1 GB+, configured maximum, insufficient receiver storage |
| Lifecycle | Foreground, background, locked screen, process restart, service timeout, cancellation |
| Integrity | Truncated stream, wrong checksum, interrupted chunk, retry, resumable checkpoint cleanup |
| Share target | Gallery single/multiple, Files app, browser link/text, unsupported or revoked URI |
| Security | Unknown sender rejection, trusted-device removal, malformed headers, path traversal filenames |
| TV | D-pad only, Back behavior, QR visibility at distance, 720p/1080p/4K, low-RAM device |
| Accessibility | TalkBack labels, focus order, font scaling, contrast, reduced motion expectations |

Record the device model, Android version, sender/receiver roles, transport, file set, result, logs, and reproduction steps for every failure.
