import { Platform } from "react-native";

import { nativeCrossBeam } from "@/native/crossbeamNative";

export type ChunkedTransferPlan = {
  chunkSizeBytes: number;
  supportsPause: boolean;
  supportsResume: boolean;
  supportsRetry: boolean;
  retryCount: number;
  protocol: "socket-chunks" | "multipeer-resource" | "tv-socket-chunks";
};

export const chunkedTransferService = {
  getPlan(): ChunkedTransferPlan {
    if (Platform.OS === "ios") {
      return {
        chunkSizeBytes: 1024 * 1024,
        supportsPause: false,
        supportsResume: false,
        supportsRetry: true,
        retryCount: 3,
        protocol: "multipeer-resource",
      };
    }

    return {
      chunkSizeBytes: 1024 * 1024,
      supportsPause: true,
      supportsResume: true,
      supportsRetry: true,
      retryCount: 3,
      protocol: Platform.isTV ? "tv-socket-chunks" : "socket-chunks",
    };
  },

  async pause(transferId: string): Promise<void> {
    await nativeCrossBeam.pauseTransfer(transferId);
  },

  async resume(transferId: string): Promise<void> {
    await nativeCrossBeam.resumeTransfer(transferId);
  },

  async retry(transferId: string): Promise<void> {
    await nativeCrossBeam.resumeTransfer(transferId);
  },
};

