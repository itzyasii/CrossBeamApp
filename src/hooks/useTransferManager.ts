import { useEffect, useMemo, useState } from "react";
import * as DocumentPicker from "expo-document-picker";

import { nativeCrossBeam } from "@/native/crossbeamNative";
import { SelectedFile, TransferJob, TransferHistory } from "@/types/domain";
import { saveTransferHistory } from "@/store/database";

export const useTransferManager = () => {
  const [transfers, setTransfers] = useState<TransferJob[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [transferError, setTransferError] = useState<string | null>(null);

  useEffect(() => {
    return nativeCrossBeam.addTransferProgressListener((event) => {
      setTransfers((current) => {
        const progress =
          event.totalBytes > 0
            ? Math.min(100, Math.round((event.bytesTransferred / event.totalBytes) * 100))
            : 0;
        const existing = current.find((job) => job.id === event.transferId);
        
        let newJob: TransferJob;
        if (!existing) {
          newJob = {
            id: event.transferId,
            fileNames: event.fileName ? [event.fileName] : ["Incoming transfer"],
            fileName: event.fileName,
            sizeBytes: event.totalBytes,
            bytesTransferred: event.bytesTransferred,
            totalBytes: event.totalBytes,
            progress,
            status: event.status as any,
            fromDeviceName: event.peerId,
            toDeviceName: "This Device",
            encrypted: true,
            startedAt: Date.now(),
            updatedAt: Date.now(),
            errorMessage: event.errorMessage,
          };
        } else {
          newJob = {
            ...existing,
            fileNames:
              event.fileName && !existing.fileNames.includes(event.fileName)
                ? [...existing.fileNames, event.fileName]
                : existing.fileNames,
            bytesTransferred: event.bytesTransferred,
            totalBytes: event.totalBytes,
            progress,
            status: event.status as any,
            updatedAt: Date.now(),
            errorMessage: event.errorMessage,
          };
        }
        
        void saveTransferHistory(newJob as any);

        if (!existing) {
          return [newJob, ...current];
        }
        return current.map((job) => (job.id === event.transferId ? newJob : job));
      });
    });
  }, []);

  const pickFiles = async () => {
    setTransferError(null);
    const result = await DocumentPicker.getDocumentAsync({
      multiple: true,
      copyToCacheDirectory: false,
    });

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
    setSelectedFiles(current => [...current, ...files.filter(f => !current.some(c => c.id === f.id))]);
    setTransferError(null);
  };

  const clearSelectedFiles = () => {
    setSelectedFiles([]);
    setTransferError(null);
  };

  const startTransfer = async (targetDeviceId: string | null, targetDeviceName: string) => {
    if (selectedFiles.length === 0) {
      setTransferError("Select one or more files before starting a transfer.");
      return;
    }

    if (!targetDeviceId) {
      setTransferError("Select a discovered peer before starting a transfer.");
      return;
    }

    const now = Date.now();
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
            ? { ...job, id: result.transferId, status: "in-progress", updatedAt: Date.now() }
            : job,
        ),
      );
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

  const togglePause = (_id: string) => {
    setTransferError(
      "Pause and resume are only available after the native streaming transfer engine is installed.",
    );
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
