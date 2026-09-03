import React from 'react';
import { Film, ShieldCheck, Cpu } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full border-t border-zinc-900 bg-zinc-950 py-10 px-4 sm:px-6 lg:px-8 text-zinc-500 text-xs">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Film className="w-3.5 h-3.5" />
          </div>
          <span className="font-bold text-zinc-300 tracking-wide uppercase">
            VIDEO-LENGTH INCREASER
          </span>
          <span>•</span>
          <span>High-Precision Video Duration Multiplier</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-zinc-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Files auto-cleaned after 60 min</span>
          </div>
          <div className="flex items-center gap-1.5 text-zinc-400">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span>FFmpeg 4.4 Engine</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
