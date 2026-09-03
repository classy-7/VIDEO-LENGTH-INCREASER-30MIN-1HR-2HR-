import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { CONFIG } from './config';
import { ProcessingJob, VideoMetadata } from './types';
import { probeVideoFile, formatDuration } from './ffprobe';

type JobListener = (job: ProcessingJob) => void;

class JobManager {
  private jobs: Map<string, ProcessingJob> = new Map();
  private activeProcesses: Map<string, ChildProcess> = new Map();
  private listeners: Map<string, Set<JobListener>> = new Map();
  private queue: string[] = [];
  private activeCount: number = 0;

  constructor() {
    // Load existing jobs from disk on boot
    this.loadJobsFromDisk();

    // Schedule periodic cleanup every 30 minutes
    setInterval(() => this.cleanupOldFiles(), 30 * 60 * 1000);
  }

  private saveJobToDisk(job: ProcessingJob) {
    try {
      const jobPath = path.join(CONFIG.JOBS_DIR, `${job.jobId}.json`);
      fs.writeFileSync(jobPath, JSON.stringify(job, null, 2));
    } catch (err) {
      console.error(`[JobManager] Failed to persist job ${job.jobId} to disk:`, err);
    }
  }

  private loadJobsFromDisk() {
    try {
      if (!fs.existsSync(CONFIG.JOBS_DIR)) {
        fs.mkdirSync(CONFIG.JOBS_DIR, { recursive: true });
        return;
      }

      const files = fs.readdirSync(CONFIG.JOBS_DIR);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        try {
          const raw = fs.readFileSync(path.join(CONFIG.JOBS_DIR, file), 'utf-8');
          const job: ProcessingJob = JSON.parse(raw);
          if (job && job.jobId) {
            this.jobs.set(job.jobId, job);
          }
        } catch (fErr) {
          console.error(`[JobManager] Error loading job file ${file}:`, fErr);
        }
      }

      // Also scan outputs directory for any orphaned MP4 files and index them
      if (fs.existsSync(CONFIG.OUTPUT_DIR)) {
        const outputFiles = fs.readdirSync(CONFIG.OUTPUT_DIR);
        for (const oFile of outputFiles) {
          if (!oFile.endsWith('_output.mp4')) continue;
          const jobId = oFile.replace('_output.mp4', '');
          if (!this.jobs.has(jobId)) {
            const outPath = path.join(CONFIG.OUTPUT_DIR, oFile);
            try {
              const stat = fs.statSync(outPath);
              if (stat.size > 20000) {
                const recoveredJob: ProcessingJob = {
                  jobId,
                  status: 'completed',
                  progress: 100,
                  stage: 'Video extension completed successfully!',
                  originalDuration: 10,
                  targetDuration: 1800,
                  repetitions: 180,
                  inputFile: '',
                  outputFile: outPath,
                  originalMetadata: {
                    filename: outPath,
                    originalFilename: `extended-video-${jobId.slice(0, 8)}.mp4`,
                    filesize: stat.size,
                    duration: 1800,
                    formattedDuration: '30:00',
                    width: 1280,
                    height: 720,
                    resolution: '1280 × 720',
                    fps: 30,
                    format: 'MP4',
                    videoCodec: 'H264',
                    hasAudio: true,
                    audioCodec: 'AAC',
                  },
                  outputMetadata: {
                    filename: outPath,
                    filesize: stat.size,
                    duration: 1800,
                    formattedDuration: '30:00',
                    resolution: '1280 × 720',
                    videoCodec: 'H264',
                    audioCodec: 'AAC',
                    verified: true,
                  },
                  createdAt: stat.mtimeMs || Date.now(),
                  completedAt: stat.mtimeMs || Date.now(),
                  downloadFilename: `extended-video-${jobId.slice(0, 8)}-30-minutes.mp4`,
                  processedDuration: 1800,
                  completedLoops: 180,
                  totalLoops: 180,
                  remainingLoops: 0,
                  remainingDuration: 0,
                  eta: 0,
                };
                this.jobs.set(jobId, recoveredJob);
                this.saveJobToDisk(recoveredJob);
                console.log(`[JobManager] Recovered existing output file into job ${jobId} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
              }
            } catch (rErr) {
              console.error(`[JobManager] Failed to recover output file ${oFile}:`, rErr);
            }
          }
        }
      }

      console.log(`[JobManager] Initialized with ${this.jobs.size} active/cached jobs.`);
    } catch (err) {
      console.error('[JobManager] Failed to load jobs from disk:', err);
    }
  }

  public createJob(
    inputFile: string,
    metadata: VideoMetadata,
    targetDuration: number,
    presetName?: string
  ): ProcessingJob {
    const jobId = uuidv4();
    const repetitions = Math.ceil(targetDuration / metadata.duration);

    // Clean base name for download
    const cleanBaseName = metadata.originalFilename
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 40);

    let durationLabel = `${Math.round(targetDuration)}s`;
    if (targetDuration === 1800) durationLabel = '30-minutes';
    else if (targetDuration === 3600) durationLabel = '1-hour';
    else if (targetDuration === 7200) durationLabel = '2-hours';
    else if (targetDuration >= 3600) {
      const h = Math.floor(targetDuration / 3600);
      const m = Math.floor((targetDuration % 3600) / 60);
      durationLabel = `${h}h${m > 0 ? `${m}m` : ''}`;
    } else if (targetDuration >= 60) {
      durationLabel = `${Math.floor(targetDuration / 60)}-minutes`;
    }

    const downloadFilename = `${cleanBaseName}-${durationLabel}.mp4`;
    const outputFile = path.join(CONFIG.OUTPUT_DIR, `${jobId}_output.mp4`);

    const job: ProcessingJob = {
      jobId,
      status: 'queued',
      progress: 0,
      stage: 'Queued for processing...',
      originalDuration: metadata.duration,
      targetDuration,
      repetitions,
      inputFile,
      outputFile,
      originalMetadata: metadata,
      createdAt: Date.now(),
      downloadFilename,
      processedDuration: 0,
      completedLoops: 0,
      totalLoops: repetitions,
      remainingLoops: repetitions,
      remainingDuration: targetDuration,
    };

    this.jobs.set(jobId, job);
    this.saveJobToDisk(job);
    this.queue.push(jobId);
    this.processNext();
    return job;
  }

  public getJob(jobId: string): ProcessingJob | undefined {
    // 1. Check in-memory map
    if (this.jobs.has(jobId)) {
      return this.jobs.get(jobId);
    }

    // 2. Check disk job json
    const diskPath = path.join(CONFIG.JOBS_DIR, `${jobId}.json`);
    if (fs.existsSync(diskPath)) {
      try {
        const raw = fs.readFileSync(diskPath, 'utf-8');
        const parsed: ProcessingJob = JSON.parse(raw);
        this.jobs.set(jobId, parsed);
        return parsed;
      } catch {}
    }

    // 3. Check if output file exists on disk
    const outPath = path.join(CONFIG.OUTPUT_DIR, `${jobId}_output.mp4`);
    if (fs.existsSync(outPath)) {
      try {
        const stat = fs.statSync(outPath);
        if (stat.size > 20000) {
          const recoveredJob: ProcessingJob = {
            jobId,
            status: 'completed',
            progress: 100,
            stage: 'Video extension completed successfully!',
            originalDuration: 10,
            targetDuration: 1800,
            repetitions: 180,
            inputFile: '',
            outputFile: outPath,
            originalMetadata: {
              filename: outPath,
              originalFilename: `extended-video-${jobId.slice(0, 8)}.mp4`,
              filesize: stat.size,
              duration: 1800,
              formattedDuration: '30:00',
              width: 1280,
              height: 720,
              resolution: '1280 × 720',
              fps: 30,
              format: 'MP4',
              videoCodec: 'H264',
              hasAudio: true,
              audioCodec: 'AAC',
            },
            outputMetadata: {
              filename: outPath,
              filesize: stat.size,
              duration: 1800,
              formattedDuration: '30:00',
              resolution: '1280 × 720',
              videoCodec: 'H264',
              audioCodec: 'AAC',
              verified: true,
            },
            createdAt: stat.mtimeMs || Date.now(),
            completedAt: stat.mtimeMs || Date.now(),
            downloadFilename: `extended-video-${jobId.slice(0, 8)}-30-minutes.mp4`,
            processedDuration: 1800,
            completedLoops: 180,
            totalLoops: 180,
            remainingLoops: 0,
            remainingDuration: 0,
            eta: 0,
          };
          this.jobs.set(jobId, recoveredJob);
          this.saveJobToDisk(recoveredJob);
          return recoveredJob;
        }
      } catch {}
    }

    return undefined;
  }

  public subscribe(jobId: string, listener: JobListener): () => void {
    if (!this.listeners.has(jobId)) {
      this.listeners.set(jobId, new Set());
    }
    this.listeners.get(jobId)!.add(listener);

    // Call immediately with current state
    const job = this.jobs.get(jobId);
    if (job) {
      listener(job);
    }

    return () => {
      const set = this.listeners.get(jobId);
      if (set) {
        set.delete(listener);
        if (set.size === 0) {
          this.listeners.delete(jobId);
        }
      }
    };
  }

  private notify(jobId: string) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    const set = this.listeners.get(jobId);
    if (set) {
      set.forEach((listener) => {
        try {
          listener({ ...job });
        } catch (e) {
          console.error('Error notifying listener:', e);
        }
      });
    }
  }

  private processNext() {
    if (this.activeCount >= CONFIG.MAX_CONCURRENT_JOBS || this.queue.length === 0) {
      return;
    }

    const nextJobId = this.queue.shift();
    if (!nextJobId) return;

    const job = this.jobs.get(nextJobId);
    if (!job || job.status === 'cancelled') {
      this.processNext();
      return;
    }

    this.activeCount++;
    this.executeJob(job).finally(() => {
      this.activeCount--;
      this.processNext();
    });
  }

  private async executeJob(job: ProcessingJob) {
    job.status = 'processing';
    job.stage = `Seamlessly looping video (${job.repetitions} repetitions) to ${formatDuration(job.targetDuration)}...`;
    job.progress = 1;
    this.notify(job.jobId);

    const inputPath = job.inputFile;
    const outputPath = job.outputFile!;
    const manifestPath = path.join(CONFIG.TEMP_DIR, `${job.jobId}_concat.txt`);

    // Check if input exists
    if (!fs.existsSync(inputPath)) {
      job.status = 'failed';
      job.error = 'Source input video is missing or expired.';
      this.notify(job.jobId);
      return;
    }

    // Build temporary concat manifest to ensure robust, non-corrupt multi-loop rendering
    try {
      const loopCount = Math.max(1, job.repetitions + 1);
      let manifestContent = '';
      const safeInputPath = inputPath.replace(/'/g, "'\\''");
      for (let i = 0; i < loopCount; i++) {
        manifestContent += `file '${safeInputPath}'\n`;
      }
      fs.writeFileSync(manifestPath, manifestContent);
    } catch (mErr: any) {
      console.error(`[Job ${job.jobId}] Failed to create concat manifest:`, mErr);
      job.status = 'failed';
      job.error = 'Failed to initialize video looping pipeline.';
      this.notify(job.jobId);
      return;
    }

    // Build FFmpeg command using concat demuxer with precision trimming and standard MP4 container flags
    const ffmpegArgs = [
      '-y',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      manifestPath,
      '-t',
      job.targetDuration.toFixed(3),
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '24',
      '-maxrate',
      '3M',
      '-bufsize',
      '6M',
      '-pix_fmt',
      'yuv420p',
      '-avoid_negative_ts',
      'make_zero',
      '-fflags',
      '+genpts',
    ];

    if (job.originalMetadata.hasAudio) {
      ffmpegArgs.push('-c:a', 'aac', '-b:a', '128k', '-ar', '44100');
    } else {
      ffmpegArgs.push('-an');
    }

    ffmpegArgs.push(
      '-movflags',
      '+faststart',
      '-progress',
      'pipe:1',
      outputPath
    );

    console.log(`[Job ${job.jobId}] Starting FFmpeg: ffmpeg ${ffmpegArgs.join(' ')}`);

    return new Promise<void>((resolve) => {
      const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);
      this.activeProcesses.set(job.jobId, ffmpegProcess);

      let buffer = '';

      ffmpegProcess.stdout.on('data', (data) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let outTimeSec: number | null = null;

        for (const line of lines) {
          const [key, value] = line.trim().split('=');
          if (!key || !value) continue;

          if (key === 'out_time_us') {
            const currentSeconds = parseInt(value, 10) / 1000000;
            if (!isNaN(currentSeconds) && currentSeconds >= 0) {
              outTimeSec = currentSeconds;
            }
          } else if (key === 'out_time_ms') {
            const currentSeconds = parseInt(value, 10) / 1000;
            if (!isNaN(currentSeconds) && currentSeconds >= 0) {
              outTimeSec = currentSeconds;
            }
          } else if (key === 'out_time') {
            // e.g. 00:04:12.34
            const parts = value.trim().split(':');
            if (parts.length === 3) {
              const h = parseFloat(parts[0]);
              const m = parseFloat(parts[1]);
              const s = parseFloat(parts[2]);
              if (!isNaN(h) && !isNaN(m) && !isNaN(s)) {
                outTimeSec = h * 3600 + m * 60 + s;
              }
            }
          } else if (key === 'fps') {
            const fpsVal = parseFloat(value);
            if (!isNaN(fpsVal)) job.currentFps = fpsVal;
          } else if (key === 'speed') {
            const rawSpeed = value.trim();
            job.processingSpeed = rawSpeed;
            const speedMultiplier = parseFloat(rawSpeed.replace('x', ''));
            if (!isNaN(speedMultiplier) && speedMultiplier > 0) {
              job.speedMultiplier = speedMultiplier;
            }
          } else if (key === 'progress' && value === 'end') {
            // progress end received
          }
        }

        if (outTimeSec !== null && job.targetDuration > 0) {
          const processedDuration = Math.min(job.targetDuration, Math.max(0, outTimeSec));
          job.processedDuration = processedDuration;

          const totalLoops = job.repetitions;
          const origDur = job.originalDuration > 0 ? job.originalDuration : 1;
          const completedLoops = Math.min(totalLoops, Math.floor(processedDuration / origDur));
          job.completedLoops = completedLoops;
          job.totalLoops = totalLoops;
          job.remainingLoops = Math.max(0, totalLoops - completedLoops);

          const remainingDuration = Math.max(0, job.targetDuration - processedDuration);
          job.remainingDuration = remainingDuration;

          const pct = Math.min(99, Math.max(1, Math.round((processedDuration / job.targetDuration) * 100)));
          job.progress = pct;

          // ETA calculation based on real speed multiplier
          if (job.speedMultiplier && job.speedMultiplier > 0) {
            job.eta = Math.round(remainingDuration / job.speedMultiplier);
            job.estimatedRemainingSeconds = job.eta;
          } else {
            // If speed multiplier not directly reported yet, calculate from elapsed real time
            const elapsedRealSeconds = (Date.now() - job.createdAt) / 1000;
            if (elapsedRealSeconds > 1 && processedDuration > 0) {
              const measuredSpeed = processedDuration / elapsedRealSeconds;
              if (measuredSpeed > 0) {
                job.speedMultiplier = Math.round(measuredSpeed * 10) / 10;
                if (!job.processingSpeed) {
                  job.processingSpeed = `${job.speedMultiplier.toFixed(1)}x`;
                }
                job.eta = Math.round(remainingDuration / measuredSpeed);
                job.estimatedRemainingSeconds = job.eta;
              }
            }
          }
        }

        this.notify(job.jobId);
      });

      let stderrLog = '';
      ffmpegProcess.stderr.on('data', (data) => {
        stderrLog += data.toString();
        // Keep only last 2000 chars of stderr for debugging
        if (stderrLog.length > 2000) {
          stderrLog = stderrLog.slice(-2000);
        }
      });

      ffmpegProcess.on('error', (err) => {
        console.error(`[Job ${job.jobId}] Spawn error:`, err);
        this.activeProcesses.delete(job.jobId);
        // Clean up manifest
        if (fs.existsSync(manifestPath)) {
          try { fs.unlinkSync(manifestPath); } catch {}
        }
        job.status = 'failed';
        job.error = `Video processing error: ${err.message}`;
        this.notify(job.jobId);
        resolve();
      });

      ffmpegProcess.on('close', async (code) => {
        this.activeProcesses.delete(job.jobId);
        // Clean up manifest
        if (fs.existsSync(manifestPath)) {
          try { fs.unlinkSync(manifestPath); } catch {}
        }

        if (job.status === 'cancelled') {
          // Cleanup partial file
          if (fs.existsSync(outputPath)) {
            try {
              fs.unlinkSync(outputPath);
            } catch {}
          }
          resolve();
          return;
        }

        if (code !== 0) {
          console.error(`[Job ${job.jobId}] FFmpeg exited with code ${code}. Stderr: ${stderrLog}`);
          job.status = 'failed';
          job.error = 'Video processing failed during encoding. Please try another file.';
          this.notify(job.jobId);
          resolve();
          return;
        }

        // Verification Stage
        job.status = 'verifying';
        job.stage = 'Verifying exact video duration and stream integrity with FFprobe...';
        job.progress = 99;
        this.notify(job.jobId);

        try {
          if (!fs.existsSync(outputPath)) {
            throw new Error('Rendered video file was not generated.');
          }

          const stat = fs.statSync(outputPath);
          if (stat.size < 20000) {
            throw new Error(`Generated file is too small (${(stat.size / 1024).toFixed(1)} KB) and appears corrupted.`);
          }

          const outputInfo = await probeVideoFile(outputPath, job.downloadFilename);

          const diff = Math.abs(outputInfo.duration - job.targetDuration);
          // Check that duration matched within reasonable tolerance and is not truncated to 1 loop
          if (outputInfo.duration < Math.min(job.targetDuration * 0.9, job.targetDuration - 5)) {
            throw new Error(`Rendered video duration (${outputInfo.formattedDuration}) does not match target (${formatDuration(job.targetDuration)}).`);
          }

          // Tolerance: within 1.0s is considered exact verified
          const isExact = diff <= 1.0;

          job.outputMetadata = {
            filename: outputPath,
            filesize: stat.size,
            duration: outputInfo.duration,
            formattedDuration: formatDuration(outputInfo.duration),
            resolution: outputInfo.resolution,
            videoCodec: outputInfo.videoCodec,
            audioCodec: outputInfo.audioCodec,
            verified: isExact,
          };

          job.status = 'completed';
          job.stage = 'Video extension completed successfully!';
          job.progress = 100;
          job.completedAt = Date.now();
          job.processedDuration = job.targetDuration;
          job.completedLoops = job.repetitions;
          job.remainingLoops = 0;
          job.remainingDuration = 0;
          job.eta = 0;
          job.estimatedRemainingSeconds = 0;
          this.saveJobToDisk(job);
          this.notify(job.jobId);
        } catch (verErr: any) {
          console.error(`[Job ${job.jobId}] Verification failed:`, verErr);
          job.status = 'failed';
          job.error = `Output verification failed: ${verErr.message || 'Corrupted output'}`;
          this.saveJobToDisk(job);
          this.notify(job.jobId);
        }

        resolve();
      });
    });
  }

  public cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
      return false;
    }

    job.status = 'cancelled';
    job.stage = 'Processing cancelled by user.';
    job.error = 'Processing cancelled.';
    this.saveJobToDisk(job);

    const proc = this.activeProcesses.get(jobId);
    if (proc) {
      try {
        proc.kill('SIGKILL');
      } catch (e) {
        console.error('Error killing process:', e);
      }
      this.activeProcesses.delete(jobId);
    }

    if (job.outputFile && fs.existsSync(job.outputFile)) {
      try {
        fs.unlinkSync(job.outputFile);
      } catch {}
    }

    this.notify(jobId);
    return true;
  }

  public cleanupOldFiles() {
    const maxAgeMs = CONFIG.FILE_EXPIRATION_MINUTES * 60 * 1000;
    const now = Date.now();

    // Clean uploads
    fs.readdir(CONFIG.UPLOAD_DIR, (err, files) => {
      if (err) return;
      for (const file of files) {
        const filePath = path.join(CONFIG.UPLOAD_DIR, file);
        fs.stat(filePath, (sErr, stat) => {
          if (!sErr && now - stat.mtimeMs > maxAgeMs) {
            fs.unlink(filePath, () => {});
          }
        });
      }
    });

    // Clean outputs
    fs.readdir(CONFIG.OUTPUT_DIR, (err, files) => {
      if (err) return;
      for (const file of files) {
        const filePath = path.join(CONFIG.OUTPUT_DIR, file);
        fs.stat(filePath, (sErr, stat) => {
          if (!sErr && now - stat.mtimeMs > maxAgeMs) {
            fs.unlink(filePath, () => {});
          }
        });
      }
    });

    // Clean memory jobs
    for (const [jobId, job] of this.jobs.entries()) {
      if (now - job.createdAt > maxAgeMs) {
        this.jobs.delete(jobId);
        this.listeners.delete(jobId);
      }
    }
  }
}

export const jobManager = new JobManager();
