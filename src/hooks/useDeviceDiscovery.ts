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
import { Platform } from "react-native";

const AUTO_REFRESH_MS = 12_000;

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
          ? `Found nearby devices ready for sharing.`
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
        // Start foreground service on Android so discovery can continue in background
        if (Platform.OS === "android") {
          void nativeCrossBeam.startForegroundService().catch(() => {});
        }
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
      if (Platform.OS === "android") {
        void nativeCrossBeam.stopForegroundService().catch(() => {});
      }
    };
  }, [enabled, refreshDevices]);

  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
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
  };
};
