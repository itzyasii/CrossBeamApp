export const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
};

export const formatTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0s';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
};

export const calculateSpeed = (bytesTransferred: number, elapsedMs: number): number => {
  if (elapsedMs <= 0) return 0;
  return Math.floor(bytesTransferred / (elapsedMs / 1000));
};

export const calculateRemainingTime = (remainingBytes: number, bytesPerSecond: number): number => {
  if (bytesPerSecond <= 0) return 0;
  return Math.ceil(remainingBytes / bytesPerSecond);
};

export const calculatePercentage = (value: number, total: number): number => {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((value / total) * 100)));
};

export const formatDate = (timestamp: number): string => {
  const diffSeconds = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSeconds < 10) return 'Just now';
  if (diffSeconds < 60) return `${diffSeconds} seconds ago`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hours ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} days ago`;
};

export const generateRandomColor = (seed: string): string => {
  const palette = ['#2387AD', '#6E8BFF', '#1F9D69', '#B07800', '#CC3A33', '#7C5CFF'];
  const hash = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return palette[hash % palette.length];
};

export const debounce = <Args extends unknown[]>(
  fn: (...args: Args) => void,
  waitMs: number,
) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Args) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), waitMs);
  };
};

export const throttle = <Args extends unknown[]>(
  fn: (...args: Args) => void,
  waitMs: number,
) => {
  let lastRun = 0;
  return (...args: Args) => {
    const now = Date.now();
    if (now - lastRun >= waitMs) {
      lastRun = now;
      fn(...args);
    }
  };
};

export const retry = async <T>(
  task: () => Promise<T>,
  attempts = 3,
  backoffMs = 500,
): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, backoffMs * 2 ** attempt));
    }
  }
  throw lastError;
};

export const generateId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const deepClone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export const isEmpty = (value: unknown): boolean => {
  if (value == null) return true;
  if (typeof value === 'string' || Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
};

export const getFileExtension = (fileName: string): string => {
  const index = fileName.lastIndexOf('.');
  return index >= 0 ? fileName.slice(index + 1).toLowerCase() : '';
};

export const getFileNameWithoutExtension = (fileName: string): string => {
  const index = fileName.lastIndexOf('.');
  return index >= 0 ? fileName.slice(0, index) : fileName;
};

export const isValidFileSize = (size: number, maxSize: number): boolean =>
  size > 0 && size <= maxSize;

export const isValidEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export const isValidDeviceName = (value: string): boolean =>
  value.trim().length >= 2 && value.trim().length <= 64;

