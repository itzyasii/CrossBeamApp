const FIVE_GB = 5 * 1024 * 1024 * 1024;

export const supportsLargeTransfer = (sizeBytes: number): boolean =>
  sizeBytes >= FIVE_GB;

export const formatSize = (sizeBytes: number): string => {
  const gb = sizeBytes / (1024 * 1024 * 1024);
  if (gb >= 1) {
    return `${gb.toFixed(gb >= 10 ? 0 : 1)} GB`;
  }

  const mb = sizeBytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
};
