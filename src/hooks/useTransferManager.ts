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

export const useTransferManager = (knownDevices: Device[] = []) => {
  const [transfers, setTransfers] = useState<TransferJob[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferStatus, setTransferStatus] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
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
              errorMessage: "Transfer was interrupted when the app stopped. Retry to send it again.",
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
          errorMessage: event.errorMessage,
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
            errorMessage: event.errorMessage,
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
              errorMessage: event.errorMessage,
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
        "File picking is not available on TV. Send files from a phone or computer.",
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
      setTransferError(String(error));
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
  ) => {
    if (isSending) {
      setTransferError("Preparing your transfer. Please wait a moment.");
      return;
    }

    const target = knownDevices.find((device) => device.id === targetDeviceId);
    if (target && target.connection !== "wifi-direct" && !enableMeteredNetworks) {
      const network = await Network.getNetworkStateAsync();
      if (network.type !== Network.NetworkStateType.WIFI) {
        setTransferError("Sending over a metered or non-Wi-Fi network is disabled in Settings.");
        return;
      }
    }

    const inProgressLabel =
      files.length > 1
        ? `Sending ${files.length} files to ${targetDeviceName}`
        : `Sending ${files[0]?.name || "file"} to ${targetDeviceName}`;

    setTransferError(null);
    setTransferStatus(inProgressLabel);
    setIsSending(true);

    const now = Date.now();
    const sourcePaths = files.map((file) => file.uri);
    const baseJob: TransferJob = {
      id: `${now}-pending`,
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
      peerId: targetDeviceId,
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

    setTransfers((current) => [baseJob, ...current]);
    await saveTransferHistory(baseJob);

    try {
      const result = await nativeCrossBeam.sendFiles({
        peerId: targetDeviceId,
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
      const message = String(error);
      setTransferError(message);
      setTransferStatus(null);
      const failedJob: TransferJob = {
        ...baseJob,
        status: "blocked",
        encrypted: false,
        retryable: true,
        updatedAt: Date.now(),
        errorMessage: message,
      };
      setTransfers((current) =>
        current.map((job) => (job.id === baseJob.id ? failedJob : job)),
      );
      await saveTransferHistory(failedJob);
    } finally {
      setIsSending(false);
    }
  };

  const reportTransferError = (error: unknown) => {
    setTransferStatus(null);
    setTransferError(error instanceof Error ? error.message : String(error));
  };

  const startTransfer = async (
    targetDeviceId: string | null,
    targetDeviceName: string,
  ) => {
    if (selectedFiles.length === 0) {
      setTransferError("Select one or more files before starting a transfer.");
      return;
    }
    if (!targetDeviceId) {
      setTransferError("Select a discovered peer before starting a transfer.");
      return;
    }
    await sendFileSet(selectedFiles, targetDeviceId, targetDeviceName);
  };

  const retryTransfer = async (id: string) => {
    const job = transfers.find((transfer) => transfer.id === id);
    if (!job?.peerId || !job.sourceFiles?.length) {
      setTransferError("This transfer has no reusable source files. Select the files again.");
      return;
    }
    await sendFileSet(job.sourceFiles, job.peerId, job.toDeviceName);
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
      setTransferError(String(error));
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
      setTransferError(String(error));
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
