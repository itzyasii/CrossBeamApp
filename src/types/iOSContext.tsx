// Context Provider for iOS Features
// Move this to src/context/iOSFeaturesContext.tsx after creating the context directory

import React, { createContext, useContext, useEffect, ReactNode } from "react";
import { useShareIntent, ShareIntentData } from "@/services/ShareIntentService";
import { useDeepLink } from "@/hooks/useDeepLink";
import { useEnhancedBiometrics } from "@/hooks/useEnhancedBiometrics";
import { iCloudSyncService } from "@/services/iCloudSyncService";
import { handoffService } from "@/services/HandoffService";

export interface iOSFeaturesContextType {
  sharedData: ShareIntentData | null;
  isShareLoading: boolean;
  shareError: string | null;
  isAuthenticated: boolean;
  authenticate: (userId: string, reason?: string) => Promise<boolean>;
  logout: () => Promise<boolean>;
  iCloudAvailable: boolean;
  syncTransfers: () => Promise<void>;
  enableHandoff: () => Promise<void>;
}

const iOSFeaturesContext = createContext<iOSFeaturesContextType | undefined>(
  undefined,
);

export interface iOSFeaturesProviderProps {
  children: ReactNode;
  userId?: string;
}

export const iOSFeaturesProvider = ({
  children,
  userId,
}: iOSFeaturesProviderProps) => {
  const {
    sharedData,
    isLoading: isShareLoading,
    error: shareError,
  } = useShareIntent();

  useDeepLink();

  const { isAuthenticated, authenticate, logout } = useEnhancedBiometrics();

  useEffect(() => {
    const initializeServices = async () => {
      await iCloudSyncService.initialize();
      await handoffService.enableHandoff();
    };

    initializeServices();
  }, []);

  const [iCloudAvailable, setICloudAvailable] = React.useState(false);

  useEffect(() => {
    const checkICloud = async () => {
      const available = await iCloudSyncService.isAvailable();
      setICloudAvailable(available);
    };

    checkICloud();
  }, []);

  const syncTransfers = async () => {
    try {
      const transfers = await iCloudSyncService.getSyncedTransfers();
      console.log(`Synced ${transfers.length} transfers from iCloud`);
    } catch (error) {
      console.error("Failed to sync transfers:", error);
    }
  };

  const enableHandoff = async () => {
    try {
      await handoffService.enableHandoff();
    } catch (error) {
      console.error("Failed to enable Handoff:", error);
    }
  };

  const value: iOSFeaturesContextType = {
    sharedData,
    isShareLoading,
    shareError,
    isAuthenticated,
    authenticate,
    logout,
    iCloudAvailable,
    syncTransfers,
    enableHandoff,
  };

  return (
    <iOSFeaturesContext.Provider value={value}>
      {children}
    </iOSFeaturesContext.Provider>
  );
};

export const useiOSFeatures = () => {
  const context = useContext(iOSFeaturesContext);
  if (!context) {
    throw new Error("useiOSFeatures must be used within iOSFeaturesProvider");
  }
  return context;
};
