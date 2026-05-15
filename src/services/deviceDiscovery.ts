import { Device } from '@/types/domain';
import { nativeCrossBeam } from '@/native/crossbeamNative';

export const discoverNearbyDevices = async (): Promise<Device[]> => {
  if (!(await nativeCrossBeam.isAvailable())) return [];
  return nativeCrossBeam.getDiscoveredDevices();
};

export const startNearbyDiscovery = async (): Promise<void> => {
  if (!(await nativeCrossBeam.isAvailable())) {
    throw new Error('Native discovery is unavailable in this runtime.');
  }
  await nativeCrossBeam.startDiscovery();
};

export const stopNearbyDiscovery = async (): Promise<void> => {
  await nativeCrossBeam.stopDiscovery();
};

export const addNearbyDeviceFoundListener = nativeCrossBeam.addPeerFoundListener;
export const addNearbyDeviceLostListener = nativeCrossBeam.addPeerLostListener;
