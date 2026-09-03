import React from 'react';
import { Sparkles, Repeat, Clock, ShieldCheck } from 'lucide-react';

export const HeroSection: React.FC = () => {
  return (
    <div className="text-center pt-8 pb-6 px-4 sm:px-6">
      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-950/70 border border-cyan-500/30 text-cyan-300 text-xs font-semibold uppercase tracking-wider mb-4 shadow-sm shadow-cyan-950">
        <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
        <span>Production Video Duration Multiplier</span>
      </div>

      <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-zinc-100 to-zinc-400 tracking-tight uppercase mb-4">
        VIDEO-LENGTH INCREASER
      </h1>

      <p className="text-lg sm:text-xl font-medium text-cyan-200/90 max-w-3xl mx-auto mb-3">
        Turn short videos into 30-minute, 1-hour, or 2-hour videos instantly.
      </p>

      <p className="text-sm sm:text-base text-zinc-400 max-w-2xl mx-auto mb-6">
        Upload your short video, choose the duration, and let the system automatically loop it to the exact length you need.
      </p>

      {/* Feature highlights pills */}
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 max-w-3xl mx-auto text-xs text-zinc-300">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900/90 border border-zinc-800 shadow-sm">
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          <span>Exact Duration Guaranteed</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900/90 border border-zinc-800 shadow-sm">
          <Repeat className="w-3.5 h-3.5 text-indigo-400" />
          <span>Natural Seamless Looping</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900/90 border border-zinc-800 shadow-sm">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>FFprobe Verified Output</span>
        </div>
      </div>
    </div>
  );
};
