import React, { useState } from 'react';
import { Clock, CheckCircle2, Sliders, ArrowRight, Zap, Sparkles } from 'lucide-react';
import { calculateRepetitions, formatDurationHMS } from '../utils/formatters';

interface DurationSelectorProps {
  originalDuration: number;
  selectedDuration: number;
  onSelectDuration: (durationInSeconds: number) => void;
  onCreateVideo: () => void;
  isProcessing: boolean;
}

const PRESETS = [
  {
    id: '30m',
    title: '30 MINUTES',
    seconds: 1800,
    timeDisplay: '00:30:00',
    description: 'Perfect for meditation, background loops, & short reels',
  },
  {
    id: '1h',
    title: '1 HOUR',
    seconds: 3600,
    timeDisplay: '01:00:00',
    description: 'Most popular • Ideal for study music, focus sounds, & YouTube',
    isPopular: true,
  },
  {
    id: '2h',
    title: '2 HOURS',
    seconds: 7200,
    timeDisplay: '02:00:00',
    description: 'Long-form ambiance, sleep therapy, & screen displays',
  },
];

export const DurationSelector: React.FC<DurationSelectorProps> = ({
  originalDuration,
  selectedDuration,
  onSelectDuration,
  onCreateVideo,
  isProcessing,
}) => {
  const [showCustom, setShowCustom] = useState(false);
  const [customHours, setCustomHours] = useState(0);
  const [customMinutes, setCustomMinutes] = useState(15);
  const [customSeconds, setCustomSeconds] = useState(0);

  const { loops, exactTime, hasTrim, trimDurationSeconds } = calculateRepetitions(
    originalDuration,
    selectedDuration
  );

  const applyCustomDuration = () => {
    const totalSecs = customHours * 3600 + customMinutes * 60 + customSeconds;
    if (totalSecs > 0) {
      onSelectDuration(totalSecs);
    }
  };

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <Clock className="w-5 h-5 text-cyan-400" />
            Select Target Video Length
          </h3>
          <p className="text-xs text-zinc-400">
            Choose an exact target duration or customize
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCustom(!showCustom)}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border transition ${
            showCustom
              ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40'
              : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Custom Length</span>
        </button>
      </div>

      {/* Preset Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PRESETS.map((preset) => {
          const isSelected = selectedDuration === preset.seconds && !showCustom;
          return (
            <div
              key={preset.id}
              onClick={() => {
                setShowCustom(false);
                onSelectDuration(preset.seconds);
              }}
              className={`relative cursor-pointer rounded-2xl p-5 border transition-all duration-200 flex flex-col justify-between ${
                isSelected
                  ? 'bg-gradient-to-b from-cyan-950/60 to-zinc-900 border-cyan-400 shadow-xl shadow-cyan-500/10 ring-2 ring-cyan-500/20 scale-[1.02]'
                  : 'bg-zinc-900/60 hover:bg-zinc-900/90 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              {preset.isPopular && (
                <span className="absolute -top-2.5 right-4 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow-md">
                  Most Popular
                </span>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span
                    className={`text-base font-black tracking-wide ${
                      isSelected ? 'text-cyan-300' : 'text-zinc-200'
                    }`}
                  >
                    {preset.title}
                  </span>
                  {isSelected ? (
                    <CheckCircle2 className="w-5 h-5 text-cyan-400 shrink-0 fill-cyan-950" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border border-zinc-700" />
                  )}
                </div>

                <div className="text-2xl font-black font-mono text-white tracking-tight">
                  {preset.timeDisplay}
                </div>

                <p className="text-xs text-zinc-400 leading-relaxed">
                  {preset.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-500">Loops needed:</span>
                <span className="font-bold text-cyan-400">
                  {Math.ceil(preset.seconds / (originalDuration || 1))}×
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Custom Duration Panel */}
      {showCustom && (
        <div className="p-5 rounded-2xl bg-zinc-900/90 border border-cyan-500/30 space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              Specify Custom Target Length
            </h4>
            <span className="text-xs font-mono text-cyan-300 font-semibold">
              Selected: {formatDurationHMS(selectedDuration)}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Hours</label>
              <input
                type="number"
                min="0"
                max="24"
                value={customHours}
                onChange={(e) => {
                  const val = Math.max(0, parseInt(e.target.value) || 0);
                  setCustomHours(val);
                  onSelectDuration(val * 3600 + customMinutes * 60 + customSeconds);
                }}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white font-mono text-center focus:border-cyan-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Minutes</label>
              <input
                type="number"
                min="0"
                max="59"
                value={customMinutes}
                onChange={(e) => {
                  const val = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
                  setCustomMinutes(val);
                  onSelectDuration(customHours * 3600 + val * 60 + customSeconds);
                }}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white font-mono text-center focus:border-cyan-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Seconds</label>
              <input
                type="number"
                min="0"
                max="59"
                value={customSeconds}
                onChange={(e) => {
                  const val = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
                  setCustomSeconds(val);
                  onSelectDuration(customHours * 3600 + customMinutes * 60 + val);
                }}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white font-mono text-center focus:border-cyan-400 focus:outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Looping Calculation Explanation Card */}
      <div className="p-4 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-950 border border-cyan-500/30 text-cyan-400 shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-zinc-200">
                Precision Calculation Summary
              </div>
              <div className="text-zinc-400 mt-0.5">
                {originalDuration.toFixed(2)}s video × <span className="text-cyan-400 font-bold">{loops} loops</span>
                {hasTrim ? (
                  <span> (final loop trimmed to {trimDurationSeconds.toFixed(2)}s)</span>
                ) : (
                  <span> (perfect multiple)</span>
                )}
              </div>
            </div>
          </div>

          <div className="text-right font-mono self-end sm:self-center">
            <span className="text-zinc-500 block text-[10px]">EXACT FINAL OUTPUT</span>
            <span className="text-base font-bold text-white bg-zinc-900 px-2.5 py-1 rounded-lg border border-zinc-800 inline-block">
              {exactTime}
            </span>
          </div>
        </div>
      </div>

      {/* Create Video Action Button */}
      <div className="pt-2">
        <button
          id="create-video-button"
          type="button"
          disabled={isProcessing || !originalDuration}
          onClick={onCreateVideo}
          className="w-full py-4 px-8 rounded-2xl bg-gradient-to-r from-cyan-500 via-cyan-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-lg tracking-wide uppercase shadow-xl shadow-cyan-600/25 hover:shadow-cyan-500/40 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 group"
        >
          <Sparkles className="w-5 h-5 text-cyan-200 group-hover:rotate-12 transition-transform" />
          <span>CREATE {formatDurationHMS(selectedDuration)} VIDEO</span>
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
};
