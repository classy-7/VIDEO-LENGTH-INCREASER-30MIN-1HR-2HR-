import React from 'react';
import { Film, Settings, Sparkles } from 'lucide-react';

interface HeaderProps {
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSettings }) => {
  return (
    <header className="w-full border-b border-zinc-800/80 bg-zinc-950/70 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-white">
            <Film className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight text-zinc-100 uppercase">
                VIDEO-LENGTH INCREASER
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <Sparkles className="w-3 h-3" />
                FFmpeg Powered
              </span>
            </div>
            <p className="text-xs text-zinc-400 hidden md:block">
              Extend your videos effortlessly with exact millisecond precision
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            id="settings-button"
            onClick={onOpenSettings}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-zinc-300 hover:text-white bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
            title="Application Settings"
          >
            <Settings className="w-4 h-4 text-zinc-400" />
            <span className="hidden sm:inline font-medium">Settings</span>
          </button>
        </div>
      </div>
    </header>
  );
};
