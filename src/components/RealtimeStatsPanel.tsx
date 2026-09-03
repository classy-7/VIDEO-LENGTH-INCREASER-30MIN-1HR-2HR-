import React from 'react';
import { Repeat, Clock, Gauge, Timer, CheckCircle2, AlertCircle, Film, Sparkles } from 'lucide-react';
import { ProcessingJob } from '../types';
import { formatDurationHMS, formatDurationShort, formatEta } from '../utils/formatters';

interface RealtimeStatsPanelProps {
  job: ProcessingJob;
}

export const RealtimeStatsPanel: React.FC<RealtimeStatsPanelProps> = ({ job }) => {
  // Extract or safely calculate derived backend statistics
  const targetDuration = Math.max(0, job.targetDuration || 0);
  const originalDuration = Math.max(0.001, job.originalDuration || 1);
  const totalLoops = Math.max(1, job.totalLoops || job.repetitions || Math.ceil(targetDuration / originalDuration));

  // Processed duration directly from backend out_time
  const processedDuration = Math.min(
    targetDuration,
    Math.max(0, job.processedDuration !== undefined ? job.processedDuration : (job.progress / 100) * targetDuration)
  );

  // Completed loops strictly bounded
  const completedLoops = Math.min(
    totalLoops,
    Math.max(0, job.completedLoops !== undefined ? job.completedLoops : Math.floor(processedDuration / originalDuration))
  );

  // Remaining loops
  const remainingLoops = Math.max(
    0,
    job.remainingLoops !== undefined ? job.remainingLoops : totalLoops - completedLoops
  );

  // Remaining media duration
  const remainingDuration = Math.max(
    0,
    job.remainingDuration !== undefined ? job.remainingDuration : targetDuration - processedDuration
  );

  // Processing speed display
  const speedDisplay = job.processingSpeed
    ? `${job.processingSpeed.replace('x', '')}× realtime`
    : job.speedMultiplier && job.speedMultiplier > 0
    ? `${job.speedMultiplier.toFixed(1)}× realtime`
    : 'Calculating...';

  // ETA display
  const etaSeconds = job.eta !== undefined ? job.eta : job.estimatedRemainingSeconds;
  const etaDisplay =
    job.status === 'completed'
      ? '00:00'
      : job.status === 'cancelled'
      ? 'Cancelled'
      : job.status === 'failed'
      ? 'Failed'
      : etaSeconds !== undefined && etaSeconds >= 0
      ? formatEta(etaSeconds)
      : 'Calculating...';

  const isFinished = job.status === 'completed';
  const isFailed = job.status === 'failed';
  const isCancelled = job.status === 'cancelled';

  return (
    <div
      id="realtime-processing-stats-panel"
      className="w-full max-w-xl mx-auto rounded-2xl bg-zinc-950/80 border border-zinc-800/80 p-4 sm:p-5 shadow-xl backdrop-blur-xl space-y-4 text-left transition-all duration-300"
    >
      {/* Top Card Header / Live Indicator */}
      <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
        <div className="flex items-center gap-2">
          <div className="relative flex h-2.5 w-2.5">
            {!isFinished && !isFailed && !isCancelled && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
            )}
            <span
              className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                isFinished
                  ? 'bg-emerald-400'
                  : isFailed
                  ? 'bg-rose-500'
                  : isCancelled
                  ? 'bg-amber-500'
                  : 'bg-cyan-400'
              }`}
            />
          </div>
          <span className="text-xs font-bold tracking-wider uppercase text-zinc-300">
            Real-Time Processing Statistics
          </span>
        </div>

        <span
          className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full border ${
            isFinished
              ? 'bg-emerald-950/60 border-emerald-500/30 text-emerald-300'
              : isFailed
              ? 'bg-rose-950/60 border-rose-500/30 text-rose-300'
              : isCancelled
              ? 'bg-amber-950/60 border-amber-500/30 text-amber-300'
              : 'bg-cyan-950/60 border-cyan-500/30 text-cyan-300'
          }`}
        >
          {isFinished
            ? '✓ Processing Complete'
            : isFailed
            ? 'Processing Failed'
            : isCancelled
            ? 'Processing Cancelled'
            : 'FFmpeg Engine Active'}
        </span>
      </div>

      {/* 2-Column Responsive Grid for Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Metric 1: Loops Completed */}
        <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800/90 flex flex-col justify-between hover:border-zinc-700 transition">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
            <span className="font-semibold uppercase tracking-wider text-[10px] text-zinc-400">
              Loops Completed
            </span>
            <Repeat className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white tracking-tight flex items-baseline gap-1.5">
            <span className="text-cyan-300">{completedLoops}</span>
            <span className="text-xs text-zinc-500 font-normal">/</span>
            <span className="text-zinc-400 text-sm">{totalLoops}</span>
            <span className="text-[11px] text-zinc-500 font-normal ml-auto">loops</span>
          </div>
        </div>

        {/* Metric 2: Loops Remaining */}
        <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800/90 flex flex-col justify-between hover:border-zinc-700 transition">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
            <span className="font-semibold uppercase tracking-wider text-[10px] text-zinc-400">
              Loops Remaining
            </span>
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white tracking-tight flex items-baseline justify-between">
            <span className={remainingLoops === 0 ? 'text-emerald-400' : 'text-indigo-300'}>
              {remainingLoops}
            </span>
            <span className="text-[11px] text-zinc-500 font-normal">loops remaining</span>
          </div>
        </div>

        {/* Metric 3: Processed Duration */}
        <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800/90 flex flex-col justify-between hover:border-zinc-700 transition">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
            <span className="font-semibold uppercase tracking-wider text-[10px] text-zinc-400">
              Processed Duration
            </span>
            <Film className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white tracking-tight flex items-baseline gap-1.5">
            <span className="text-sky-300">{formatDurationShort(processedDuration)}</span>
            <span className="text-xs text-zinc-500 font-normal">/</span>
            <span className="text-zinc-400 text-sm">{formatDurationShort(targetDuration)}</span>
          </div>
        </div>

        {/* Metric 4: Remaining Duration */}
        <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800/90 flex flex-col justify-between hover:border-zinc-700 transition">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
            <span className="font-semibold uppercase tracking-wider text-[10px] text-zinc-400">
              Remaining Duration
            </span>
            <Clock className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white tracking-tight flex items-baseline justify-between">
            <span className={remainingDuration === 0 ? 'text-emerald-400' : 'text-amber-300'}>
              {formatDurationShort(remainingDuration)}
            </span>
            <span className="text-[11px] text-zinc-500 font-normal">remaining</span>
          </div>
        </div>
      </div>

      {/* Bottom Bar: Processing Speed & Estimated Time Remaining (ETA) */}
      <div className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800/60 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs font-mono">
        <div className="flex items-center gap-2 text-zinc-300 w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex items-center gap-1.5 text-zinc-400">
            <Gauge className="w-4 h-4 text-emerald-400" />
            <span className="text-[11px] text-zinc-400 uppercase tracking-wide">Processing Speed:</span>
          </div>
          <span className="font-bold text-emerald-300">{speedDisplay}</span>
        </div>

        <div className="flex items-center gap-2 text-zinc-300 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 border-zinc-800/50 pt-1.5 sm:pt-0">
          <div className="flex items-center gap-1.5 text-zinc-400">
            <Timer className="w-4 h-4 text-cyan-400" />
            <span className="text-[11px] text-zinc-400 uppercase tracking-wide">ETA:</span>
          </div>
          <span className="font-bold text-cyan-300">{etaDisplay}</span>
        </div>
      </div>
    </div>
  );
};
