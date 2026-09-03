export type JobStatus =
  | 'queued'
  | 'uploading'
  | 'analyzing'
  | 'processing'
  | 'verifying'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface VideoMetadata {
  filename: string;
  originalFilename: string;
  filesize: number;
  duration: number; // in seconds
  formattedDuration: string;
  width: number;
  height: number;
  resolution: string;
  fps: number;
  format: string;
  videoCodec: string;
  hasAudio: boolean;
  audioCodec?: string;
  audioChannels?: number;
  audioSampleRate?: number;
  bitrate?: number;
}

export interface OutputMetadata {
  filename: string;
  filesize: number;
  duration: number;
  formattedDuration: string;
  resolution: string;
  videoCodec: string;
  audioCodec?: string;
  verified: boolean;
}

export interface ProcessingJob {
  jobId: string;
  status: JobStatus;
  progress: number; // 0 to 100
  stage: string;
  originalDuration: number;
  targetDuration: number;
  repetitions: number;
  inputFile: string;
  outputFile?: string;
  originalMetadata: VideoMetadata;
  outputMetadata?: OutputMetadata;
  createdAt: number;
  completedAt?: number;
  error?: string;
  downloadFilename: string;
  // Real-time backend processing metrics
  processedDuration?: number; // seconds generated so far
  completedLoops?: number; // actual completed repetitions
  totalLoops?: number; // total repetitions required
  remainingLoops?: number; // remaining repetitions
  remainingDuration?: number; // targetDuration - processedDuration
  processingSpeed?: string; // e.g. "2.8x"
  speedMultiplier?: number; // numeric e.g. 2.8
  eta?: number; // estimated remaining seconds
  estimatedRemainingSeconds?: number;
  currentFps?: number;
}
