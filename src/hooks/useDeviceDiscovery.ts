import { useCallback, useEffect, useState } from "react";

import {
  addNearbyDeviceFoundListener,
  addNearbyDeviceLostListener,
  discoverNearbyDevices,
  startNearbyDiscovery,
  stopNearbyDiscovery,
} from "@/services/deviceDiscovery";
import { Device } from "@/types/domain";
import { mergeDiscoveredDevices } from "@/utils/deviceMerge";
import { nativeCrossBeam } from "@/native/crossbeamNative";
import { haptics } from "@/services/haptics";

const AUTO_REFRESH_MS = 12_000;
const STALE_UNREADY_PEER_MS = 30_000;

export const useDeviceDiscovery = (enabled = true) => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshAt, setLastRefreshAt] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState(
    "Scanning is paused. Tap to find nearby devices.",
  );

  const refreshDevices = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const result = mergeDiscoveredDevices(await discoverNearbyDevices());
      const capabilities = await nativeCrossBeam.getCapabilities();
      setDevices(result);
      setLastRefreshAt(Date.now());
      setStatusMessage(
        result.length > 0
          ? `${result.length} nearby; ${result.filter((device) => device.isTransferReady).length} ready to receive.`
          : capabilities.length > 0
            ? `Scanning for nearby devices...`
            : "Device scanning is not available on this device.",
      );
    } catch (error) {
      setStatusMessage(String(error));
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const connectDevice = useCallback(async (deviceId: string) => {
    setDevices((current) =>
      current.map((device) =>
        device.id === deviceId
          ? { ...device, availability: "connecting", statusMessage: "Connecting with Wi-Fi Direct..." }
          : device,
      ),
    );
    try {
      const connected = await nativeCrossBeam.connectToWifiDirectPeer(deviceId);
      setDevices((current) => mergeDiscoveredDevices([connected, ...current]));
      return connected;
    } catch (error) {
      setDevices((current) =>
        current.map((device) =>
          device.id === deviceId
            ? { ...device, availability: "unavailable", isTransferReady: false, statusMessage: String(error) }
            : device,
        ),
      );
      throw error;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setDevices([]);
      setStatusMessage("Scanning is paused. Tap to find nearby devices.");
      return;
    }

    let mounted = true;
    void startNearbyDiscovery()
      .then(() => {
        if (mounted) {
          setStatusMessage("Scanning for nearby devices...");
        }
      })
      .catch((error) => {
        if (mounted) {
          setStatusMessage(String(error));
        }
      })
      .finally(() => {
        if (mounted) void refreshDevices();
      });

    const removeFound = addNearbyDeviceFoundListener((device) => {
      setDevices((current) => {
        const merged = mergeDiscoveredDevices([device, ...current]);
        const alreadyFound = current.some(
          (item) =>
            item.id === device.id ||
            (item.deviceKey && item.deviceKey === device.deviceKey),
        );
        if (!alreadyFound) {
          void haptics.light();
        }
        return merged;
      });
      setLastRefreshAt(Date.now());
    });

    const removeLost = addNearbyDeviceLostListener((id) => {
      setDevices((current) =>
        current.filter((device) => device.id !== id && device.deviceKey !== id),
      );
      setLastRefreshAt(Date.now());
    });

    return () => {
      mounted = false;
      removeFound();
      removeLost();
      void stopNearbyDiscovery();
    };
  }, [enabled, refreshDevices]);

  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      const cutoff = Date.now() - STALE_UNREADY_PEER_MS;
      setDevices((current) =>
        current.filter(
          (device) =>
            device.isTransferReady ||
            device.connection === "local-network" ||
            device.lastSeenAt >= cutoff,
        ),
      );
      void refreshDevices();
    }, AUTO_REFRESH_MS);

    return () => clearInterval(interval);
  }, [enabled, refreshDevices]);

  return {
    devices,
    isRefreshing,
    lastRefreshAt,
    statusMessage,
    refreshDevices,
    connectDevice,
  };
};
