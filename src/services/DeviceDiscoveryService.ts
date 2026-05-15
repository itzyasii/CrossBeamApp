/**
 * Device discovery service for peer detection
 */

import { Device, DeviceStatus, Platform } from '@/types';
import { generateRandomColor, generateId } from '@/utils/helpers';
import * as ExpoDevice from 'expo-device';

type DeviceListener = (devices: Device[]) => void;

class DeviceDiscoveryService {
  private listeners: Set<DeviceListener> = new Set();
  private discoveredDevices: Map<string, Device> = new Map();
  private isScanning = false;
  private scanInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize device discovery
   */
  async initialize(): Promise<void> {
    try {
      const deviceName = await this.getDeviceName();
      console.log(`Device Discovery initialized on ${deviceName}`);
    } catch (error) {
      console.error('Error initializing device discovery:', error);
    }
  }

  /**
   * Subscribe to device list changes
   */
  subscribe(listener: DeviceListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Start scanning for nearby devices.
   *
   * Real Android Wi-Fi Direct and iOS Multipeer discovery require native
   * modules. The Expo runtime cannot enumerate peers from JavaScript alone, so
   * this service intentionally reports no peers instead of fabricating devices.
   */
  async startScanning(interval = 2000): Promise<void> {
    if (this.isScanning) return;

    this.isScanning = true;
    this.scanInterval = setInterval(() => {
      this.scanDevices();
    }, interval);

    // Initial scan
    await this.scanDevices();
  }

  /**
   * Stop scanning for devices
   */
  stopScanning(): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    this.isScanning = false;
  }

  /**
   * Scan for devices.
   */
  private async scanDevices(): Promise<void> {
    try {
      this.notifyListeners();
    } catch (error) {
      console.error('Error scanning devices:', error);
    }
  }

  /**
   * Get all discovered devices
   */
  getDiscoveredDevices(): Device[] {
    return Array.from(this.discoveredDevices.values());
  }

  /**
   * Connect to a device
   */
  async connectToDevice(deviceId: string): Promise<Device | null> {
    try {
      const device = this.discoveredDevices.get(deviceId);

      if (!device) {
        console.error(`Device ${deviceId} not found`);
        return null;
      }

      device.status = 'error';
      this.notifyListeners();
      console.error('Native peer connection adapter is not installed.');
      return null;
    } catch (error) {
      console.error('Error connecting to device:', error);
      return null;
    }
  }

  /**
   * Disconnect from device
   */
  async disconnectFromDevice(deviceId: string): Promise<void> {
    try {
      const device = this.discoveredDevices.get(deviceId);

      if (device) {
        device.status = 'idle';
        this.notifyListeners();
      }
    } catch (error) {
      console.error('Error disconnecting from device:', error);
    }
  }

  /**
   * Get device by ID
   */
  getDeviceById(deviceId: string): Device | null {
    return this.discoveredDevices.get(deviceId) ?? null;
  }

  /**
   * Get current device name
   */
  private async getDeviceName(): Promise<string> {
    try {
      const name = ExpoDevice.deviceName ?? ExpoDevice.modelName;
      return name || 'Unknown Device';
    } catch (error) {
      return 'Unknown Device';
    }
  }

  /**
   * Get current device info
   */
  async getLocalDeviceInfo(): Promise<Device> {
    try {
      const deviceName = await this.getDeviceName();
      const brand = ExpoDevice.brand || 'Unknown';
      const modelName = ExpoDevice.modelName || 'Unknown';

      return {
        id: generateId(),
        name: deviceName || `${brand} ${modelName}`,
        platform: (ExpoDevice.deviceType === ExpoDevice.DeviceType.TABLET
          ? 'android-tv'
          : ExpoDevice.osName === 'iOS'
            ? 'ios'
            : 'android') as Platform,
        ipAddress: '0.0.0.0', // Will be set by network service
        port: 5354,
        status: 'idle' as DeviceStatus,
        signalStrength: 100,
        batteryLevel: 100,
        storageAvailable: 0, // Will be set by device query
        lastSeen: Date.now(),
        avatarColor: generateRandomColor(deviceName),
        capabilities: {
          supportsWiFiDirect: ExpoDevice.osName === 'Android',
          supportsMultipeer: ExpoDevice.osName === 'iOS',
          supportsBluetooth: true,
        },
      };
    } catch (error) {
      console.error('Error getting local device info:', error);
      return {
        id: generateId(),
        name: 'Local Device',
        platform: 'android',
        ipAddress: '0.0.0.0',
        port: 5354,
        status: 'idle',
        signalStrength: 100,
        batteryLevel: 100,
        storageAvailable: 0,
        lastSeen: Date.now(),
        avatarColor: generateRandomColor('local-device'),
        capabilities: {
          supportsWiFiDirect: true,
          supportsMultipeer: true,
          supportsBluetooth: true,
        },
      };
    }
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(): void {
    const devices = this.getDiscoveredDevices();
    this.listeners.forEach((listener) => {
      try {
        listener(devices);
      } catch (error) {
        console.error('Error notifying device listener:', error);
      }
    });
  }
}

// Export singleton instance
export default new DeviceDiscoveryService();
