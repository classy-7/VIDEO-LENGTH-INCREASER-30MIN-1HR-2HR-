import React, { useRef, useState, useEffect } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  RotateCcw,
  Gauge,
} from 'lucide-react';
import { formatDurationHMS } from '../utils/formatters';

interface VideoPlayerProps {
  src: string;
  title?: string;
  autoPlay?: boolean;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, title, autoPlay = false }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isHovered, setIsHovered] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleLoadedMetadata = () => setDuration(video.duration || 0);
    const handleEnded = () => setIsPlaying(false);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, [src]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const target = parseFloat(e.target.value);
    video.currentTime = target;
    setCurrentTime(target);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const newVol = parseFloat(e.target.value);
    video.volume = newVol;
    setVolume(newVol);
    if (newVol === 0) {
      setIsMuted(true);
      video.muted = true;
    } else if (isMuted) {
      setIsMuted(false);
      video.muted = false;
    }
  };

  const handleSpeedChange = (speed: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = speed;
    setPlaybackSpeed(speed);
    setShowSpeedMenu(false);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      containerRef.current.requestFullscreen().catch(() => {});
    }
  };

  const restartVideo = () => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    video.play();
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative w-full rounded-2xl overflow-hidden bg-black aspect-video group shadow-2xl border border-zinc-800"
    >
      <video
        ref={videoRef}
        src={src}
        autoPlay={autoPlay}
        playsInline
        onClick={togglePlay}
        className="w-full h-full object-contain cursor-pointer"
      />

      {/* Center Play Button Overlay when paused */}
      {!isPlaying && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-cyan-600/90 text-white flex items-center justify-center shadow-xl shadow-cyan-950/60 hover:bg-cyan-500 hover:scale-110 transition-all duration-200 z-10"
          title="Play Video"
        >
          <Play className="w-7 h-7 ml-1 fill-white" />
        </button>
      )}

      {/* Top Title Bar */}
      {title && (
        <div
          className={`absolute top-0 inset-x-0 p-3 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between transition-opacity duration-300 ${
            isHovered || !isPlaying ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <span className="text-xs font-semibold text-zinc-200 px-2 py-1 rounded bg-black/40 backdrop-blur-sm border border-zinc-700/50">
            {title}
          </span>
          <span className="text-xs font-mono text-cyan-400 bg-cyan-950/80 px-2.5 py-0.5 rounded-full border border-cyan-500/30">
            {formatDurationHMS(duration)}
          </span>
        </div>
      )}

      {/* Bottom Controls Bar */}
      <div
        className={`absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 pt-6 flex flex-col gap-2 transition-opacity duration-300 ${
          isHovered || !isPlaying ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Timeline Slider */}
        <div className="relative flex items-center group/timeline">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.01}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 bg-zinc-700/80 rounded-lg appearance-none cursor-pointer accent-cyan-400 focus:outline-none"
            style={{
              background: `linear-gradient(to right, #06b6d4 ${progressPercent}%, #3f3f46 ${progressPercent}%)`,
            }}
          />
        </div>

        <div className="flex items-center justify-between text-zinc-200 text-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="p-1 rounded hover:bg-white/10 text-white transition"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
            </button>

            <button
              onClick={restartVideo}
              className="p-1 rounded hover:bg-white/10 text-zinc-300 hover:text-white transition"
              title="Restart"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <div className="flex items-center gap-1.5">
              <button
                onClick={toggleMute}
                className="p-1 rounded hover:bg-white/10 text-zinc-300 hover:text-white transition"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-rose-400" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-14 h-1 bg-zinc-600 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>

            <span className="font-mono text-[11px] text-zinc-300">
              {formatDurationHMS(currentTime)} / {formatDurationHMS(duration)}
            </span>
          </div>

          <div className="flex items-center gap-2 relative">
            {/* Speed selector */}
            <div className="relative">
              <button
                onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition text-xs font-mono"
                title="Playback Speed"
              >
                <Gauge className="w-3 h-3" />
                <span>{playbackSpeed}x</span>
              </button>

              {showSpeedMenu && (
                <div className="absolute bottom-full right-0 mb-2 py-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-20 flex flex-col min-w-[70px]">
                  {[0.5, 1, 1.25, 1.5, 2].map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSpeedChange(s)}
                      className={`px-3 py-1 text-left text-xs font-mono transition ${
                        playbackSpeed === s
                          ? 'bg-cyan-600 text-white font-bold'
                          : 'text-zinc-300 hover:bg-zinc-800'
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={toggleFullscreen}
              className="p-1 rounded hover:bg-white/10 text-zinc-300 hover:text-white transition"
              title="Fullscreen"
            >
              <Maximize className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
