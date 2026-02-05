import { useEffect, useMemo, useState } from 'react';

import {
  createTransferFromIncoming,
  createTransferJob,
  progressTransfer,
} from '@/services/transferService';
import { IncomingTransferRequest, TransferJob } from '@/types/domain';

const TICK_MS = 1_100;

export const useTransferManager = () => {
  const [transfers, setTransfers] = useState<TransferJob[]>([]);
  const [pendingIncomingRequest, setPendingIncomingRequest] = useState<IncomingTransferRequest | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setTransfers((current) => current.map(progressTransfer));
    }, TICK_MS);

    return () => clearInterval(timer);
  }, []);

  const startTransfer = (targetDeviceName: string) => {
    const files = ['holiday-clip.mov', 'invoice.pdf', 'family-photo.heic'];
    const totalSize = 6.2 * 1024 * 1024 * 1024;
    const job = createTransferJob(files, totalSize, 'This Device', targetDeviceName);
    setTransfers((current) => [job, ...current]);
  };

  const togglePause = (id: string) => {
    setTransfers((current) =>
      current.map((job) => {
        if (job.id !== id || job.status === 'completed' || job.status === 'failed' || job.status === 'rejected') {
          return job;
        }

        return {
          ...job,
          status: job.status === 'paused' ? 'in-progress' : 'paused',
          updatedAt: Date.now(),
        };
      }),
    );
  };

  const mockIncomingRequest = () => {
    setPendingIncomingRequest({
      id: `${Date.now()}-incoming`,
      fromDeviceName: 'Office iPad',
      fileNames: ['pitch-deck.pptx', 'notes.txt'],
      sizeBytes: 820 * 1024 * 1024,
      requestedAt: Date.now(),
    });
  };

  const acceptIncomingRequest = () => {
    if (!pendingIncomingRequest) return;
    const job = createTransferFromIncoming(pendingIncomingRequest, 'This Device');
    setTransfers((current) => [job, ...current]);
    setPendingIncomingRequest(null);
  };

  const rejectIncomingRequest = () => {
    if (!pendingIncomingRequest) return;

    setTransfers((current) => [
      {
        id: `${pendingIncomingRequest.id}-rejected`,
        fileNames: pendingIncomingRequest.fileNames,
        sizeBytes: pendingIncomingRequest.sizeBytes,
        progress: 0,
        status: 'rejected',
        fromDeviceName: pendingIncomingRequest.fromDeviceName,
        toDeviceName: 'This Device',
        encrypted: true,
        startedAt: Date.now(),
        updatedAt: Date.now(),
      },
      ...current,
    ]);
    setPendingIncomingRequest(null);
  };

  const activeTransferExists = useMemo(
    () => transfers.some((job) => job.status === 'in-progress' || job.status === 'queued'),
    [transfers],
  );

  return {
    transfers,
    startTransfer,
    togglePause,
    activeTransferExists,
    pendingIncomingRequest,
    mockIncomingRequest,
    acceptIncomingRequest,
    rejectIncomingRequest,
  };
};
