import { ShareIntentModule } from "expo-share-intent";
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
  /**
   * Get files shared to the app via Share Sheet
   */
  async getSharedFiles(): Promise<ShareIntentData> {
    try {
      const data = await ShareIntentModule.getShareIntentData?.();
      if (!data) {
        return { files: [], text: undefined, webUrl: undefined };
      }

      const files: SharedFile[] = [];

      // Handle file attachments
      if (Array.isArray(data.files)) {
        for (const file of data.files) {
          files.push({
            uri: file.uri,
            name: file.name || "Shared File",
            mimeType: file.type || "application/octet-stream",
            size: file.size,
          });
        }
      }

      return {
        files,
        text: data.text,
        webUrl: data.webUrl,
      };
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
      await ShareIntentModule.clearShareIntent?.();
    } catch (error) {
      console.error("Failed to clear share intent:", error);
    }
  },

  /**
   * Check if app was launched with shared files
   */
  async hasSharedFiles(): Promise<boolean> {
    try {
      const data = await ShareIntentModule.getShareIntentData?.();
      return data && (data.files?.length > 0 || !!data.text || !!data.webUrl);
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
      return ShareIntentModule.addShareIntentListener?.(async () => {
        const data = await this.getSharedFiles();
        callback(data);
      });
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
