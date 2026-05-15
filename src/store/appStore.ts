/**
 * Zustand store for app state management
 */

import { create } from 'zustand';
import { Device, Transfer, TransferHistory } from '@/types';
import storage from '@/utils/storage';

interface AppState {
  // Devices
  discoveredDevices: Device[];
  connectedDevice: Device | null;
  setDiscoveredDevices: (devices: Device[]) => void;
  setConnectedDevice: (device: Device | null) => void;

  // Transfers
  activeTransfers: Transfer[];
  selectedTransfer: Transfer | null;
  transferHistory: TransferHistory[];
  setTransferHistory: (history: TransferHistory[]) => void;
  addTransfer: (transfer: Transfer) => void;
  updateTransfer: (transfer: Transfer) => void;
  removeTransfer: (transferId: string) => void;
  setSelectedTransfer: (transfer: Transfer | null) => void;
  loadTransferHistory: () => Promise<void>;

  // Settings
  enableNotifications: boolean;
  autoTransfer: boolean;
  enableMeteredNetworks: boolean;
  updateSettings: (key: string, value: any) => Promise<void>;

  // Loading states
  isScanning: boolean;
  setIsScanning: (value: boolean) => void;
  isLoadingHistory: boolean;
}

export const useAppStore = create<AppState>((set) => ({
  // Devices
  discoveredDevices: [],
  connectedDevice: null,
  setDiscoveredDevices: (devices) => set({ discoveredDevices: devices }),
  setConnectedDevice: (device) => set({ connectedDevice: device }),

  // Transfers
  activeTransfers: [],
  selectedTransfer: null,
  transferHistory: [],
  setTransferHistory: (history) => set({ transferHistory: history }),
  addTransfer: (transfer) => {
    set((state) => ({
      activeTransfers: [...state.activeTransfers, transfer],
    }));
  },
  updateTransfer: (transfer) => {
    set((state) => ({
      activeTransfers: state.activeTransfers.map((t) => (t.id === transfer.id ? transfer : t)),
      selectedTransfer: state.selectedTransfer?.id === transfer.id ? transfer : state.selectedTransfer,
    }));
  },
  removeTransfer: (transferId) => {
    set((state) => ({
      activeTransfers: state.activeTransfers.filter((t) => t.id !== transferId),
      selectedTransfer:
        state.selectedTransfer?.id === transferId ? null : state.selectedTransfer,
    }));
  },
  setSelectedTransfer: (transfer) => set({ selectedTransfer: transfer }),
  loadTransferHistory: async () => {
    set({ isLoadingHistory: true });
    try {
      const history = await storage.getTransferHistory();
      set({ transferHistory: history });
    } catch (error) {
      console.error('Error loading transfer history:', error);
    } finally {
      set({ isLoadingHistory: false });
    }
  },

  // Settings
  enableNotifications: true,
  autoTransfer: false,
  enableMeteredNetworks: false,
  updateSettings: async (key, value) => {
    await storage.updateSetting(key, value);
    set({ [key]: value } as any);
  },

  // Loading states
  isScanning: false,
  setIsScanning: (value) => set({ isScanning: value }),
  isLoadingHistory: false,
}));

// Initialize settings from storage
(async () => {
  try {
    const settings = await storage.getSettings();
    useAppStore.setState({
      enableNotifications: settings.enableNotifications ?? true,
      autoTransfer: settings.autoTransfer ?? false,
      enableMeteredNetworks: settings.enableMeteredNetworks ?? false,
    });
  } catch (error) {
    console.error('Error loading settings:', error);
  }
})();
