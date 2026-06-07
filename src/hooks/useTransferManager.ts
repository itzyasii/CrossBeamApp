import { useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";

import { nativeCrossBeam } from "@/native/crossbeamNative";
import { SelectedFile, TransferJob, Device } from "@/types/domain";
import { saveTransferHistory } from "@/store/database";
import { platformFeatureService } from "@/services/platformFeatureService";
import { chunkedTransferService } from "@/services/chunkedTransferService";

export const useTransferManager = (knownDevices: Device[] = []) => {
  const [transfers, setTransfers] = useState<TransferJob[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [transferError, setTransferError] = useState<string | null>(null);

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
        event.totalBytes > 0 ? event.bytesTransferred / event.totalBytes : 0;
      // If progress is 100% but status hasn't updated, treat as completed
      const effectiveStatus =
        progress >= 1 && event.status === "in-progress"
          ? "completed"
          : event.status;

      setTransfers((current) => {
        const existing = current.find((job) => job.id === event.transferId);
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
            knownDevices.find((d) => d.id === event.peerId)?.name ||
            event.peerId,
          toDeviceName: "This Device",
          encrypted: true,
          startedAt: Date.now(),
          updatedAt: Date.now(),
          errorMessage: event.errorMessage,
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
            }
          : base;

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
  };

  const clearSelectedFiles = () => {
    setSelectedFiles([]);
    setTransferError(null);
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

    const now = Date.now();
    const sourcePaths = selectedFiles.map((file) => file.uri);
    const baseJob: TransferJob = {
      id: `${now}-pending`,
      fileNames: selectedFiles.map((file) => file.name),
      fileName: selectedFiles[0]?.name,
      sizeBytes: selectedFiles.reduce((sum, file) => sum + file.sizeBytes, 0),
      progress: 0,
      bytesTransferred: 0,
      totalBytes: selectedFiles.reduce((sum, file) => sum + file.sizeBytes, 0),
      status: "queued",
      fromDeviceName: "This Device",
      toDeviceName: targetDeviceName,
      encrypted: true,
      startedAt: now,
      updatedAt: now,
      localFilePaths: sourcePaths,
      mimeType: selectedFiles[0]?.mimeType,
    };

    setTransfers((current) => [baseJob, ...current]);

    try {
      const result = await nativeCrossBeam.sendFiles({
        peerId: targetDeviceId,
        files: selectedFiles.map((file) => ({
          id: file.id,
          name: file.name,
          uri: file.uri,
          sizeBytes: file.sizeBytes,
          mimeType: file.mimeType,
        })),
      });
      setTransfers((current) =>
        current.map((job) =>
          job.id === baseJob.id
            ? {
                ...job,
                id: result.transferId,
                status: "in-progress",
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
        localFilePaths: sourcePaths,
        updatedAt: Date.now(),
      });
      setTransferError(null);
    } catch (error) {
      const message = String(error);
      setTransferError(message);
      setTransfers((current) =>
        current.map((job) =>
          job.id === baseJob.id
            ? {
                ...job,
                status: "blocked",
                encrypted: false,
                updatedAt: Date.now(),
                errorMessage: message,
              }
            : job,
        ),
      );
    }
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
      setTransfers((current) =>
        current.map((job) =>
          job.id === id
            ? { ...job, status: "cancelled", updatedAt: Date.now() }
            : job,
        ),
      );
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
    pickFiles,
    addSelectedFiles,
    clearSelectedFiles,
    startTransfer,
    togglePause,
    cancelTransfer,
    activeTransferExists,
  };
};
