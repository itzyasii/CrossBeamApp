import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import { CrossBeamNative } from '../native/crossbeamNative';

export interface WiFiDirectPeer {
  id: string;
  name: string;
  address: string;
  status: 'available' | 'invited' | 'connected' | 'failed' | 'unavailable';
}

class WiFiDirectService {
  private static instance: WiFiDirectService;
  private eventEmitter: NativeEventEmitter | null = null;

  private constructor() {
    if (Platform.OS === 'android' && NativeModules.CrossBeamNative) {
      this.eventEmitter = new NativeEventEmitter(NativeModules.CrossBeamNative);
    }
  }

  public static getInstance(): WiFiDirectService {
    if (!WiFiDirectService.instance) {
      WiFiDirectService.instance = new WiFiDirectService();
    }
    return WiFiDirectService.instance;
  }

  public async isWiFiDirectAvailable(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    const caps = await CrossBeamNative?.getPlatformCapabilities();
    return caps?.includes('wifi-direct-api-available') ?? false;
  }

  public async startDiscovery(): Promise<void> {
    if (Platform.OS !== 'android') return;
    await CrossBeamNative?.startDiscovery(); // Existing startDiscovery already starts NSD, I'll update it to start WiFi Direct too
  }

  public async stopDiscovery(): Promise<void> {
    if (Platform.OS !== 'android') return;
    await CrossBeamNative?.stopDiscovery();
  }

  public subscribeToPeers(callback: (peers: WiFiDirectPeer[]) => void) {
    if (!this.eventEmitter) return () => {};
    
    const subscription = this.eventEmitter.addListener('onWiFiDirectPeersChanged', callback);
    return () => subscription.remove();
  }

  public subscribeToConnection(callback: (event: any) => void) {
    if (!this.eventEmitter) return () => {};
    
    const subscription = this.eventEmitter.addListener('onWiFiDirectConnectionChanged', callback);
    return () => subscription.remove();
  }
}

export default WiFiDirectService.getInstance();
