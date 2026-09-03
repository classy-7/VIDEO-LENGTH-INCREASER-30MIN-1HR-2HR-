/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { HeroSection } from './components/HeroSection';
import { VideoUploader } from './components/VideoUploader';
import { VideoPlayer } from './components/VideoPlayer';
import { VideoMetadataCard } from './components/VideoMetadataCard';
import { DurationSelector } from './components/DurationSelector';
import { ProcessingView } from './components/ProcessingView';
import { CompletionView } from './components/CompletionView';
import { HowItWorks } from './components/HowItWorks';
import { VisualMathExplainer } from './components/VisualMathExplainer';
import { FAQSection } from './components/FAQSection';
import { Footer } from './components/Footer';
import { SettingsModal } from './components/SettingsModal';
import { VideoMetadata, ProcessingJob, AppSettings } from './types';
import { AlertTriangle, X } from 'lucide-react';

export default function App() {
  // App & Server State
  const [fileId, setFileId] = useState<string | null>(null);
  const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number>(3600); // 1 hour default
  const [activeJob, setActiveJob] = useState<ProcessingJob | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [maxUploadSizeMb, setMaxUploadSizeMb] = useState<number>(500);

  // User Settings
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('video_length_increaser_settings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return {
      autoDownload: false,
      soundNotification: true,
    };
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Save settings on update
  const handleUpdateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem('video_length_increaser_settings', JSON.stringify(updated));
      return updated;
    });
  };

  // Fetch server config on mount
  useEffect(() => {
    fetch('/api/config')
      .then((res) => res.json())
      .then((data) => {
        if (data.maxUploadSizeMb) {
          setMaxUploadSizeMb(data.maxUploadSizeMb);
        }
      })
      .catch(() => {});
  }, []);

  // Play pleasant notification sound via Web Audio API
  const playCompletionChime = () => {
    if (!settings.soundNotification) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } catch {}
  };

  // Video Upload Completed
  const handleVideoUploaded = (newFileId: string, metadata: VideoMetadata, localFile?: File) => {
    setFileId(newFileId);
    setVideoMetadata(metadata);
    setIsUploading(false);
    setErrorMessage(null);

    if (localFile) {
      const objUrl = URL.createObjectURL(localFile);
      setPreviewSrc(objUrl);
    } else {
      setPreviewSrc(`/api/preview-source/${newFileId}`);
    }
  };

  // Remove or Replace Video
  const handleRemoveVideo = () => {
    setFileId(null);
    setVideoMetadata(null);
    setPreviewSrc(null);
    setActiveJob(null);
    setErrorMessage(null);
  };

  // Start Video Creation Job
  const handleCreateVideo = async () => {
    if (!fileId || !videoMetadata) return;

    setErrorMessage(null);

    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId,
          targetDuration: selectedDuration,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to start video processing job.');
      }

      const job: ProcessingJob = await res.json();
      setActiveJob(job);

      // Start SSE stream listener for real-time progress
      setupJobEventListener(job.jobId);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error creating video job.');
    }
  };

  // Real-time EventSource & Polling listener
  const setupJobEventListener = (jobId: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }

    // Server-Sent Events
    const es = new EventSource(`/api/jobs/${jobId}/events`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const updatedJob: ProcessingJob = JSON.parse(event.data);
        setActiveJob(updatedJob);

        if (updatedJob.status === 'completed') {
          es.close();
          playCompletionChime();

          if (settings.autoDownload && updatedJob.jobId) {
            const dlLink = document.createElement('a');
            dlLink.href = `/api/download/${updatedJob.jobId}`;
            dlLink.download = updatedJob.downloadFilename;
            document.body.appendChild(dlLink);
            dlLink.click();
            document.body.removeChild(dlLink);
          }
        } else if (updatedJob.status === 'failed' || updatedJob.status === 'cancelled') {
          es.close();
          if (updatedJob.status === 'failed') {
            setErrorMessage(updatedJob.error || 'We couldn\'t process this video. Please try another file.');
          }
        }
      } catch (e) {
        console.error('Error parsing job event:', e);
      }
    };

    es.onerror = () => {
      // Fallback to polling if SSE encounters an issue
      es.close();
      startPolling(jobId);
    };
  };

  const startPolling = (jobId: string) => {
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        if (res.ok) {
          const job: ProcessingJob = await res.json();
          setActiveJob(job);

          if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
            if (pollingRef.current) clearInterval(pollingRef.current);
            if (job.status === 'completed') {
              playCompletionChime();
            } else if (job.status === 'failed') {
              setErrorMessage(job.error || 'We couldn\'t process this video. Please try another file.');
            }
          }
        }
      } catch {}
    }, 1500);
  };

  // Cancel running job
  const handleCancelJob = async () => {
    if (!activeJob) return;

    try {
      await fetch(`/api/jobs/${activeJob.jobId}/cancel`, { method: 'POST' });
    } catch {}

    if (eventSourceRef.current) eventSourceRef.current.close();
    if (pollingRef.current) clearInterval(pollingRef.current);

    setActiveJob(null);
  };

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close();
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-black">
      {/* Top Navigation */}
      <Header onOpenSettings={() => setIsSettingsOpen(true)} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
        {/* Hero Section */}
        <HeroSection />

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-800/80 text-rose-200 flex items-start justify-between gap-3 shadow-lg animate-in fade-in duration-200">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
              <p className="text-sm font-medium">{errorMessage}</p>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-400 hover:text-rose-200 p-1 rounded-lg hover:bg-rose-900/40"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Core Workflow State Switcher */}
        {activeJob && activeJob.status === 'completed' ? (
          /* State 4: Completed State */
          <CompletionView
            job={activeJob}
            onReset={handleRemoveVideo}
            onTryAnotherDuration={() => setActiveJob(null)}
          />
        ) : activeJob && (activeJob.status === 'processing' || activeJob.status === 'verifying' || activeJob.status === 'queued') ? (
          /* State 3: Active Processing State */
          <ProcessingView job={activeJob} onCancel={handleCancelJob} />
        ) : videoMetadata && previewSrc ? (
          /* State 2: Uploaded & Ready to Configure Duration */
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Metadata Card */}
            <VideoMetadataCard
              metadata={videoMetadata}
              onReplace={() => {
                const dropzone = document.getElementById('video-drop-zone');
                dropzone?.scrollIntoView({ behavior: 'smooth' });
                handleRemoveVideo();
              }}
              onRemove={handleRemoveVideo}
            />

            {/* Video Preview Player */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span className="font-semibold text-zinc-300">Original Video Preview</span>
                <span className="font-mono text-cyan-400 font-bold">{videoMetadata.formattedDuration}</span>
              </div>
              <VideoPlayer src={previewSrc} title="Original Upload" />
            </div>

            {/* Target Duration Selector & Action */}
            <DurationSelector
              originalDuration={videoMetadata.duration}
              selectedDuration={selectedDuration}
              onSelectDuration={setSelectedDuration}
              onCreateVideo={handleCreateVideo}
              isProcessing={false}
            />
          </div>
        ) : (
          /* State 1: Upload Prompt */
          <div className="space-y-6">
            <VideoUploader
              onVideoUploaded={handleVideoUploaded}
              maxUploadSizeMb={maxUploadSizeMb}
              onError={setErrorMessage}
              isUploading={isUploading}
              uploadProgress={uploadProgress}
            />
          </div>
        )}

        {/* Informational & Supporting Sections */}
        <div className="space-y-6 pt-6 border-t border-zinc-900">
          <VisualMathExplainer />
          <HowItWorks />
          <FAQSection />
        </div>
      </main>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        maxUploadSizeMb={maxUploadSizeMb}
      />

      {/* Footer */}
      <Footer />
    </div>
  );
}
