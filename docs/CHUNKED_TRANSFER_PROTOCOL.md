# CrossBeam Chunked Transfer Protocol

## Protocol

`crossbeam-chunk-v2` is the native transfer contract used by Android, iOS, and Android TV.

Each transfer sends a batch header, then streams every file as checkpointed chunks. The receiver writes to a `.crossbeam-part` file, reports the next durable offset after each verified chunk, and promotes the partial file only after the final SHA-256 file checksum passes.

## Required Behavior

| Capability | Android | iOS | Android TV |
| --- | --- | --- | --- |
| Chunk size | 1 MB | 1 MB | 1 MB |
| Receiver checkpoint before send | Yes | Yes | Yes |
| Per-chunk SHA-256 | Yes | Yes | Yes |
| Per-file SHA-256 | Yes | Yes | Yes |
| Pause active send | Yes | Yes | Yes |
| Resume from partial file | Yes | Yes | Yes |
| Retry after interruption | Yes | Yes | Yes |

## Transfer Flow

1. Sender opens the native transport and sends the transfer header.
2. Receiver creates or reuses a `.crossbeam-part` file and returns the current durable offset.
3. Sender seeks to that offset and sends a chunk with offset, byte length, and SHA-256.
4. Receiver verifies the chunk hash, writes it, and ACKs the next offset.
5. Sender continues only after the ACK.
6. Receiver verifies the completed file hash and renames the partial file into the CrossBeam downloads folder.

## Native Transports

Android and Android TV use the local-network socket transport. iOS uses an app-managed Multipeer stream because MCSession resource transfers do not expose checkpoint control. Both transports expose the same app-facing protocol metadata through `getChunkProtocol`.
