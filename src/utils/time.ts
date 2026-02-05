export const formatRelativeTime = (timestamp: number | null): string => {
  if (!timestamp) return 'Never';

  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));

  if (seconds < 5) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;

  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;

  const hours = Math.floor(mins / 60);
  return `${hours}h ago`;
};
