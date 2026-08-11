import { Platform } from "react-native";

import { nativeCrossBeam } from "@/native/crossbeamNative";

export type ChunkedTransferPlan = {
  chunkSizeBytes: number;
  supportsPause: boolean;
  supportsResume: boolean;
  supportsRetry: boolean;
  retryCount: number;
  protocol: "crossbeam-chunk-v2" | "crossbeam-chunk-v3";
  transport: "local-network-socket" | "multipeer-stream" | "tv-local-network-socket";
  supportsChunkAck: boolean;
};

export const chunkedTransferService = {
  getPlan(): ChunkedTransferPlan {
    const transport = Platform.OS === "ios"
      ? "multipeer-stream"
      : Platform.isTV
        ? "tv-local-network-socket"
        : "local-network-socket";

    if (Platform.OS === "ios") {
      return {
        chunkSizeBytes: 1024 * 1024,
        supportsPause: true,
        supportsResume: true,
        supportsRetry: false,
        supportsChunkAck: true,
        retryCount: 3,
        protocol: "crossbeam-chunk-v2",
        transport,
      };
    }

    return {
      chunkSizeBytes: 1024 * 1024,
      supportsPause: true,
      supportsResume: true,
      supportsRetry: false,
      supportsChunkAck: true,
      retryCount: 3,
      protocol: "crossbeam-chunk-v3",
      transport,
    };
  },

  async getNativePlan(): Promise<ChunkedTransferPlan> {
    const fallback = this.getPlan();
    const nativePlan = await nativeCrossBeam.getChunkProtocol();
    if (!nativePlan) return fallback;

    return {
      ...fallback,
      chunkSizeBytes: nativePlan.chunkSizeBytes,
      supportsPause: nativePlan.supportsPause,
      supportsResume: nativePlan.supportsResume,
      supportsRetry: nativePlan.supportsRetry,
      supportsChunkAck: nativePlan.supportsChunkAck,
      protocol: nativePlan.protocol,
    };
  },

  async pause(transferId: string): Promise<void> {
    await nativeCrossBeam.pauseTransfer(transferId);
  },

  async resume(transferId: string): Promise<void> {
    await nativeCrossBeam.resumeTransfer(transferId);
  },

  async retry(transferId: string): Promise<void> {
    throw new Error(
      `Transfer ${transferId} cannot be retried automatically; reselect the peer and start the transfer again.`,
    );
  },
};
