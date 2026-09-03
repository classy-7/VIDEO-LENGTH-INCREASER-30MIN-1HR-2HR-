import React from 'react';
import { Film, Clock, Repeat, ArrowDown, Plus, Sparkles, Check } from 'lucide-react';

export const VisualMathExplainer: React.FC = () => {
  return (
    <div className="w-full py-6">
      <div className="bg-gradient-to-b from-zinc-900/90 to-zinc-950/90 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-xl">
        <div className="text-center max-w-xl mx-auto mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-950/80 border border-indigo-500/30 text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Mathematical Looping Architecture</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            How Short Videos Become Long Videos
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            Zero stretching, zero distortion. Clean continuous repetitions trimmed precisely.
          </p>
        </div>

        {/* Visual Flow Diagram */}
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 relative">
          {/* Card 1: Your Video */}
          <div className="w-full md:w-1/4 p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 text-center space-y-2 shadow-lg">
            <span className="text-[11px] font-mono font-bold text-zinc-500 tracking-wider uppercase block">
              YOUR VIDEO
            </span>
            <div className="w-12 h-12 rounded-xl bg-cyan-950/80 border border-cyan-500/30 text-cyan-400 mx-auto flex items-center justify-center">
              <Film className="w-6 h-6" />
            </div>
            <div className="text-lg font-black font-mono text-white">
              00:08
            </div>
            <p className="text-[11px] text-zinc-400">
              Short 8-second video
            </p>
          </div>

          {/* Plus sign */}
          <div className="text-zinc-600 flex items-center justify-center">
            <Plus className="w-6 h-6" />
          </div>

          {/* Card 2: Target Duration */}
          <div className="w-full md:w-1/4 p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 text-center space-y-2 shadow-lg">
            <span className="text-[11px] font-mono font-bold text-zinc-500 tracking-wider uppercase block">
              TARGET
            </span>
            <div className="w-12 h-12 rounded-xl bg-indigo-950/80 border border-indigo-500/30 text-indigo-400 mx-auto flex items-center justify-center">
              <Clock className="w-6 h-6" />
            </div>
            <div className="text-lg font-black font-mono text-indigo-300">
              01:00:00
            </div>
            <p className="text-[11px] text-zinc-400">
              1-hour target duration
            </p>
          </div>

          {/* Arrow */}
          <div className="text-cyan-500 flex items-center justify-center rotate-90 md:rotate-0">
            <Repeat className="w-6 h-6 animate-[spin_8s_linear_infinite]" />
          </div>

          {/* Card 3: Automatic Looping */}
          <div className="w-full md:w-1/4 p-4 rounded-2xl bg-gradient-to-b from-cyan-950/50 to-zinc-950 border border-cyan-500/40 text-center space-y-2 shadow-lg">
            <span className="text-[11px] font-mono font-bold text-cyan-400 tracking-wider uppercase block">
              AUTOMATIC LOOPING
            </span>
            <div className="w-12 h-12 rounded-xl bg-cyan-900/40 border border-cyan-400/40 text-cyan-300 mx-auto flex items-center justify-center">
              <Repeat className="w-6 h-6" />
            </div>
            <div className="text-lg font-black font-mono text-cyan-200">
              × 450 Loops
            </div>
            <p className="text-[11px] text-cyan-400/80">
              Exact millisecond cut
            </p>
          </div>

          {/* Arrow */}
          <div className="text-emerald-500 flex items-center justify-center rotate-90 md:rotate-0">
            <Check className="w-6 h-6" />
          </div>

          {/* Card 4: Final Video */}
          <div className="w-full md:w-1/4 p-4 rounded-2xl bg-gradient-to-b from-emerald-950/60 to-zinc-950 border border-emerald-500/50 text-center space-y-2 shadow-xl ring-2 ring-emerald-500/20">
            <span className="text-[11px] font-mono font-bold text-emerald-400 tracking-wider uppercase block">
              FINAL VIDEO
            </span>
            <div className="w-12 h-12 rounded-xl bg-emerald-900/40 border border-emerald-400/40 text-emerald-300 mx-auto flex items-center justify-center">
              <Film className="w-6 h-6" />
            </div>
            <div className="text-lg font-black font-mono text-emerald-300">
              01:00:00
            </div>
            <p className="text-[11px] text-emerald-400/80">
              Exact duration guaranteed
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
