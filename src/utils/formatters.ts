export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatDurationHMS(seconds: number, includeMs = false): string {
  if (isNaN(seconds) || seconds < 0) return '00:00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);

  const pad = (n: number) => n.toString().padStart(2, '0');
  const base = `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  return includeMs ? `${base}.${pad(ms)}` : base;
}

export function formatDurationShort(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const pad = (n: number) => n.toString().padStart(2, '0');
  if (hrs > 0) {
    return `${hrs}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

export function formatEta(seconds?: number): string {
  if (seconds === undefined || isNaN(seconds) || seconds < 0) return 'Calculating...';
  if (seconds === 0) return '00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const pad = (n: number) => n.toString().padStart(2, '0');
  if (hrs > 0) {
    return `${hrs}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

export function formatTimeRemaining(seconds?: number): string {
  if (seconds === undefined || isNaN(seconds) || seconds < 0) return 'Calculating...';
  if (seconds === 0) return '0s remaining';
  if (seconds < 60) return `${Math.ceil(seconds)}s remaining`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.ceil(seconds % 60);
  return `${mins}m ${secs.toString().padStart(2, '0')}s remaining`;
}

export function calculateRepetitions(
  originalDurationSeconds: number,
  targetDurationSeconds: number
): {
  loops: number;
  exactTime: string;
  hasTrim: boolean;
  trimDurationSeconds: number;
} {
  if (!originalDurationSeconds || originalDurationSeconds <= 0) {
    return { loops: 0, exactTime: '00:00:00', hasTrim: false, trimDurationSeconds: 0 };
  }

  const loops = Math.ceil(targetDurationSeconds / originalDurationSeconds);
  const totalRawDuration = loops * originalDurationSeconds;
  const overshoot = totalRawDuration - targetDurationSeconds;
  const hasTrim = overshoot > 0.001;

  return {
    loops,
    exactTime: formatDurationHMS(targetDurationSeconds),
    hasTrim,
    trimDurationSeconds: hasTrim ? originalDurationSeconds - overshoot : originalDurationSeconds,
  };
}
