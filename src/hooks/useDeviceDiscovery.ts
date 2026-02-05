import { useCallback, useEffect, useState } from 'react';

import { discoverNearbyDevices } from '@/services/deviceDiscovery';
import { Device } from '@/types/domain';

const AUTO_REFRESH_MS = 12_000;

export const useDeviceDiscovery = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshAt, setLastRefreshAt] = useState<number | null>(null);

  const refreshDevices = useCallback(async () => {
    setIsRefreshing(true);
    const result = await discoverNearbyDevices();
    setDevices(result);
    setLastRefreshAt(Date.now());
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    void refreshDevices();
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
    refreshDevices,
  };
};
