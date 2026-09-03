import React from 'react';
import { X, Check, HardDrive, ShieldCheck, Clock, Download } from 'lucide-react';
import { AppSettings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  maxUploadSizeMb?: number;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  maxUploadSizeMb = 500,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative text-zinc-100">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-zinc-800 text-cyan-400">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-white">Application Settings</h3>
              <p className="text-xs text-zinc-400">Configure processing preferences & limits</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-5 space-y-4">
          {/* Auto download toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
            <div className="flex items-center gap-3">
              <Download className="w-4 h-4 text-cyan-400" />
              <div>
                <p className="text-sm font-medium text-zinc-200">Auto-Download on Completion</p>
                <p className="text-xs text-zinc-500">Automatically trigger file download when finished</p>
              </div>
            </div>
            <button
              onClick={() => onUpdateSettings({ autoDownload: !settings.autoDownload })}
              className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
                settings.autoDownload ? 'bg-cyan-600 justify-end' : 'bg-zinc-700 justify-start'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-white shadow-md transform transition-transform" />
            </button>
          </div>

          {/* Audio Chime Notification */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4 text-indigo-400" />
              <div>
                <p className="text-sm font-medium text-zinc-200">Completion Alert Sound</p>
                <p className="text-xs text-zinc-500">Play a pleasant sound when video rendering finishes</p>
              </div>
            </div>
            <button
              onClick={() => onUpdateSettings({ soundNotification: !settings.soundNotification })}
              className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
                settings.soundNotification ? 'bg-cyan-600 justify-end' : 'bg-zinc-700 justify-start'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-white shadow-md transform transition-transform" />
            </button>
          </div>

          {/* System Limits Info */}
          <div className="p-3.5 rounded-xl bg-zinc-950/40 border border-zinc-800/60 text-xs space-y-2 text-zinc-400">
            <div className="flex items-center justify-between">
              <span className="text-zinc-300">Max Upload Limit:</span>
              <span className="font-semibold text-zinc-100">{maxUploadSizeMb} MB</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-300">File Auto-Cleanup:</span>
              <span className="text-emerald-400 font-medium flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> 60 Minutes (Auto-expiring)
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-300">Engine:</span>
              <span className="text-cyan-400 font-mono">FFmpeg 4.4 + FFprobe</span>
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-zinc-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 text-white font-medium text-sm hover:from-cyan-500 hover:to-indigo-500 transition shadow-lg shadow-cyan-900/30"
          >
            Save & Close
          </button>
        </div>
      </div>
    </div>
  );
};
