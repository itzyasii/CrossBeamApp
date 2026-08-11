import { useEffect, useState } from "react";
import { useShareIntent as useExpoShareIntent } from "expo-share-intent";
import * as FileSystem from "expo-file-system/legacy";

import AndroidShareService from "@/services/AndroidShareService";
import { platformFeatureService } from "@/services/platformFeatureService";
import { SelectedFile } from "@/types/domain";

export const useShareIntent = () => {
  const { hasShareIntent, shareIntent, resetShareIntent } = useExpoShareIntent();
  const [sharedFiles, setSharedFiles] = useState<SelectedFile[]>([]);

  useEffect(() => {
    if (!hasShareIntent || !shareIntent) return;
    let cancelled = false;

    void (async () => {
      const incoming: SelectedFile[] = [];
      try {
        for (const [index, file] of (shareIntent.files ?? []).entries()) {
          if (!file.path) continue;
          let measuredSize = file.size ?? 0;
          if (!measuredSize) {
            try {
              const info = await FileSystem.getInfoAsync(file.path);
              measuredSize = info.exists && "size" in info ? info.size : 0;
            } catch {
              // The content may remain readable even when metadata lookup is denied.
            }
          }
          incoming.push({
            id: `shared-${Date.now()}-${index}-${file.fileName ?? "file"}`,
            name: file.fileName ?? `shared-file-${index + 1}`,
            sizeBytes: measuredSize,
            uri: file.path,
            mimeType: file.mimeType ?? undefined,
          });
        }

        const sharedText = shareIntent.text?.trim() || shareIntent.webUrl?.trim();
        if (sharedText) {
          const textFile = await platformFeatureService.createClipboardBeamFile(sharedText);
          if (textFile) incoming.push(textFile);
        }

        if (!cancelled && incoming.length > 0) {
          setSharedFiles((current) => [
            ...current,
            ...incoming.filter(
              (file) => !current.some((existing) => existing.uri === file.uri && existing.name === file.name),
            ),
          ]);
          AndroidShareService.handleIncomingFiles(incoming);
        }
      } catch (error) {
        console.warn("[ShareIntent] Unable to prepare shared content:", error);
      } finally {
        resetShareIntent();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hasShareIntent, shareIntent, resetShareIntent]);

  return { sharedFiles, setSharedFiles };
};
