import { Device } from '@/types/domain';

const SAMPLE_DEVICES: Omit<Device, 'lastSeenAt'>[] = [
  { id: 'd1', name: 'Nina iPhone 15', platform: 'ios', connection: 'lan' },
  { id: 'd2', name: 'Pixel 8 Pro', platform: 'android', connection: 'wifi-direct' },
  { id: 'd3', name: 'Living Room TV', platform: 'android-tv', connection: 'hotspot' },
];

export const discoverNearbyDevices = async (): Promise<Device[]> => {
  await new Promise((resolve) => setTimeout(resolve, 600));
  const now = Date.now();
  return SAMPLE_DEVICES.map((device) => ({ ...device, lastSeenAt: now }));
};
