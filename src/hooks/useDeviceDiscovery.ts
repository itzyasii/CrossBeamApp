import { useCallback, useEffect, useRef, useState } from "react";
import * as Network from "expo-network";

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
import { friendlyErrorMessage } from "@/utils/userMessage";

const AUTO_REFRESH_MS = 12_000;
const STALE_UNREADY_PEER_MS = 30_000;

const describeRoute = (
  device: Device,
  networkType: Network.NetworkStateType | undefined,
): Device => {
  if (device.availability === "connecting") {
    return { ...device, statusMessage: "Connecting…" };
  }
  if (device.availability === "unavailable") {
    return { ...device, statusMessage: "Not available right now" };
  }
  if (device.isTransferReady && device.connection === "local-network") {
    return { ...device, statusMessage: "Ready to share" };
  }
  if (device.isTransferReady && device.connection === "wifi-direct") {
    return { ...device, statusMessage: "Ready to share" };
  }
  if (device.connection === "wifi-direct" || device.wifiDirectAddress) {
    return { ...device, statusMessage: "Nearby — tap Connect" };
  }
  if (device.connection === "ble") {
    return {
      ...device,
      statusMessage:
        networkType === Network.NetworkStateType.WIFI
          ? "Nearby, but not ready yet"
          : "Nearby — turn on Wi-Fi to connect",
    };
  }
  return device;
};

const scanningMessage = (
  networkType: Network.NetworkStateType | undefined,
  deviceCount: number,
  readyCount: number,
): string => {
  if (deviceCount > 0) return `${deviceCount} found · ${readyCount} ready`;
  if (networkType === Network.NetworkStateType.WIFI) {
    return "Looking for nearby devices…";
  }
  if (networkType === Network.NetworkStateType.CELLULAR) {
    return "Turn on Wi-Fi to find and share with nearby devices.";
  }
  if (networkType === Network.NetworkStateType.NONE) {
    return "Turn on Wi-Fi and Bluetooth to find nearby devices.";
  }
  return "Looking for nearby devices…";
};

export const useDeviceDiscovery = (enabled = true) => {
  const [devices, setDevices] = useState<Device[]>([]);
  const devicesRef = useRef<Device[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshAt, setLastRefreshAt] = useState<number | null>(null);
  const networkTypeRef = useRef<Network.NetworkStateType | undefined>(undefined);
  const [statusMessage, setStatusMessage] = useState(
    "Tap Find devices when you're ready.",
  );

  useEffect(() => {
    devicesRef.current = devices;
  }, [devices]);

  const refreshDevices = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const currentNetwork = await Network.getNetworkStateAsync().catch(() => ({ type: networkTypeRef.current }));
      const routeType = currentNetwork.type ?? networkTypeRef.current;
      networkTypeRef.current = routeType;
      const result = mergeDiscoveredDevices(await discoverNearbyDevices()).map((device) =>
        describeRoute(device, routeType),
      );
      const capabilities = await nativeCrossBeam.getCapabilities();
      setDevices(result);
      setLastRefreshAt(Date.now());
      setStatusMessage(
        capabilities.length > 0
          ? scanningMessage(
              routeType,
              result.length,
              result.filter((device) => device.isTransferReady).length,
            )
            : "Nearby sharing isn't available on this device.",
      );
    } catch (error) {
      setStatusMessage(friendlyErrorMessage(error));
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void Network.getNetworkStateAsync().then((state) => {
      networkTypeRef.current = state.type;
    }).catch(() => {});
    const subscription = Network.addNetworkStateListener((state) => {
      networkTypeRef.current = state.type;
      const current = devicesRef.current;
      const updated = current.map((device) => describeRoute(device, state.type));
      setDevices(updated);
      if (enabled) {
        setStatusMessage(
          scanningMessage(
            state.type,
            updated.length,
            updated.filter((device) => device.isTransferReady).length,
          ),
        );
      }
    });
    return () => subscription.remove();
  }, [enabled]);

  const connectDevice = useCallback(async (deviceId: string) => {
    setDevices((current) =>
      current.map((device) =>
        device.id === deviceId
          ? { ...device, availability: "connecting", statusMessage: "Connecting…" }
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
            ? { ...device, availability: "unavailable", isTransferReady: false, statusMessage: friendlyErrorMessage(error) }
            : device,
        ),
      );
      throw error;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setDevices([]);
      setStatusMessage("Tap Find devices when you're ready.");
      return;
    }

    let mounted = true;
    void startNearbyDiscovery()
      .then(() => {
        if (mounted) {
          setStatusMessage("Looking for nearby devices…");
        }
      })
      .catch((error) => {
        if (mounted) {
          setStatusMessage(friendlyErrorMessage(error));
        }
      })
      .finally(() => {
        if (mounted) void refreshDevices();
      });

    const removeFound = addNearbyDeviceFoundListener((device) => {
      setDevices((current) => {
        const merged = mergeDiscoveredDevices([device, ...current]).map((item) =>
          describeRoute(item, networkTypeRef.current),
        );
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
