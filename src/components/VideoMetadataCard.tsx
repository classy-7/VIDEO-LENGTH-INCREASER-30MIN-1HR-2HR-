import React from 'react';
import { Film, Clock, Monitor, RefreshCw, Trash2, Volume2, VolumeX, Cpu, Layers } from 'lucide-react';
import { VideoMetadata } from '../types';
import { formatBytes } from '../utils/formatters';

interface VideoMetadataCardProps {
  metadata: VideoMetadata;
  onReplace: () => void;
  onRemove: () => void;
}

export const VideoMetadataCard: React.FC<VideoMetadataCardProps> = ({
  metadata,
  onReplace,
  onRemove,
}) => {
  return (
    <div className="w-full bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 shadow-xl backdrop-blur-xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-zinc-800/80">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600/20 to-indigo-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
            <Film className="w-5 h-5" />
          </div>
          <div className="truncate">
            <h4 className="font-semibold text-white truncate text-base" title={metadata.originalFilename}>
              {metadata.originalFilename}
            </h4>
            <p className="text-xs text-zinc-400 font-mono flex items-center gap-2">
              <span>{formatBytes(metadata.filesize)}</span>
              <span>•</span>
              <span className="text-cyan-400 font-medium">{metadata.format}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={onReplace}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 hover:text-white border border-zinc-700 transition shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Replace Video</span>
          </button>
          <button
            onClick={onRemove}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-300 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-900/40 transition shadow-sm"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Remove</span>
          </button>
        </div>
      </div>

      {/* Metadata Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
        {/* Duration */}
        <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
          <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>Duration</span>
          </div>
          <div className="text-base font-bold font-mono text-white">
            {metadata.formattedDuration}
          </div>
        </div>

        {/* Resolution */}
        <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
          <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
            <Monitor className="w-3.5 h-3.5 text-indigo-400" />
            <span>Resolution</span>
          </div>
          <div className="text-base font-bold font-mono text-white">
            {metadata.resolution}
          </div>
        </div>

        {/* FPS */}
        <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
          <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            <span>FPS</span>
          </div>
          <div className="text-base font-bold font-mono text-white">
            {metadata.fps} fps
          </div>
        </div>

        {/* Codec & Audio */}
        <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
          <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
            <Cpu className="w-3.5 h-3.5 text-emerald-400" />
            <span>Codec & Audio</span>
          </div>
          <div className="text-xs font-semibold font-mono text-zinc-200 flex items-center gap-1.5">
            <span>{metadata.videoCodec}</span>
            <span>•</span>
            {metadata.hasAudio ? (
              <span className="text-emerald-400 flex items-center gap-0.5" title={`Audio: ${metadata.audioCodec || 'AAC'}`}>
                <Volume2 className="w-3.5 h-3.5" />
                {metadata.audioCodec || 'Audio'}
              </span>
            ) : (
              <span className="text-zinc-500 flex items-center gap-0.5" title="No Audio Stream">
                <VolumeX className="w-3.5 h-3.5" />
                Silent
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
