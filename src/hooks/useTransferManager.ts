import { useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as Network from "expo-network";

import { nativeCrossBeam } from "@/native/crossbeamNative";
import { SelectedFile, TransferJob, Device, TransferFileResult } from "@/types/domain";
import {
  deleteTransferHistory,
  getTransferHistory,
  saveTransferHistory,
} from "@/store/database";
import { chunkedTransferService } from "@/services/chunkedTransferService";
import { useAppStore } from "@/store";
import { friendlyErrorMessage } from "@/utils/userMessage";

export const useTransferManager = (knownDevices: Device[] = []) => {
  const [transfers, setTransfers] = useState<TransferJob[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferStatus, setTransferStatus] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const isSendingRef = useRef(false);
  const enableMeteredNetworks = useAppStore((state) => state.enableMeteredNetworks);
  const knownDevicesRef = useRef(knownDevices);
  useEffect(() => {
    knownDevicesRef.current = knownDevices;
  }, [knownDevices]);

  useEffect(() => {
    let mounted = true;
    void getTransferHistory().then(async (history) => {
      const restored = history.map((job) =>
        ["queued", "in-progress", "paused"].includes(job.status)
          ? {
              ...job,
              status: "failed" as const,
              retryable: Boolean(job.peerId && job.sourceFiles?.length),
              errorMessage: "This stopped when CrossBeam closed. Tap Retry to send it again.",
              updatedAt: Date.now(),
            }
          : job,
      );
      await Promise.all(restored.map((job) => saveTransferHistory(job)));
      if (mounted) setTransfers(restored);
    });
    void nativeCrossBeam.cleanupPartialTransfers(7 * 24 * 60 * 60 * 1000).catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    // Buffer incoming progress events and apply them in a debounced batch
    const pending = new Map<string, TransferJob>();
    const timerRef = { current: 0 } as { current: number };

    const flush = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = 0;
      }

      if (pending.size === 0) return;

      const updates = Array.from(pending.values());
      pending.clear();

      setTransfers((current) => {
        const merged = [...current];
        updates.forEach((u) => {
          const idx = merged.findIndex((j) => j.id === u.id);
          if (idx === -1) {
            merged.unshift(u);
          } else {
            merged[idx] = u;
          }
        });
        return merged;
      });

      // Persist updates to DB in background
      void (async () => {
        try {
          await Promise.all(updates.map((u) => saveTransferHistory(u as any)));
        } catch (e) {
          // swallow DB errors — already logged in saveTransferHistory
        }
      })();
    };

    const listener = nativeCrossBeam.addTransferProgressListener((event) => {
      const progress =
        event.totalBytes > 0
          ? Math.min(100, Math.round((event.bytesTransferred / event.totalBytes) * 100))
          : 0;
      // If progress is 100% but status hasn't updated, treat as completed
      const effectiveStatus =
        progress >= 100 && event.status === "in-progress"
          ? "completed"
          : event.status;

      setTransfers((current) => {
        const existing = pending.get(event.transferId) ?? current.find((job) => job.id === event.transferId);
        const base: TransferJob = existing ?? {
          id: event.transferId,
          fileNames: event.fileName ? [event.fileName] : ["Incoming transfer"],
          fileName: event.fileName,
          sizeBytes: event.totalBytes,
          bytesTransferred: event.bytesTransferred,
          totalBytes: event.totalBytes,
          progress,
          status: effectiveStatus as any,
          fromDeviceName:
            knownDevicesRef.current.find((d) => d.id === event.peerId)?.name ||
            event.peerId,
          toDeviceName: "This Device",
          encrypted: false,
          startedAt: Date.now(),
          updatedAt: Date.now(),
          errorMessage: event.errorMessage ? friendlyErrorMessage(event.errorMessage) : undefined,
          checksum: event.checksum,
          integrityVerified: event.integrityVerified === true,
          peerId: event.peerId,
          retryable: false,
        };

        const updateFileResults = (results: TransferFileResult[] = []): TransferFileResult[] => {
          if (!event.fileName) return results;
          const next = [...results];
          const index = next.findIndex((file) => file.name === event.fileName);
          const result: TransferFileResult = {
            ...(index >= 0 ? next[index] : { name: event.fileName }),
            mimeType: event.mimeType ?? (index >= 0 ? next[index].mimeType : undefined),
            savedUri: event.savedFilePath ?? (index >= 0 ? next[index].savedUri : undefined),
            checksum: event.checksum ?? (index >= 0 ? next[index].checksum : undefined),
            integrityVerified: event.integrityVerified === true,
            status:
              event.status === "completed"
                ? "completed"
                : event.status === "failed" || event.status === "rejected" || event.status === "cancelled"
                  ? "failed"
                  : "transferring",
            errorMessage: event.errorMessage ? friendlyErrorMessage(event.errorMessage) : undefined,
          };
          if (index >= 0) next[index] = result;
          else next.push(result);
          return next;
        };

        const updated: TransferJob = existing
          ? {
              ...existing,
              fileNames:
                event.fileName && !existing.fileNames.includes(event.fileName)
                  ? [...existing.fileNames, event.fileName]
                  : existing.fileNames,
              bytesTransferred: event.bytesTransferred,
              totalBytes: event.totalBytes,
              progress,
              status: effectiveStatus as any,
              mimeType: event.mimeType ?? existing.mimeType,
              savedFilePaths: event.savedFilePath
                ? [
                    ...new Set([
                      ...(existing.savedFilePaths ?? []),
                      event.savedFilePath,
                    ]),
                  ]
                : existing.savedFilePaths,
              updatedAt: Date.now(),
              errorMessage: event.errorMessage ? friendlyErrorMessage(event.errorMessage) : undefined,
              checksum: event.checksum ?? existing.checksum,
              integrityVerified:
                event.integrityVerified ?? existing.integrityVerified,
              fileResults:
                effectiveStatus === "completed" && !event.fileName
                  ? (existing.fileResults ?? []).map((file) => ({
                      ...file,
                      status: "completed" as const,
                    }))
                  : updateFileResults(existing.fileResults),
              retryable:
                ["failed", "rejected", "cancelled"].includes(effectiveStatus) &&
                Boolean(existing.peerId && existing.sourceFiles?.length),
            }
          : { ...base, fileResults: updateFileResults() };

        // Buffer the update
        pending.set(event.transferId, updated);

        // Schedule a flush (debounced)
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(flush, 250) as unknown as number;

        // Return current state immediately — UI will re-render on flush
        return current;
      });
    });

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      listener?.();
    };
  }, []);

  const pickFiles = async () => {
    setTransferError(null);
    setTransferStatus(null);

    if (Platform.isTV) {
      setTransferError(
        "Choose files on your phone, then send them to this TV.",
      );
      return;
    }

    let result: DocumentPicker.DocumentPickerResult;
    try {
      result = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
      });
    } catch (error) {
      setTransferError(friendlyErrorMessage(error));
      return;
    }

    if (result.canceled) return;

    setSelectedFiles(
      result.assets.map((asset) => ({
        id: `${asset.uri}-${asset.name}`,
        name: asset.name,
        sizeBytes: asset.size ?? 0,
        mimeType: asset.mimeType,
        uri: asset.uri,
      })),
    );
  };

  const addSelectedFiles = (files: SelectedFile[]) => {
    setSelectedFiles((current) => [
      ...current,
      ...files.filter((f) => !current.some((c) => c.id === f.id)),
    ]);
    setTransferError(null);
    setTransferStatus(null);
  };

  const clearSelectedFiles = () => {
    setSelectedFiles([]);
    setTransferError(null);
    setTransferStatus(null);
  };

  const sendFileSet = async (
    files: SelectedFile[],
    targetDeviceId: string,
    targetDeviceName: string,
    retryJob?: TransferJob,
  ) => {
    if (isSendingRef.current) {
      setTransferError("Getting your files ready. Please wait a moment.");
      return;
    }

    isSendingRef.current = true;
    setIsSending(true);
    setTransferError(null);

    const updateRetryFailure = async (message: string) => {
      setTransferError(message);
      setTransferStatus(null);
      if (!retryJob) return;

      const failedJob: TransferJob = {
        ...retryJob,
        status: "blocked",
        retryable: true,
        errorMessage: message,
        updatedAt: Date.now(),
      };
      setTransfers((current) =>
        current.map((job) => (job.id === retryJob.id ? failedJob : job)),
      );
      await saveTransferHistory(failedJob);
    };

    let activeJob: TransferJob | undefined;
    try {
      const storedIdentity = targetDeviceId.startsWith("peer-")
        ? targetDeviceId.slice(5)
        : targetDeviceId;
      let target = knownDevicesRef.current.find((device) => {
        const deviceIdentity = device.deviceKey ?? device.id;
        const normalizedIdentity = deviceIdentity.startsWith("peer-")
          ? deviceIdentity.slice(5)
          : deviceIdentity;
        return (
          device.id === targetDeviceId ||
          device.deviceKey === targetDeviceId ||
          device.id === storedIdentity ||
          device.deviceKey === storedIdentity ||
          normalizedIdentity === storedIdentity
        );
      });

      if (!target || target.availability === "unavailable") {
        await updateRetryFailure(
          `${targetDeviceName} isn't nearby right now. Open CrossBeam on that device, then find it and try again.`,
        );
        return;
      }

      let resolvedTargetId = target.id;
      if (!target.isTransferReady) {
        const canReconnectDirectly =
          target.connection === "wifi-direct" ||
          Boolean(target.wifiDirectAddress) ||
          target.availableConnections?.includes("wifi-direct");

        if (!canReconnectDirectly) {
          await updateRetryFailure(
            `${targetDeviceName} is nearby but isn't ready yet. Keep CrossBeam open on both devices, then try again.`,
          );
          return;
        }

        setTransferStatus(`Connecting to ${targetDeviceName}…`);
        try {
          const connected = await nativeCrossBeam.connectToWifiDirectPeer(target.id);
          if (!connected.isTransferReady) {
            throw new Error("DEVICE_NOT_READY");
          }
          target = connected;
          resolvedTargetId = connected.id;
        } catch {
          await updateRetryFailure(
            `Couldn't reconnect to ${targetDeviceName}. Keep both devices nearby, make sure Wi-Fi is on, then try again.`,
          );
          return;
        }
      }

      if (target.connection !== "wifi-direct" && !enableMeteredNetworks) {
        const network = await Network.getNetworkStateAsync();
        if (network.type !== Network.NetworkStateType.WIFI) {
          await updateRetryFailure(
            "This network is limited. Allow limited networks in Settings, or connect to Wi-Fi.",
          );
          return;
        }
      }

      const inProgressLabel =
        files.length > 1
          ? `Sending ${files.length} files to ${targetDeviceName}`
          : `Sending ${files[0]?.name || "file"} to ${targetDeviceName}`;

      setTransferStatus(inProgressLabel);

      const now = Date.now();
      const sourcePaths = files.map((file) => file.uri);
      const baseJob: TransferJob = {
        id: retryJob?.id ?? `${now}-pending`,
        fileNames: files.map((file) => file.name),
        fileName: files[0]?.name,
        sizeBytes: files.reduce((sum, file) => sum + file.sizeBytes, 0),
        progress: 0,
        bytesTransferred: 0,
        totalBytes: files.reduce((sum, file) => sum + file.sizeBytes, 0),
        status: "queued",
        fromDeviceName: "This Device",
        toDeviceName: targetDeviceName,
        encrypted: false,
        startedAt: now,
        updatedAt: now,
        localFilePaths: sourcePaths,
        mimeType: files[0]?.mimeType,
        peerId: resolvedTargetId,
        sourceFiles: files,
        fileResults: files.map((file) => ({
          name: file.name,
          mimeType: file.mimeType,
          sizeBytes: file.sizeBytes,
          integrityVerified: false,
          status: "pending",
        })),
        retryable: true,
      };
      activeJob = baseJob;

      setTransfers((current) =>
        retryJob
          ? current.map((job) => (job.id === retryJob.id ? baseJob : job))
          : [baseJob, ...current],
      );
      await saveTransferHistory(baseJob);

      const result = await nativeCrossBeam.sendFiles({
        peerId: resolvedTargetId,
        files: files.map((file) => ({
          id: file.id,
          name: file.name,
          uri: file.uri,
          sizeBytes: file.sizeBytes,
          mimeType: file.mimeType,
        })),
      });
      await deleteTransferHistory(baseJob.id);
      setTransfers((current) =>
        current.map((job) =>
          job.id === baseJob.id
            ? {
                ...job,
                id: result.transferId,
                status: "in-progress",
                retryable: false,
                localFilePaths: sourcePaths,
                updatedAt: Date.now(),
              }
            : job,
        ),
      );
      void saveTransferHistory({
        ...baseJob,
        id: result.transferId,
        status: "in-progress",
        retryable: false,
        localFilePaths: sourcePaths,
        updatedAt: Date.now(),
      });
      setTransferError(null);
    } catch (error) {
      const message = friendlyErrorMessage(error);
      setTransferError(message);
      setTransferStatus(null);
      const currentJob = activeJob ?? retryJob;
      if (currentJob) {
        const failedJob: TransferJob = {
          ...currentJob,
          status: "blocked",
          retryable: true,
          updatedAt: Date.now(),
          errorMessage: message,
        };
        setTransfers((current) =>
          current.map((job) => (job.id === currentJob.id ? failedJob : job)),
        );
        await saveTransferHistory(failedJob);
      }
    } finally {
      isSendingRef.current = false;
      setIsSending(false);
    }
  };

  const reportTransferError = (error: unknown) => {
    setTransferStatus(null);
    setTransferError(friendlyErrorMessage(error));
  };

  const startTransfer = async (
    targetDeviceId: string | null,
    targetDeviceName: string,
  ) => {
    if (selectedFiles.length === 0) {
      setTransferError("Choose at least one file first.");
      return;
    }
    if (!targetDeviceId) {
      setTransferError("Choose a nearby device first.");
      return;
    }
    await sendFileSet(selectedFiles, targetDeviceId, targetDeviceName);
  };

  const retryTransfer = async (id: string) => {
    const job = transfers.find((transfer) => transfer.id === id);
    if (!job?.peerId || !job.sourceFiles?.length) {
      setTransferError("These files are no longer available. Choose them again.");
      return;
    }
    await sendFileSet(job.sourceFiles, job.peerId, job.toDeviceName, job);
  };

  const togglePause = async (id: string) => {
    const job = transfers.find((j) => j.id === id);
    if (!job) return;

    try {
      if (job.status === "paused") {
        await chunkedTransferService.resume(id);
      } else {
        await chunkedTransferService.pause(id);
      }
    } catch (error) {
      setTransferError(friendlyErrorMessage(error));
    }
  };

  const cancelTransfer = async (id: string) => {
    try {
      await nativeCrossBeam.cancelTransfer(id);
      let cancelled: TransferJob | undefined;
      setTransfers((current) =>
        current.map((job) =>
          job.id === id
            ? (cancelled = { ...job, status: "cancelled", retryable: Boolean(job.peerId && job.sourceFiles?.length), updatedAt: Date.now() })
            : job,
        ),
      );
      if (cancelled) await saveTransferHistory(cancelled);
    } catch (error) {
      setTransferError(friendlyErrorMessage(error));
    }
  };

  const activeTransferExists = useMemo(
    () =>
      transfers.some(
        (job) => job.status === "in-progress" || job.status === "queued",
      ),
    [transfers],
  );

  useEffect(() => {
    if (!activeTransferExists) {
      setTransferStatus(null);
    }
  }, [activeTransferExists]);

  // Ensure Android foreground service runs while transfers are active
  useEffect(() => {
    if (Platform.OS !== "android") return;
    if (activeTransferExists) {
      void nativeCrossBeam.startForegroundService().catch(() => {});
    } else {
      void nativeCrossBeam.stopForegroundService().catch(() => {});
    }
  }, [activeTransferExists]);

  return {
    transfers,
    selectedFiles,
    transferError,
    transferStatus,
    isSending,
    pickFiles,
    addSelectedFiles,
    clearSelectedFiles,
    startTransfer,
    togglePause,
    cancelTransfer,
    retryTransfer,
    reportTransferError,
    activeTransferExists,
  };
};
