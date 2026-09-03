import React, { useRef, useState } from 'react';
import { UploadCloud, Film, PlayCircle, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { VideoMetadata } from '../types';
import { formatBytes } from '../utils/formatters';

interface VideoUploaderProps {
  onVideoUploaded: (fileId: string, metadata: VideoMetadata, file?: File) => void;
  maxUploadSizeMb?: number;
  onError: (msg: string) => void;
  isUploading?: boolean;
  uploadProgress?: number;
}

const CHUNK_SIZE = 3 * 1024 * 1024; // 3MB chunks for maximum network stability & proxy compliance

export const VideoUploader: React.FC<VideoUploaderProps> = ({
  onVideoUploaded,
  maxUploadSizeMb = 500,
  onError,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoadingSample, setIsLoadingSample] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadedBytes, setUploadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [currentFilename, setCurrentFilename] = useState('');
  const [uploadStatusText, setUploadStatusText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const uploadChunkWithRetry = async (
    chunk: Blob,
    sessionId: string,
    chunkIndex: number,
    totalChunks: number,
    maxRetries = 3
  ): Promise<void> => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch(
          `/api/upload/chunk?sessionId=${encodeURIComponent(sessionId)}&chunkIndex=${chunkIndex}&totalChunks=${totalChunks}`,
          {
            method: 'POST',
            body: chunk,
            headers: {
              'Content-Type': 'application/octet-stream',
              'x-session-id': sessionId,
              'x-chunk-index': String(chunkIndex),
              'x-total-chunks': String(totalChunks),
            },
          }
        );

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`HTTP ${res.status}: ${errText.slice(0, 100)}`);
        }

        const data = await res.json();
        if (data.success) {
          return;
        }
        throw new Error(data.error || `Chunk ${chunkIndex} failed`);
      } catch (err: any) {
        if (attempt === maxRetries) {
          throw err;
        }
        // Wait before retry
        setUploadStatusText(`Retrying part ${chunkIndex + 1}/${totalChunks} (Attempt ${attempt + 1})...`);
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  };

  const processFile = async (file: File) => {
    // Validate type
    const validExtensions = ['.mp4', '.mov', '.webm', '.mkv', '.avi', '.m4v', '.wmv', '.flv'];
    const hasValidExt = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));
    if (!file.type.startsWith('video/') && !hasValidExt) {
      onError('Unsupported video format. Please upload a video file (MP4, MOV, WebM, MKV, AVI).');
      return;
    }

    // Validate size
    if (file.size > maxUploadSizeMb * 1024 * 1024) {
      onError(`File exceeds the maximum upload limit of ${maxUploadSizeMb} MB.`);
      return;
    }

    setUploading(true);
    setProgress(0);
    setUploadedBytes(0);
    setTotalBytes(file.size);
    setCurrentFilename(file.name);
    setUploadStatusText('Preparing high-speed upload...');

    try {
      const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));

      // Step 1: Initialize upload session
      setUploadStatusText('Initializing upload session...');
      const initRes = await fetch('/api/upload/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          filesize: file.size,
          totalChunks,
        }),
      });

      if (!initRes.ok) {
        const initErr = await initRes.json().catch(() => ({ error: 'Upload initialization failed.' }));
        throw new Error(initErr.error || `Server initialization failed (HTTP ${initRes.status})`);
      }

      const { sessionId } = await initRes.json();
      if (!sessionId) {
        throw new Error('Invalid upload session token received from server.');
      }

      // Step 2: Upload chunks sequentially
      let bytesUploaded = 0;
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(file.size, (i + 1) * CHUNK_SIZE);
        const chunkBlob = file.slice(start, end);

        setUploadStatusText(
          totalChunks > 1
            ? `Uploading part ${i + 1} of ${totalChunks}...`
            : 'Uploading video stream...'
        );

        await uploadChunkWithRetry(chunkBlob, sessionId, i, totalChunks);

        bytesUploaded += chunkBlob.size;
        const currentPercent = Math.min(98, Math.round((bytesUploaded / file.size) * 100));
        setProgress(currentPercent);
        setUploadedBytes(bytesUploaded);
      }

      // Step 3: Finalize & probe video
      setUploadStatusText('Assembling & analyzing video streams with FFmpeg...');
      setProgress(99);

      const completeRes = await fetch('/api/upload/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          originalFilename: file.name,
        }),
      });

      const completeData = await completeRes.json().catch(() => null);

      if (!completeRes.ok || !completeData || !completeData.fileId || !completeData.metadata) {
        throw new Error(
          completeData?.error ||
            `Failed to finalize upload (${completeRes.status}). Please check video file integrity.`
        );
      }

      setProgress(100);
      setUploading(false);
      onVideoUploaded(completeData.fileId, completeData.metadata, file);
    } catch (err: any) {
      console.error('Upload failed:', err);
      setUploading(false);
      onError(err.message || 'Upload interrupted. Please check your connection and try again.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const handleLoadSample = async (type: 'nature' | 'countdown' | 'ambient') => {
    setIsLoadingSample(true);
    try {
      const res = await fetch(`/api/sample?type=${type}`);
      if (!res.ok) {
        throw new Error('Failed to load sample video.');
      }
      const data = await res.json();
      onVideoUploaded(data.fileId, data.metadata);
    } catch (err: any) {
      onError(err.message || 'Could not load sample video.');
    } finally {
      setIsLoadingSample(false);
    }
  };

  return (
    <div className="w-full">
      <div
        id="video-drop-zone"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`relative group cursor-pointer border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center transition-all duration-300 backdrop-blur-xl ${
          isDragOver
            ? 'border-cyan-400 bg-cyan-950/40 shadow-2xl shadow-cyan-500/20 scale-[1.01]'
            : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/60 hover:bg-zinc-900/90 shadow-xl'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*,.mp4,.mov,.webm,.mkv,.avi,.m4v,.wmv,.flv"
          className="hidden"
          onChange={handleFileChange}
        />

        {uploading ? (
          <div className="flex flex-col items-center justify-center py-6 space-y-4 animate-in fade-in">
            <div className="relative">
              <Loader2 className="w-14 h-14 text-cyan-400 animate-spin" />
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold font-mono text-white">
                {progress}%
              </span>
            </div>
            <div className="space-y-1.5 text-center">
              <p className="text-base font-semibold text-white">Uploading {currentFilename}...</p>
              <p className="text-xs text-cyan-400 font-medium">{uploadStatusText}</p>
              <p className="text-xs text-zinc-400 font-mono">
                {formatBytes(uploadedBytes)} / {formatBytes(totalBytes)}
              </p>
            </div>
            <div className="w-64 sm:w-80 h-2.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-zinc-800 to-zinc-700/80 border border-zinc-700 flex items-center justify-center group-hover:scale-105 group-hover:border-cyan-500/50 transition-all duration-300 shadow-lg shadow-black/40 text-cyan-400">
              <UploadCloud className="w-10 h-10 group-hover:text-cyan-300 transition-colors" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-xl font-bold text-white tracking-tight flex items-center justify-center gap-2">
                🎬 Upload Video
              </h3>
              <p className="text-base text-zinc-300 font-medium">
                Drag & Drop Here or{' '}
                <span className="text-cyan-400 underline underline-offset-4 decoration-cyan-500/50 hover:text-cyan-300">
                  Browse Files
                </span>
              </p>
              <p className="text-xs text-zinc-500">
                Supports MP4, MOV, WebM, MKV, AVI • Up to {maxUploadSizeMb} MB
              </p>
            </div>

            <button
              type="button"
              id="browse-files-button"
              className="mt-2 px-6 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-sm font-semibold transition-all shadow-md hover:text-white cursor-pointer"
            >
              Browse Files
            </button>
          </div>
        )}
      </div>

      {/* Instant Sample Clip Selector */}
      <div className="mt-4 p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span>No video handy? Test immediately with a sample clip:</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isLoadingSample || uploading}
            onClick={() => handleLoadSample('nature')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition hover:text-cyan-300 disabled:opacity-50 cursor-pointer"
          >
            <Film className="w-3.5 h-3.5" />
            <span>8s Color Bar Clip</span>
          </button>
          <button
            type="button"
            disabled={isLoadingSample || uploading}
            onClick={() => handleLoadSample('countdown')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition hover:text-cyan-300 disabled:opacity-50 cursor-pointer"
          >
            <PlayCircle className="w-3.5 h-3.5" />
            <span>8s Timer Clip</span>
          </button>
        </div>
      </div>
    </div>
  );
};
