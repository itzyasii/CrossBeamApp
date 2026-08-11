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

const readinessRank = (device: Device): number =>
  device.isTransferReady || device.availability === 'ready'
    ? 3
    : device.availability === 'connecting'
      ? 2
      : device.availability === 'discovered'
        ? 1
        : 0;

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

    const preferred = readinessRank(device) >= readinessRank(existing) ? device : existing;
    const fallback = preferred === device ? existing : device;

    grouped.set(key, {
      ...fallback,
      ...preferred,
      name,
      lastSeenAt: Math.max(existing.lastSeenAt, device.lastSeenAt),
      isTransferReady: Boolean(existing.isTransferReady || device.isTransferReady),
    });
  });

  return Array.from(grouped.values()).sort(
    (a, b) => b.lastSeenAt - a.lastSeenAt,
  );
};
