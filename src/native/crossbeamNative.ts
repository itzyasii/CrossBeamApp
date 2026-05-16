import { Platform } from 'react-native';

import {
  CrossBeamNative,
  CrossBeamNativeEvents,
  NativePeer,
  NativeTransferRequest,
  NativeTransferEvent,
} from 'crossbeam-native';
import { Device } from '@/types/domain';

const toDevice = (peer: NativePeer): Device => ({
  id: peer.id,
  name: peer.name,
  platform:
    peer.platform === 'android-tv'
      ? 'android-tv'
      : peer.platform === 'ios'
        ? 'ios'
        : 'android',
  connection:
    peer.connection === 'multipeer'
      ? 'multipeer'
      : peer.connection === 'local-network'
        ? 'local-network'
        : peer.connection === 'ble'
          ? 'ble'
          : 'wifi-direct',
  lastSeenAt: peer.lastSeenAt,
});

export const nativeCrossBeam = {
  isRuntimeSupported(): boolean {
    return Platform.OS === 'android' || Platform.OS === 'ios';
  },

  async isAvailable(): Promise<boolean> {
    if (!CrossBeamNative || !this.isRuntimeSupported()) return false;
    return CrossBeamNative.isAvailable();
  },

  async getCapabilities(): Promise<string[]> {
    if (!CrossBeamNative || !this.isRuntimeSupported()) return [];
    return CrossBeamNative.getPlatformCapabilities();
  },

  async startDiscovery(): Promise<void> {
    if (!CrossBeamNative || !this.isRuntimeSupported()) {
      throw new Error('CrossBeam native discovery module is not installed in this runtime.');
    }
    await CrossBeamNative.startDiscovery();
  },

  async stopDiscovery(): Promise<void> {
    if (!CrossBeamNative || !this.isRuntimeSupported()) return;
    await CrossBeamNative.stopDiscovery();
  },

  async getDiscoveredDevices(): Promise<Device[]> {
    if (!CrossBeamNative || !this.isRuntimeSupported()) return [];
    const peers = await CrossBeamNative.getDiscoveredPeers();
    return peers.map(toDevice);
  },

  async sendFiles(request: NativeTransferRequest): Promise<{ transferId: string }> {
    if (!CrossBeamNative || !this.isRuntimeSupported()) {
      throw new Error('CrossBeam native transfer module is not installed in this runtime.');
    }
    return CrossBeamNative.sendFiles(request);
  },

  async cancelTransfer(transferId: string): Promise<void> {
    if (!CrossBeamNative || !this.isRuntimeSupported()) {
      throw new Error('CrossBeam native transfer module is not installed in this runtime.');
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
    const subscription = CrossBeamNativeEvents?.addListener('onPeerFound', (peer: NativePeer) => {
      listener(toDevice(peer));
    });
    return () => subscription?.remove();
  },

  addPeerLostListener(listener: (id: string) => void): () => void {
    const subscription = CrossBeamNativeEvents?.addListener(
      'onPeerLost',
      (event: { id: string }) => {
        listener(event.id);
      },
    );
    return () => subscription?.remove();
  },

  addTransferProgressListener(listener: (event: NativeTransferEvent) => void): () => void {
    const subscription = CrossBeamNativeEvents?.addListener('onTransferProgress', listener);
    return () => subscription?.remove();
  },
};
