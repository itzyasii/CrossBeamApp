import { ConnectionType, Device } from "@/types/domain";

const isPoorDeviceName = (name: string): boolean => {
  const normalized = name.trim().toLowerCase();
  if (!normalized || normalized === "nearby device" || normalized === "unknown ble peer") return true;
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(normalized)) return true;
  if (normalized.startsWith("crossbeam-") && normalized.length > 20) return true;
  return false;
};

const normalizedName = (device: Device): string | null =>
  isPoorDeviceName(device.name)
    ? null
    : device.name.trim().toLocaleLowerCase().replace(/\s+/g, " ");

const deviceIdentity = (device: Device): string => device.deviceKey ?? device.id;
const isWifiDirectIdentity = (device: Device): boolean =>
  device.connection === "wifi-direct" || deviceIdentity(device).startsWith("wifi-");

const readinessRank = (device: Device): number =>
  device.isTransferReady || device.availability === "ready"
    ? 3
    : device.availability === "connecting"
      ? 2
      : device.availability === "discovered"
        ? 1
        : 0;

const connectionRank = (connection: ConnectionType): number => {
  if (connection === "local-network" || connection === "lan") return 4;
  if (connection === "wifi-direct" || connection === "hotspot") return 3;
  if (connection === "multipeer") return 2;
  return 1;
};

const mergePair = (existing: Device, device: Device): Device => {
  const preferred =
    readinessRank(device) > readinessRank(existing) ||
    (readinessRank(device) === readinessRank(existing) &&
      connectionRank(device.connection) > connectionRank(existing.connection))
      ? device
      : existing;
  const fallback = preferred === device ? existing : device;
  const connections = new Set<ConnectionType>([
    ...(existing.availableConnections ?? [existing.connection]),
    ...(device.availableConnections ?? [device.connection]),
  ]);
  const stableIdentity = [existing, device].find((item) => !isWifiDirectIdentity(item));

  return {
    ...fallback,
    ...preferred,
    id: stableIdentity?.id ?? preferred.id,
    deviceKey: stableIdentity?.deviceKey ?? preferred.deviceKey,
    name: !isPoorDeviceName(preferred.name) ? preferred.name : fallback.name,
    wifiDirectAddress: device.wifiDirectAddress ?? existing.wifiDirectAddress,
    lastSeenAt: Math.max(existing.lastSeenAt, device.lastSeenAt),
    isTransferReady: Boolean(existing.isTransferReady || device.isTransferReady),
    availableConnections: Array.from(connections).sort(
      (a, b) => connectionRank(b) - connectionRank(a),
    ),
  };
};

export const mergeDiscoveredDevices = (devices: Device[]): Device[] => {
  const exact = new Map<string, Device>();
  devices.forEach((device) => {
    const key = deviceIdentity(device);
    const existing = exact.get(key);
    exact.set(key, existing ? mergePair(existing, device) : device);
  });

  // Wi-Fi Direct exposes its own address rather than CrossBeam's stable key.
  // Correlate only one unique stable peer with one unique direct peer by name.
  const byName = new Map<string, Device[]>();
  exact.forEach((device) => {
    const name = normalizedName(device);
    if (name) byName.set(name, [...(byName.get(name) ?? []), device]);
  });
  const consumed = new Set<string>();
  const merged: Device[] = [];
  exact.forEach((device, key) => {
    if (consumed.has(key)) return;
    const name = normalizedName(device);
    const matches = name ? byName.get(name) ?? [] : [];
    if (
      matches.length === 2 &&
      matches.some(isWifiDirectIdentity) &&
      matches.some((item) => !isWifiDirectIdentity(item))
    ) {
      matches.forEach((item) => consumed.add(deviceIdentity(item)));
      merged.push(mergePair(matches[0], matches[1]));
    } else {
      consumed.add(key);
      merged.push(device);
    }
  });

  return merged.sort((a, b) => {
    const readiness = readinessRank(b) - readinessRank(a);
    return readiness || b.lastSeenAt - a.lastSeenAt;
  });
};
