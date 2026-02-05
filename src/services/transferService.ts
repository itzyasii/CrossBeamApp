import { TransferJob } from '@/types/domain';

const FIVE_GB = 5 * 1024 * 1024 * 1024;

export const createTransferJob = (
  fileName: string,
  sizeBytes: number,
  fromDeviceName: string,
  toDeviceName: string,
): TransferJob => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  fileName,
  sizeBytes,
  progress: 0,
  status: 'queued',
  fromDeviceName,
  toDeviceName,
  encrypted: true,
});

export const supportsLargeTransfer = (sizeBytes: number): boolean => sizeBytes > FIVE_GB;

export const nextProgress = (job: TransferJob): TransferJob => {
  if (job.status === 'paused' || job.status === 'failed' || job.status === 'completed') {
    return job;
  }

  const progress = Math.min(job.progress + 10, 100);
  return {
    ...job,
    status: progress === 100 ? 'completed' : 'in-progress',
    progress,
  };
};
