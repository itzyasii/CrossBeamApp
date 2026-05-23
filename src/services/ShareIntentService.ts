import { ShareIntentModule, parseShareIntent, getShareExtensionKey } from "expo-share-intent";
import { useEffect, useState } from "react";

export interface SharedFile {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
}

export interface ShareIntentData {
  files: SharedFile[];
  text?: string;
  webUrl?: string;
}

export const shareIntentService = {
  mapShareIntent(data: any): ShareIntentData {
    const files: SharedFile[] = (data.files || []).map((file: any) => ({
      uri: file.path,
      name: file.fileName || "Shared File",
      mimeType: file.mimeType || "application/octet-stream",
      size: file.size ?? undefined,
    }));

    return {
      files,
      text: data.text ?? undefined,
      webUrl: data.webUrl ?? undefined,
    };
  },

  /**
   * Get files shared to the app via Share Sheet
   */
  async getSharedFiles(): Promise<ShareIntentData> {
    try {
      if (!ShareIntentModule) {
        return { files: [], text: undefined, webUrl: undefined };
      }

      const raw = ShareIntentModule.getShareIntent("");
      if (!raw) return { files: [], text: undefined, webUrl: undefined };
      return this.mapShareIntent(parseShareIntent(raw, {}));
    } catch (error) {
      console.error("Failed to get shared files:", error);
      return { files: [], text: undefined, webUrl: undefined };
    }
  },

  /**
   * Clear share intent data after processing
   */
  async clearShareIntent(): Promise<void> {
    try {
      await ShareIntentModule?.clearShareIntent(getShareExtensionKey({}));
    } catch (error) {
      console.error("Failed to clear share intent:", error);
    }
  },

  /**
   * Check if app was launched with shared files
   */
  async hasSharedFiles(): Promise<boolean> {
    try {
      return ShareIntentModule?.hasShareIntent(getShareExtensionKey({})) ?? false;
    } catch (error) {
      console.error("Failed to check share intent:", error);
      return false;
    }
  },

  /**
   * Listen for incoming shares (when app is already running)
   */
  addShareIntentListener(
    callback: (data: ShareIntentData) => void,
  ): (() => void) | undefined {
    try {
      const subscription = ShareIntentModule?.addListener("onChange", (event) => {
        callback(this.mapShareIntent(parseShareIntent(event.value, {})));
      });
      return () => subscription?.remove();
    } catch (error) {
      console.error("Failed to add share intent listener:", error);
      return undefined;
    }
  },
};

/**
 * Hook to handle share intent data when app is launched or receives shares
 */
export const useShareIntent = () => {
  const [sharedData, setSharedData] = useState<ShareIntentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initShareIntent = async () => {
      try {
        setIsLoading(true);
        const data = await shareIntentService.getSharedFiles();
        if (data.files.length > 0 || data.text || data.webUrl) {
          setSharedData(data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    };

    initShareIntent();

    // Listen for incoming shares while app is running
    const unsubscribe = shareIntentService.addShareIntentListener((data) => {
      setSharedData(data);
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  return {
    sharedData,
    isLoading,
    error,
    clearSharedData: () => setSharedData(null),
  };
};
