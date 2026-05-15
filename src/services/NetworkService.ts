/**
 * Network service for connectivity management
 */

import * as Network from 'expo-network';
import { NetworkState } from '@/types';

type NetworkListener = (state: NetworkState) => void;

class NetworkService {
  private listeners: Set<NetworkListener> = new Set();
  private currentState: NetworkState = {
    isWiFiConnected: false,
    isInternetReachable: false,
    isMetered: false,
  };

  /**
   * Initialize network monitoring
   */
  async initialize(): Promise<void> {
    try {
      await this.updateNetworkState();
      // Note: Expo Network API doesn't provide real-time updates
      // In production, use platform-specific native modules
    } catch (error) {
      console.error('Error initializing network service:', error);
    }
  }

  /**
   * Subscribe to network state changes
   */
  subscribe(listener: NetworkListener): () => void {
    this.listeners.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get current network state
   */
  getNetworkState(): NetworkState {
    return this.currentState;
  }

  /**
   * Check if network is available
   */
  async isNetworkAvailable(): Promise<boolean> {
    try {
      const state = await Network.getNetworkStateAsync();
      return state.isConnected ?? false;
    } catch (error) {
      console.error('Error checking network availability:', error);
      return false;
    }
  }

  /**
   * Check if WiFi is connected
   */
  async isWiFiConnected(): Promise<boolean> {
    try {
      const state = await Network.getNetworkStateAsync();
      return state.type === Network.NetworkStateType.WIFI;
    } catch (error) {
      console.error('Error checking WiFi connection:', error);
      return false;
    }
  }

  /**
   * Check if network is metered (mobile data)
   */
  async isMeteredNetwork(): Promise<boolean> {
    try {
      const state = await Network.getNetworkStateAsync();
      return (
        state.type === Network.NetworkStateType.CELLULAR ||
        state.type === Network.NetworkStateType.UNKNOWN
      );
    } catch (error) {
      console.error('Error checking metered network:', error);
      return false;
    }
  }

  /**
   * Check internet reachability
   */
  async isInternetReachable(): Promise<boolean> {
    try {
      const state = await Network.getNetworkStateAsync();
      return state.isInternetReachable ?? false;
    } catch (error) {
      console.error('Error checking internet reachability:', error);
      return false;
    }
  }

  /**
   * Update network state and notify listeners
   */
  private async updateNetworkState(): Promise<void> {
    try {
      const isWiFi = await this.isWiFiConnected();
      const isInternet = await this.isInternetReachable();
      const isMetered = await this.isMeteredNetwork();

      const newState: NetworkState = {
        isWiFiConnected: isWiFi,
        isInternetReachable: isInternet,
        isMetered: isMetered,
      };

      // Only notify if state changed
      if (JSON.stringify(newState) !== JSON.stringify(this.currentState)) {
        this.currentState = newState;
        this.notifyListeners(newState);
      }
    } catch (error) {
      console.error('Error updating network state:', error);
    }
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(state: NetworkState): void {
    this.listeners.forEach((listener) => {
      try {
        listener(state);
      } catch (error) {
        console.error('Error notifying network listener:', error);
      }
    });
  }

  /**
   * Force refresh network state
   */
  async refresh(): Promise<void> {
    await this.updateNetworkState();
  }
}

// Export singleton instance
export default new NetworkService();
