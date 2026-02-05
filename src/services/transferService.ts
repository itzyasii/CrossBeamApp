import { IncomingTransferRequest, TransferJob } from '@/types/domain';

const FIVE_GB = 5 * 1024 * 1024 * 1024;

export const supportsLargeTransfer = (sizeBytes: number): boolean => sizeBytes >= FIVE_GB;

export const createTransferJob = (
  fileNames: string[],
  sizeBytes: number,
  fromDeviceName: string,
  toDeviceName: string,
): TransferJob => {
  const now = Date.now();

  return {
    id: `${now}-${Math.random().toString(16).slice(2)}`,
    fileNames,
    sizeBytes,
    progress: 0,
    status: 'queued',
    fromDeviceName,
    toDeviceName,
    encrypted: true,
    startedAt: now,
    updatedAt: now,
  };
};

export const createTransferFromIncoming = (
  request: IncomingTransferRequest,
  receiverDeviceName: string,
): TransferJob => createTransferJob(request.fileNames, request.sizeBytes, request.fromDeviceName, receiverDeviceName);

export const progressTransfer = (job: TransferJob): TransferJob => {
  if (job.status === 'paused' || job.status === 'failed' || job.status === 'completed' || job.status === 'rejected') {
    return job;
  }

  const progress = Math.min(job.progress + 8, 100);
  const now = Date.now();

  return {
    ...job,
    progress,
    status: progress === 100 ? 'completed' : 'in-progress',
    updatedAt: now,
  };
};

export const formatSize = (sizeBytes: number): string => {
  const gb = sizeBytes / (1024 * 1024 * 1024);
  if (gb >= 1) {
    return `${gb.toFixed(gb >= 10 ? 0 : 1)} GB`;
  }

  const mb = sizeBytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
};
