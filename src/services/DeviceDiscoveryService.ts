/**
 * Device discovery service for peer detection
 */

import { Device, DeviceStatus, Platform } from '@types/index';
import { generateRandomColor, generateId } from '@utils/helpers';
import * as Device as ExpoDevice from 'expo-device';

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
   * Start scanning for nearby devices
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
   * Scan for devices (mock implementation)
   */
  private async scanDevices(): Promise<void> {
    try {
      // Mock: Generate random devices for testing
      // In production, replace with real device discovery (NSD, mDNS)

      // Randomly add or update a mock device
      if (Math.random() > 0.7) {
        const mockDeviceId = 'mock-device-' + Math.floor(Math.random() * 5);

        if (!this.discoveredDevices.has(mockDeviceId)) {
          const platforms: Platform[] = ['android', 'ios', 'android-tv'];
          const device: Device = {
            id: mockDeviceId,
            name: `Device ${mockDeviceId.slice(-1)}`,
            platform: platforms[Math.floor(Math.random() * platforms.length)],
            ipAddress: `192.168.1.${Math.floor(Math.random() * 200) + 10}`,
            port: 5354,
            status: 'idle',
            signalStrength: Math.floor(Math.random() * 50) + 50,
            batteryLevel: Math.floor(Math.random() * 40) + 60,
            storageAvailable: Math.random() * 50 * 1024 * 1024 * 1024,
            lastSeen: Date.now(),
            avatarColor: generateRandomColor(mockDeviceId),
            capabilities: {
              supportsWiFiDirect: true,
              supportsMultipeer: true,
              supportsBluetooth: true,
            },
          };

          this.discoveredDevices.set(mockDeviceId, device);
          this.notifyListeners();
        }
      }

      // Update lastSeen for all devices
      this.discoveredDevices.forEach((device) => {
        device.lastSeen = Date.now();
      });

      // Remove devices not seen in 60 seconds
      const now = Date.now();
      const timeout = 60000;

      this.discoveredDevices.forEach((device, id) => {
        if (now - device.lastSeen > timeout) {
          this.discoveredDevices.delete(id);
        }
      });
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

      // Update status
      device.status = 'connecting';
      this.notifyListeners();

      // Simulate connection delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Update status to connected
      device.status = 'connected';
      this.notifyListeners();

      return device;
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
      const name = await ExpoDevice.getDeviceNameAsync();
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
