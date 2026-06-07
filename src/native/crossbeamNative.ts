import { Platform } from "react-native";

import {
  CrossBeamNative,
  CrossBeamNativeEvents,
  NativeChunkProtocol,
  NativePeer,
  NativeTransferRequest,
  NativeTransferEvent,
} from "crossbeam-native";

export {
  CrossBeamNative,
  CrossBeamNativeEvents,
  NativePeer,
  NativeTransferRequest,
  NativeTransferEvent,
  NativeChunkProtocol,
};
import { Device } from "@/types/domain";

const toDevice = (peer: NativePeer): Device => ({
  id: peer.id,
  name: peer.name,
  deviceKey: peer.deviceKey,
  platform:
    peer.platform === "android-tv"
      ? "android-tv"
      : peer.platform === "ios"
        ? "ios"
        : "android",
  connection:
    peer.connection === "multipeer"
      ? "multipeer"
      : peer.connection === "local-network"
        ? "local-network"
        : peer.connection === "ble"
          ? "ble"
          : "wifi-direct",
  lastSeenAt: peer.lastSeenAt,
});

export const nativeCrossBeam = {
  isRuntimeSupported(): boolean {
    return Platform.OS === "android" || Platform.OS === "ios";
  },

  async isAvailable(): Promise<boolean> {
    if (!CrossBeamNative || !this.isRuntimeSupported()) return false;
    try {
      return await CrossBeamNative.isAvailable();
    } catch (error) {
      console.warn("[Native] Availability check failed:", error);
      return false;
    }
  },

  async getCapabilities(): Promise<string[]> {
    if (!CrossBeamNative || !this.isRuntimeSupported()) return [];
    try {
      return await CrossBeamNative.getPlatformCapabilities();
    } catch (error) {
      console.warn("[Native] Capability check failed:", error);
      return [];
    }
  },

  async getChunkProtocol(): Promise<NativeChunkProtocol | null> {
    if (!CrossBeamNative || !this.isRuntimeSupported()) return null;
    try {
      return await CrossBeamNative.getChunkProtocol();
    } catch (error) {
      console.warn("[Native] Chunk protocol check failed:", error);
      return null;
    }
  },

  async startDiscovery(): Promise<void> {
    if (!CrossBeamNative || !this.isRuntimeSupported()) {
      throw new Error(
        "CrossBeam native discovery module is not installed in this runtime.",
      );
    }
    await CrossBeamNative.startDiscovery();
  },

  async stopDiscovery(): Promise<void> {
    if (!CrossBeamNative || !this.isRuntimeSupported()) return;
    await CrossBeamNative.stopDiscovery().catch((error) => {
      console.warn("[Native] Stop discovery failed:", error);
    });
  },

  async getDiscoveredDevices(): Promise<Device[]> {
    if (!CrossBeamNative || !this.isRuntimeSupported()) return [];
    try {
      const peers = await CrossBeamNative.getDiscoveredPeers();
      return peers.map(toDevice);
    } catch (error) {
      console.warn("[Native] Reading discovered devices failed:", error);
      return [];
    }
  },

  async sendFiles(
    request: NativeTransferRequest,
  ): Promise<{ transferId: string }> {
    if (!CrossBeamNative || !this.isRuntimeSupported()) {
      throw new Error(
        "CrossBeam native transfer module is not installed in this runtime.",
      );
    }
    return CrossBeamNative.sendFiles(request);
  },

  async cancelTransfer(transferId: string): Promise<void> {
    if (!CrossBeamNative || !this.isRuntimeSupported()) {
      throw new Error(
        "CrossBeam native transfer module is not installed in this runtime.",
      );
    }
    await CrossBeamNative.cancelTransfer(transferId);
  },

  async pauseTransfer(transferId: string): Promise<void> {
    if (!CrossBeamNative || !this.isRuntimeSupported()) return;
    await CrossBeamNative.pauseTransfer(transferId);
  },

  async resumeTransfer(transferId: string): Promise<void> {
    if (!CrossBeamNative || !this.isRuntimeSupported()) return;
    await CrossBeamNative.resumeTransfer(transferId);
  },

  addPeerFoundListener(listener: (device: Device) => void): () => void {
    const subscription = CrossBeamNativeEvents?.addListener(
      "onPeerFound",
      (peer: NativePeer) => {
        listener(toDevice(peer));
      },
    );
    return () => subscription?.remove();
  },

  addPeerLostListener(listener: (id: string) => void): () => void {
    const subscription = CrossBeamNativeEvents?.addListener(
      "onPeerLost",
      (event: { id: string }) => {
        listener(event.id);
      },
    );
    return () => subscription?.remove();
  },

  addTransferProgressListener(
    listener: (event: NativeTransferEvent) => void,
  ): () => void {
    const subscription = CrossBeamNativeEvents?.addListener(
      "onTransferProgress",
      listener,
    );
    return () => subscription?.remove();
  },
};
