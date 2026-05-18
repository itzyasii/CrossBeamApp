import { useEffect, useState } from 'react';
import { useShareIntent as useExpoShareIntent } from 'expo-share-intent';
import AndroidShareService from '../services/AndroidShareService';

export const useShareIntent = () => {
  const { hasShareIntent, shareIntent, resetShareIntent } = useExpoShareIntent();
  const [sharedFiles, setSharedFiles] = useState<{ id: string; name: string; sizeBytes: number; uri: string; mimeType?: string }[]>([]);

  useEffect(() => {
    if (hasShareIntent && shareIntent) {
      if (shareIntent.type === 'file' || shareIntent.type === 'media') {
        const newFiles = (shareIntent.files || []).map((file, idx) => ({
          id: `shared-${Date.now()}-${idx}`,
          name: file.fileName ?? `shared-file-${idx}`,
          sizeBytes: 0,
          uri: file.path,
          mimeType: file.mimeType,
        }));
        
        setSharedFiles(current => [...current, ...newFiles]);
        AndroidShareService.handleIncomingFiles(newFiles);
        resetShareIntent();
      } else if (shareIntent.type === 'text') {
        resetShareIntent();
      }
    }
  }, [hasShareIntent, shareIntent, resetShareIntent]);

  return { sharedFiles, setSharedFiles };
};
