import { useEffect, useCallback } from "react";
import { useNavigation } from "@react-navigation/native";
import { deepLinkService, DeepLinkParams } from "@/services/DeepLinkService";

export const useDeepLink = () => {
  const navigation = useNavigation();
  const nav = navigation as any;

  const handleDeepLink = useCallback(
    (params: DeepLinkParams) => {
      if (!params.action) return;

      switch (params.action) {
        case "send":
          if (params.deviceId) {
            nav.navigate(
              "TransferScreen",
              {
                deviceId: params.deviceId,
                fileName: params.fileName,
              } as never,
            );
          }
          break;

        case "receive":
          nav.navigate("DiscoverScreen");
          break;

        case "pair":
          if (params.pairingCode) {
            nav.navigate(
              "QRPairingScreen",
              {
                pairingCode: params.pairingCode,
              } as never,
            );
          }
          break;

        case "open":
          // Open a specific transfer or device
          if (params.transferId) {
            nav.navigate(
              "HistoryScreen",
              {
                transferId: params.transferId,
              } as never,
            );
          }
          break;

        default:
          console.warn(`Unknown deep link action: ${params.action}`);
      }
    },
    [nav],
  );

  useEffect(() => {
    // Handle initial deep link (app launched via deep link)
    const initializeDeepLink = async () => {
      const params = await deepLinkService.getInitialURL();
      if (params) {
        handleDeepLink(params);
      }
    };

    initializeDeepLink();
  }, [handleDeepLink]);

  useEffect(() => {
    // Listen for deep links while app is running
    const unsubscribe = deepLinkService.addDeepLinkListener(handleDeepLink);
    return () => {
      unsubscribe?.();
    };
  }, [handleDeepLink]);

  return {
    handleDeepLink,
  };
};
