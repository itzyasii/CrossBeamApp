# CrossBeam Chunked Transfer Protocol

## Protocol

`crossbeam-chunk-v3` is the Android and Android TV socket contract. It is a
breaking revision: v3 peers reject older or newer versions instead of trying to
interpret incompatible framing. iOS remains on `crossbeam-chunk-v2` until its
Multipeer stream is migrated separately.

Each transfer sends a batch header, then streams every file as checkpointed chunks. The receiver writes to a `.crossbeam-part` file, reports the next durable offset after each verified chunk, and promotes the partial file only after the final SHA-256 file checksum passes.

## Required Behavior

| Capability | Android | iOS | Android TV |
| --- | --- | --- | --- |
| Chunk size | 1 MB | 1 MB | 1 MB |
| Receiver checkpoint before send | Yes | Yes | Yes |
| Per-chunk SHA-256 | Yes | Yes | Yes |
| Per-file SHA-256 | Yes | Yes | Yes |
| Explicit receiver accept/reject | v3 | No | v3 |
| File and batch commit ACK | v3 | No | v3 |
| Pause active send/receive | v3 | Yes | v3 |
| Resume from matching partial file | v3 | Yes | v3 |
| Automatic retry after interruption | No | No | No |

## Transfer Flow

1. Sender opens the native transport and sends the transfer header.
2. Receiver validates all counts, lengths, names, MIME values, sizes, and SHA-256 values before asking for approval.
3. Receiver sends an explicit accept/reject response. The sender sends no file bytes before acceptance.
4. Receiver creates or reuses an app-private `.crossbeam-part` file identified by the expected file checksum and returns its current durable offset.
5. Sender seeks exactly to that offset and sends a chunk with offset, bounded byte length, and SHA-256.
6. Receiver verifies the chunk hash, writes and syncs it, then ACKs the exact next offset.
7. Receiver verifies file length and full SHA-256, publishes it through `MediaStore.Downloads`, and sends a file-commit ACK.
8. Receiver sends a final batch-commit ACK only after every file has been published. The sender reports completion only after this ACK.

## Native Transports

Android and Android TV currently use the same-LAN socket transport. Wi-Fi
Direct discovery is not yet a transfer transport. BLE-only discoveries do not
have a transfer endpoint. Android v3 sockets use connection/read timeouts and
strict resource limits, but transport encryption and authenticated pairing are
still required before a production release.
