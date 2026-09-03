import React from 'react';
import { Loader2, XCircle, Film, Clock } from 'lucide-react';
import { ProcessingJob } from '../types';
import { formatDurationHMS } from '../utils/formatters';
import { RealtimeStatsPanel } from './RealtimeStatsPanel';

interface ProcessingViewProps {
  job: ProcessingJob;
  onCancel: () => void;
}

export const ProcessingView: React.FC<ProcessingViewProps> = ({ job, onCancel }) => {
  return (
    <div className="w-full bg-zinc-900/90 border border-zinc-800 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-2xl text-center space-y-7">
      {/* Header */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 text-xs font-semibold uppercase tracking-wider">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
          <span>Active FFmpeg Processing Engine</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
          Creating Your Extended Video
        </h2>
        <p className="text-sm text-zinc-400 max-w-lg mx-auto">
          {job.stage || 'Seamlessly concatenating and encoding with exact millisecond precision...'}
        </p>
      </div>

      {/* Main Progress Bar */}
      <div className="max-w-xl mx-auto space-y-3">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-zinc-400 font-medium capitalize">
            {job.status === 'verifying' ? 'Verifying integrity with FFprobe...' : 'Encoding streams...'}
          </span>
          <span className="text-lg font-black text-cyan-400">{job.progress}%</span>
        </div>

        <div className="w-full h-4 bg-zinc-950 rounded-full overflow-hidden p-0.5 border border-zinc-800 shadow-inner">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-sky-400 to-indigo-500 transition-all duration-300 relative overflow-hidden shadow-lg shadow-cyan-500/30"
            style={{ width: `${Math.max(3, job.progress)}%` }}
          >
            <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.4),transparent)]" />
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-zinc-500 font-mono">
          <span>0%</span>
          <span>Target: {formatDurationHMS(job.targetDuration)}</span>
          <span>100%</span>
        </div>
      </div>

      {/* Real-time processing statistics panel directly below the progress bar */}
      <RealtimeStatsPanel job={job} />

      {/* Action: Cancel Button */}
      <div className="pt-2">
        <button
          id="cancel-processing-button"
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-800/90 hover:bg-rose-950/50 text-zinc-300 hover:text-rose-300 border border-zinc-700 hover:border-rose-800/50 text-sm font-medium transition shadow-md"
        >
          <XCircle className="w-4 h-4" />
          <span>Cancel Processing</span>
        </button>
      </div>
    </div>
  );
};

