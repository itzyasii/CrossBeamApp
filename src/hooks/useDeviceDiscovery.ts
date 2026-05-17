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

export const useDeviceDiscovery = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshAt, setLastRefreshAt] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState(
    'Native peer discovery is not available in this Expo runtime.',
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
          ? `Nearby peers discovered via ${capabilities.join(', ')}.`
          : capabilities.length > 0
            ? `Native discovery is active (${capabilities.join(', ')}); no peers are currently visible.`
            : 'Native discovery is unavailable in this runtime. Build a native Android/iOS app to use CrossBeam discovery.',
      );
    } catch (error) {
      setStatusMessage(String(error));
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    void startNearbyDiscovery()
      .then(() => {
        if (mounted) {
          setStatusMessage('Native discovery started.');
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
        const alreadyFound = current.some((item) => item.id === device.id);
        if (!alreadyFound) {
          void haptics.light();
        }
        const existing = current.filter((item) => item.id !== device.id);
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
  }, [refreshDevices]);

  useEffect(() => {
    const interval = setInterval(() => {
      void refreshDevices();
    }, AUTO_REFRESH_MS);

    return () => clearInterval(interval);
  }, [refreshDevices]);

  return {
    devices,
    isRefreshing,
    lastRefreshAt,
    statusMessage,
    refreshDevices,
  };
};
