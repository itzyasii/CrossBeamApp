import { useMemo, useState } from "react";
import * as DocumentPicker from "expo-document-picker";

import { nativeCrossBeam } from "@/native/crossbeamNative";
import { SelectedFile, TransferJob } from "@/types/domain";

export const useTransferManager = () => {
  const [transfers, setTransfers] = useState<TransferJob[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [transferError, setTransferError] = useState<string | null>(null);

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
    clearSelectedFiles,
    startTransfer,
    togglePause,
    activeTransferExists,
  };
};
