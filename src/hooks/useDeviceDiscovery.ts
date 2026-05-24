import { useCallback, useEffect, useState } from 'react';

import {
  addNearbyDeviceFoundListener,
  addNearbyDeviceLostListener,
  discoverNearbyDevices,
  startNearbyDiscovery,
  stopNearbyDiscovery,
} from '@/services/deviceDiscovery';
import { Device } from '@/types/domain';
import { nativeCrossBeam } from '@/native/crossbeamNative';
import { haptics } from '@/services/haptics';

const AUTO_REFRESH_MS = 12_000;

export const useDeviceDiscovery = (enabled = true) => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshAt, setLastRefreshAt] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState(
    'Scanning is paused. Tap to find nearby devices.',
  );

  const refreshDevices = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const result = await discoverNearbyDevices();
      const capabilities = await nativeCrossBeam.getCapabilities();
      setDevices(result);
      setLastRefreshAt(Date.now());
      setStatusMessage(
        result.length > 0
          ? `Found nearby devices ready for sharing.`
          : capabilities.length > 0
            ? `Scanning for nearby devices...`
            : 'Device scanning is not available on this device.',
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
      setStatusMessage('Scanning is paused. Tap to find nearby devices.');
      return;
    }

    let mounted = true;
    void startNearbyDiscovery()
      .then(() => {
        if (mounted) {
          setStatusMessage('Scanning for nearby devices...');
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
        const existingById = current.find((item) => item.id === device.id);
        const existingByName = current.find((item) => item.name === device.name);
        
        const isIpLike = /^(\d{1,3}\.){3}\d{1,3}$/.test(device.name);
        if (isIpLike && existingById && !/^(\d{1,3}\.){3}\d{1,3}$/.test(existingById.name)) {
          device.name = existingById.name;
        }

        const alreadyFound = existingById || existingByName;
        if (!alreadyFound) {
          void haptics.light();
        }
        
        const existing = current.filter((item) => item.id !== device.id && item.name !== device.name);
        return [device, ...existing];
      });
      setLastRefreshAt(Date.now());
    });

    const removeLost = addNearbyDeviceLostListener((id) => {
      setDevices((current) => current.filter((device) => device.id !== id));
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
