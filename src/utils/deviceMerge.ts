import { Device } from '@/types/domain';

const isPoorDeviceName = (name: string): boolean => {
  if (!name.trim()) return true;
  if (name === 'Unknown BLE Peer') return true;
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(name)) return true;
  if (name.startsWith('CrossBeam-') && name.length > 20) return true;
  return false;
};

const deviceIdentity = (device: Device): string =>
  device.deviceKey ?? device.id;

export const mergeDiscoveredDevices = (devices: Device[]): Device[] => {
  const grouped = new Map<string, Device>();

  devices.forEach((device) => {
    const key = deviceIdentity(device);
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, device);
      return;
    }

    const preferIncomingName = !isPoorDeviceName(device.name);
    const preferExistingName = !isPoorDeviceName(existing.name);
    const name = preferIncomingName
      ? device.name
      : preferExistingName
        ? existing.name
        : device.name || existing.name;

    grouped.set(key, {
      ...existing,
      ...device,
      name,
      lastSeenAt: Math.max(existing.lastSeenAt, device.lastSeenAt),
      connection:
        device.connection === 'local-network' ||
        existing.connection === 'local-network'
          ? 'local-network'
          : device.connection,
    });
  });

  return Array.from(grouped.values()).sort(
    (a, b) => b.lastSeenAt - a.lastSeenAt,
  );
};
