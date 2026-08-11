import { useCallback, useEffect, useRef, useState } from "react";

import { nativeCrossBeam } from "@/native/crossbeamNative";
import { notificationService } from "@/services/notificationService";
import {
  IncomingApprovalRequest,
  platformFeatureService,
} from "@/services/platformFeatureService";
import { haptics } from "@/services/haptics";
import { getTrustedDevices } from "@/store/database";
import { Device } from "@/types/domain";
import { useAppStore } from "@/store/appStore";

type ApprovalAction = "accepted" | "rejected" | "trusted";

export const useIncomingTransferApprovals = (knownDevices: Device[] = []) => {
  const [approvals, setApprovals] = useState<IncomingApprovalRequest[]>([]);
  const [activeApproval, setActiveApproval] =
    useState<IncomingApprovalRequest | null>(null);
  const enableNotifications = useAppStore((state) => state.enableNotifications);
  const autoTransfer = useAppStore((state) => state.autoTransfer);
  const respondingRef = useRef<Set<string>>(new Set());

  const refreshApprovals = useCallback(async () => {
    setApprovals(await platformFeatureService.getApprovals());
  }, []);

  const resolveDevice = useCallback(
    (peerId: string, peerName: string): Device => {
      const known =
        knownDevices.find((device) => device.id === peerId) ??
        knownDevices.find((device) => device.name === peerName);
      return {
        id: known?.id ?? peerId,
        name: known?.name ?? peerName,
        platform: known?.platform ?? "android",
        connection: known?.connection ?? "local-network",
        lastSeenAt: Date.now(),
        isTrusted: known?.isTrusted ?? false,
      };
    },
    [knownDevices],
  );

  const respondToTransfer = useCallback(
    async (
      approval: IncomingApprovalRequest,
      action: ApprovalAction,
      options?: { silent?: boolean },
    ) => {
      if (respondingRef.current.has(approval.transferId)) return;
      respondingRef.current.add(approval.transferId);

      try {
        const accepted = action !== "rejected";
        await nativeCrossBeam.respondToIncomingTransfer(
          approval.transferId,
          accepted,
        );
        const updated = await platformFeatureService.updateApproval(
          approval.id,
          action,
        );
        setApprovals(updated);
        setActiveApproval((current) =>
          current?.id === approval.id ? null : current,
        );
        await notificationService.dismissIncomingTransferRequest(
          approval.transferId,
        );

        if (!options?.silent) {
          if (action === "rejected") {
            await haptics.error();
          } else {
            await haptics.success();
          }
        }
      } finally {
        respondingRef.current.delete(approval.transferId);
      }
    },
    [],
  );

  const handleApprovalAction = useCallback(
    async (id: string, action: ApprovalAction) => {
      const approval =
        approvals.find((item) => item.id === id) ??
        (activeApproval?.id === id ? activeApproval : null);
      if (!approval) return;
      await respondToTransfer(approval, action);
    },
    [activeApproval, approvals, respondToTransfer],
  );

  useEffect(() => {
    void refreshApprovals();
    void notificationService.requestPermissions();
  }, [refreshApprovals]);

  useEffect(() => {
    const removeRequestListener =
      nativeCrossBeam.addIncomingTransferRequestListener(async (request) => {
        const fromDevice = resolveDevice(request.peerId, request.peerName);
        const freeDiskBytes = await platformFeatureService.getFreeDiskBytes();
        const approval = await platformFeatureService.queueApproval({
          transferId: request.transferId,
          fromDevice,
          fileNames: request.fileNames,
          sizeBytes: request.sizeBytes,
          storageOk: freeDiskBytes <= 0 || freeDiskBytes > request.sizeBytes,
        });

        setApprovals(await platformFeatureService.getApprovals());

        const trustedDevices = await getTrustedDevices();
        // Never trust by display name, IP address, or merely because another
        // trusted device exists. Auto-accept is restricted to a stable device
        // key that exactly matches a persisted record. Incoming socket peers do
        // not currently carry an authenticated device key, so they continue to
        // require explicit approval until secure pairing is implemented.
        const isTrusted =
          autoTransfer &&
          Boolean(fromDevice.deviceKey) &&
          trustedDevices.some(
            (device) =>
              device.deviceKey === fromDevice.deviceKey &&
              device.id === fromDevice.id,
          );

        if (isTrusted) {
          await respondToTransfer(approval, "accepted", { silent: true });
          return;
        }

        setActiveApproval(approval);
        await haptics.warning();
        if (enableNotifications) {
          await notificationService.showIncomingTransferRequest(approval);
        }
      });

    const removeNotificationListener = notificationService.addResponseListener(
      async ({ transferId, approvalId, action }) => {
        const currentApprovals = await platformFeatureService.getApprovals();
        const approval = currentApprovals.find(
          (item) =>
            item.transferId === transferId ||
            (approvalId ? item.id === approvalId : false),
        );

        if (!approval || approval.status !== "pending") return;

        if (action === "accept") {
          await respondToTransfer(approval, "accepted");
        } else if (action === "reject") {
          await respondToTransfer(approval, "rejected");
        } else {
          setActiveApproval(approval);
        }
      },
    );

    return () => {
      removeRequestListener();
      removeNotificationListener?.();
    };
  }, [autoTransfer, enableNotifications, resolveDevice, respondToTransfer]);

  return {
    approvals,
    activeApproval,
    setActiveApproval,
    handleApprovalAction,
    refreshApprovals,
  };
};
