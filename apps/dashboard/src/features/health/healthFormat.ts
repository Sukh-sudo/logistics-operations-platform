export const formatUptime = (seconds?: number) => {
  if (seconds == null) return 'Not reported';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return [days && `${days}d`, hours && `${hours}h`, `${minutes}m`].filter(Boolean).join(' ');
};

export const isHealthyStatus = (value?: string) => ['ok', 'connected', 'available', 'healthy', 'up'].includes(value?.toLowerCase() ?? '');
