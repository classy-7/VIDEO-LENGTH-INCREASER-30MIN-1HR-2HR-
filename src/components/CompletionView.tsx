import React, { useEffect, useState, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  CheckCircle2,
  Download,
  RotateCcw,
  Play,
  ShieldCheck,
  Film,
  Clock,
  Repeat,
  Monitor,
  HardDrive,
  Loader2,
  Check,
  AlertTriangle,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { ProcessingJob } from '../types';
import { formatBytes, formatDurationHMS } from '../utils/formatters';
import { VideoPlayer } from './VideoPlayer';

interface CompletionViewProps {
  job: ProcessingJob;
  onReset: () => void;
  onTryAnotherDuration: () => void;
}

const DOWNLOAD_CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB chunks for high-speed, proxy-safe reliable transfer

export const CompletionView: React.FC<CompletionViewProps> = ({
  job,
  onReset,
  onTryAnotherDuration,
}) => {
  const [showPreviewPlayer, setShowPreviewPlayer] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [downloadedBytes, setDownloadedBytes] = useState<number>(0);
  const [totalBytes, setTotalBytes] = useState<number>(0);
  const [downloadSpeed, setDownloadSpeed] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [blobDownloadUrl, setBlobDownloadUrl] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Fire celebratory confetti on mount
    try {
      confetti({
        particleCount: 75,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#06b6d4', '#6366f1', '#10b981', '#ffffff'],
      });
    } catch {}

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (blobDownloadUrl) {
        URL.revokeObjectURL(blobDownloadUrl);
      }
    };
  }, [blobDownloadUrl]);

  const downloadEndpoint = `/api/download/${job.jobId}`;
  const previewUrl = `/api/preview/${job.jobId}`;

  // Helper to fetch a single byte chunk with retry
  const fetchChunkWithRetry = async (
    start: number,
    end: number,
    total: number,
    signal: AbortSignal,
    maxRetries = 3
  ): Promise<Uint8Array> => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(downloadEndpoint, {
          headers: {
            Range: `bytes=${start}-${end}`,
          },
          signal,
          cache: 'no-store',
        });

        if (!response.ok && response.status !== 206) {
          throw new Error(`HTTP ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        return new Uint8Array(arrayBuffer);
      } catch (err: any) {
        if (signal.aborted) throw err;
        if (attempt === maxRetries) throw err;
        // Exponential backoff
        await new Promise((r) => setTimeout(r, 600 * attempt));
      }
    }
    throw new Error(`Failed to download range ${start}-${end}`);
  };

  // High-Resiliency Chunked Range Streaming Download Engine
  const startStreamDownload = async () => {
    // If we already downloaded the full blob in this session, trigger instant save
    if (blobDownloadUrl) {
      const link = document.createElement('a');
      link.href = blobDownloadUrl;
      link.download = job.downloadFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setDownloadSuccess(true);
      return;
    }

    setIsDownloading(true);
    setDownloadProgress(0);
    setDownloadedBytes(0);
    setDownloadError(null);
    setDownloadSuccess(false);
    setStatusMessage('Connecting to video server...');

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const startTime = Date.now();
    let lastTime = startTime;
    let lastBytes = 0;

    try {
      // 1. Fetch metadata info
      let fileSize = job.outputMetadata?.filesize || 0;
      let filename = job.downloadFilename || `extended-video-${job.jobId.slice(0, 8)}.mp4`;

      try {
        const infoRes = await fetch(`/api/download-info/${job.jobId}`, {
          signal: abortController.signal,
          cache: 'no-store',
        });
        if (infoRes.ok) {
          const infoData = await infoRes.json();
          if (infoData.filesize) fileSize = infoData.filesize;
          if (infoData.filename) filename = infoData.filename;
        }
      } catch (e) {
        console.warn('Could not fetch download-info, using job metadata size:', e);
      }

      setTotalBytes(fileSize);

      const chunks: Uint8Array[] = [];
      let totalReceived = 0;

      // If file size is valid, use resilient Range chunking
      if (fileSize > 0) {
        const totalChunks = Math.max(1, Math.ceil(fileSize / DOWNLOAD_CHUNK_SIZE));

        for (let i = 0; i < totalChunks; i++) {
          if (abortController.signal.aborted) break;

          const start = i * DOWNLOAD_CHUNK_SIZE;
          const end = Math.min(fileSize - 1, (i + 1) * DOWNLOAD_CHUNK_SIZE - 1);

          setStatusMessage(
            totalChunks > 1
              ? `Downloading part ${i + 1} of ${totalChunks}...`
              : 'Streaming video data...'
          );

          const chunk = await fetchChunkWithRetry(
            start,
            end,
            fileSize,
            abortController.signal
          );
          chunks.push(chunk);
          totalReceived += chunk.length;

          setDownloadedBytes(totalReceived);
          const percent = Math.min(99, Math.round((totalReceived / fileSize) * 100));
          setDownloadProgress(percent);

          // Calculate current speed
          const now = Date.now();
          if (now - lastTime > 400) {
            const timeDiff = (now - lastTime) / 1000;
            const bytesDiff = totalReceived - lastBytes;
            const speedBps = bytesDiff / timeDiff;
            setDownloadSpeed(`${(speedBps / (1024 * 1024)).toFixed(1)} MB/s`);
            lastTime = now;
            lastBytes = totalReceived;
          }
        }
      } else {
        // Fallback: Full stream fetch if fileSize unknown
        setStatusMessage('Streaming full video stream...');
        const response = await fetch(downloadEndpoint, {
          signal: abortController.signal,
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error(`Server error: HTTP ${response.status}`);
        }

        if (!response.body) {
          throw new Error('ReadableStream not supported by browser.');
        }

        const reader = response.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            totalReceived += value.length;
            setDownloadedBytes(totalReceived);
          }
        }
      }

      if (totalReceived < 10000) {
        throw new Error(`Downloaded file was incomplete (${totalReceived} bytes). Please retry.`);
      }

      setDownloadProgress(100);
      setDownloadedBytes(totalReceived);
      setStatusMessage('Assembling video file in browser...');

      // Create browser Blob URL
      const blob = new Blob(chunks, { type: 'video/mp4' });
      const localBlobUrl = URL.createObjectURL(blob);
      setBlobDownloadUrl(localBlobUrl);

      // Trigger instant save to disk
      const link = document.createElement('a');
      link.href = localBlobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setDownloadSuccess(true);
      try {
        confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
      } catch {}
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Download aborted by user');
      } else {
        console.error('Download stream error:', err);
        setDownloadError(err.message || 'Failed to download video file. Please retry.');
      }
    } finally {
      setIsDownloading(false);
    }
  };

  const cancelDownload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsDownloading(false);
    setDownloadProgress(0);
  };

  return (
    <div className="w-full bg-zinc-900/90 border border-zinc-800 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-2xl space-y-8">
      {/* Top Banner */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-300 text-xs font-semibold uppercase tracking-wider">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Full Video Extended & Verified</span>
        </div>

        <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight uppercase flex items-center justify-center gap-3">
          <span className="text-emerald-400">✓</span> VIDEO READY FOR DOWNLOAD
        </h2>

        <p className="text-sm sm:text-base text-zinc-300 max-w-lg mx-auto">
          Your video has been looped and rendered to the exact duration of{' '}
          <strong className="text-white font-mono">
            {job.outputMetadata?.formattedDuration || formatDurationHMS(job.targetDuration)}
          </strong>.
        </p>

        {job.outputMetadata?.verified && (
          <div className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-mono bg-emerald-950/40 px-3 py-1 rounded-lg border border-emerald-900/50">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>
              Duration Verified: {job.outputMetadata.formattedDuration} • Size:{' '}
              {formatBytes(job.outputMetadata.filesize)}
            </span>
          </div>
        )}
      </div>

      {/* Metrics Card */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-left">
        {/* Original Duration */}
        <div className="p-3.5 rounded-2xl bg-zinc-950/70 border border-zinc-800/80">
          <div className="flex items-center gap-1 text-zinc-400 text-xs mb-1">
            <Film className="w-3.5 h-3.5 text-zinc-400" />
            <span>Original</span>
          </div>
          <div className="text-sm font-bold font-mono text-white">
            {formatDurationHMS(job.originalDuration)}
          </div>
        </div>

        {/* Final Duration */}
        <div className="p-3.5 rounded-2xl bg-zinc-950/70 border border-cyan-500/30">
          <div className="flex items-center gap-1 text-cyan-400 text-xs mb-1">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>Final Duration</span>
          </div>
          <div className="text-sm font-bold font-mono text-cyan-300">
            {job.outputMetadata?.formattedDuration || formatDurationHMS(job.targetDuration)}
          </div>
        </div>

        {/* Loops */}
        <div className="p-3.5 rounded-2xl bg-zinc-950/70 border border-zinc-800/80">
          <div className="flex items-center gap-1 text-zinc-400 text-xs mb-1">
            <Repeat className="w-3.5 h-3.5 text-indigo-400" />
            <span>Loops</span>
          </div>
          <div className="text-sm font-bold font-mono text-white">
            {job.repetitions}
          </div>
        </div>

        {/* Resolution */}
        <div className="p-3.5 rounded-2xl bg-zinc-950/70 border border-zinc-800/80">
          <div className="flex items-center gap-1 text-zinc-400 text-xs mb-1">
            <Monitor className="w-3.5 h-3.5 text-amber-400" />
            <span>Resolution</span>
          </div>
          <div className="text-sm font-bold font-mono text-white">
            {job.outputMetadata?.resolution || job.originalMetadata.resolution}
          </div>
        </div>

        {/* Format */}
        <div className="p-3.5 rounded-2xl bg-zinc-950/70 border border-zinc-800/80">
          <div className="flex items-center gap-1 text-zinc-400 text-xs mb-1">
            <Film className="w-3.5 h-3.5 text-emerald-400" />
            <span>Format</span>
          </div>
          <div className="text-sm font-bold font-mono text-white">
            MP4 (H.264)
          </div>
        </div>

        {/* Size */}
        <div className="p-3.5 rounded-2xl bg-zinc-950/70 border border-zinc-800/80">
          <div className="flex items-center gap-1 text-zinc-400 text-xs mb-1">
            <HardDrive className="w-3.5 h-3.5 text-sky-400" />
            <span>Output Size</span>
          </div>
          <div className="text-sm font-bold font-mono text-white">
            {job.outputMetadata?.filesize ? formatBytes(job.outputMetadata.filesize) : 'Ready'}
          </div>
        </div>
      </div>

      {/* Video Preview Player */}
      {showPreviewPlayer ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-300">
              Extended Video Playback ({job.outputMetadata?.formattedDuration || formatDurationHMS(job.targetDuration)})
            </span>
            <button
              onClick={() => setShowPreviewPlayer(false)}
              className="text-xs text-zinc-400 hover:text-white cursor-pointer"
            >
              Hide Player
            </button>
          </div>
          <VideoPlayer
            src={previewUrl}
            title={`Extended Video (${job.outputMetadata?.formattedDuration || formatDurationHMS(job.targetDuration)})`}
            autoPlay
          />
        </div>
      ) : (
        <div className="text-center">
          <button
            type="button"
            onClick={() => setShowPreviewPlayer(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700 transition shadow-md hover:scale-[1.01] cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 text-cyan-400 fill-cyan-400" />
            <span>▶ Play Full Extended Video in Browser</span>
          </button>
        </div>
      )}

      {/* In-Browser Streaming Progress Bar */}
      {isDownloading && (
        <div className="p-5 rounded-2xl bg-zinc-950/90 border border-cyan-500/40 shadow-xl space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-cyan-300 font-semibold">
              <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
              <span>{statusMessage}</span>
            </div>
            <div className="font-mono text-zinc-300">
              {downloadSpeed && <span className="text-cyan-400 mr-2">{downloadSpeed}</span>}
              <span>{formatBytes(downloadedBytes)}</span>
              {totalBytes > 0 && (
                <span>
                  {' '}
                  / {formatBytes(totalBytes)} ({downloadProgress}%)
                </span>
              )}
            </div>
          </div>

          {/* Progress bar track */}
          <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden relative">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 via-indigo-500 to-emerald-400 transition-all duration-200 rounded-full shadow-[0_0_12px_rgba(6,182,212,0.5)]"
              style={{ width: `${downloadProgress}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>High-speed chunked binary transfer directly to local disk</span>
            <button
              type="button"
              onClick={cancelDownload}
              className="text-red-400 hover:text-red-300 hover:underline cursor-pointer"
            >
              Cancel Transfer
            </button>
          </div>
        </div>
      )}

      {/* Success Notification */}
      {downloadSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-sm flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <Check className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <p className="font-bold text-white">Full Video Downloaded Successfully!</p>
              <p className="text-xs text-emerald-300/90 font-mono">
                Saved {formatBytes(downloadedBytes || job.outputMetadata?.filesize || 0)} as{' '}
                {job.downloadFilename}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={startStreamDownload}
            className="text-xs bg-emerald-800/80 hover:bg-emerald-700 text-white font-semibold px-3 py-1.5 rounded-lg border border-emerald-600 transition cursor-pointer"
          >
            Save Again
          </button>
        </div>
      )}

      {/* Error Alert if any */}
      {downloadError && (
        <div className="p-4 rounded-2xl bg-red-950/60 border border-red-500/40 text-red-200 text-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="space-y-1 flex-1">
            <p className="font-semibold">{downloadError}</p>
            <p className="text-xs text-red-300/80">
              Please click "Retry Download" to stream the video again.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={startStreamDownload}
              className="text-xs bg-red-800/80 hover:bg-red-700 text-white font-semibold px-3 py-1.5 rounded-lg border border-red-600 transition cursor-pointer"
            >
              Retry Download
            </button>
            <a
              href={downloadEndpoint}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2.5 py-1.5 rounded-lg border border-zinc-700 transition"
            >
              <ExternalLink className="w-3 h-3" />
              <span>Direct Link</span>
            </a>
          </div>
        </div>
      )}

      {/* Main Download and Actions */}
      <div className="space-y-4 pt-2">
        <button
          id="download-video-button"
          type="button"
          onClick={startStreamDownload}
          disabled={isDownloading}
          className="w-full py-4 px-8 rounded-2xl bg-gradient-to-r from-emerald-500 via-cyan-500 to-indigo-600 hover:from-emerald-400 hover:to-indigo-500 disabled:opacity-75 text-white font-black text-lg tracking-wide uppercase shadow-2xl shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 flex flex-wrap items-center justify-center gap-3 text-center cursor-pointer"
        >
          {isDownloading ? (
            <Loader2 className="w-6 h-6 animate-spin shrink-0" />
          ) : downloadSuccess ? (
            <Sparkles className="w-6 h-6 text-yellow-300 shrink-0" />
          ) : (
            <Download className="w-6 h-6 animate-bounce shrink-0" />
          )}

          <span>
            {isDownloading
              ? `STREAMING FILE (${downloadProgress}%)...`
              : downloadSuccess
              ? 'DOWNLOAD FULL VIDEO AGAIN'
              : '⬇ DOWNLOAD FULL VIDEO'}
          </span>

          {job.outputMetadata?.filesize && (
            <span className="text-sm font-mono font-bold bg-black/40 px-2.5 py-1 rounded-lg border border-white/20">
              {formatBytes(job.outputMetadata.filesize)}
            </span>
          )}
          <span className="text-xs font-mono font-normal opacity-90 lowercase bg-black/30 px-2 py-0.5 rounded truncate max-w-xs">
            {job.downloadFilename}
          </span>
        </button>

        {/* Navigation Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4 border-t border-zinc-800/80">
          <button
            type="button"
            onClick={onReset}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-semibold border border-zinc-700 transition cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Create Another Video</span>
          </button>

          <button
            type="button"
            onClick={onTryAnotherDuration}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-sm font-medium border border-zinc-800 transition cursor-pointer"
          >
            <span>Change Duration for this Video</span>
          </button>
        </div>
      </div>
    </div>
  );
};
