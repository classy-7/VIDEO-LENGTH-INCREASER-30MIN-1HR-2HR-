import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import { VideoMetadata } from './types';

const execFileAsync = promisify(execFile);

export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);

  const pad = (n: number) => n.toString().padStart(2, '0');
  if (hrs > 0) {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}${ms > 0 ? `.${pad(ms)}` : ''}`;
}

export async function probeVideoFile(
  filePath: string,
  originalFilename: string
): Promise<VideoMetadata> {
  if (!fs.existsSync(filePath)) {
    throw new Error('Video file does not exist on server.');
  }

  const stat = fs.statSync(filePath);
  if (stat.size === 0) {
    throw new Error('Video file is empty.');
  }

  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v',
      'quiet',
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      filePath,
    ]);

    const info = JSON.parse(stdout);
    if (!info || !info.streams || info.streams.length === 0) {
      throw new Error('Could not read video streams. File may be corrupted.');
    }

    const videoStream = info.streams.find((s: any) => s.codec_type === 'video');
    if (!videoStream) {
      throw new Error('No valid video stream found in the uploaded file.');
    }

    const audioStream = info.streams.find((s: any) => s.codec_type === 'audio');

    // Calculate duration
    let duration = parseFloat(videoStream.duration || info.format?.duration || '0');
    if (isNaN(duration) || duration <= 0) {
      // Fallback: check other streams or format tags
      duration = parseFloat(info.format?.duration || '0');
    }

    if (isNaN(duration) || duration <= 0) {
      throw new Error('Unable to determine video duration. File may be incomplete.');
    }

    // Calculate FPS
    let fps = 30;
    if (videoStream.avg_frame_rate && videoStream.avg_frame_rate !== '0/0') {
      const parts = videoStream.avg_frame_rate.split('/');
      if (parts.length === 2 && parseFloat(parts[1]) > 0) {
        fps = Math.round(parseFloat(parts[0]) / parseFloat(parts[1]));
      }
    } else if (videoStream.r_frame_rate && videoStream.r_frame_rate !== '0/0') {
      const parts = videoStream.r_frame_rate.split('/');
      if (parts.length === 2 && parseFloat(parts[1]) > 0) {
        fps = Math.round(parseFloat(parts[0]) / parseFloat(parts[1]));
      }
    }

    const width = videoStream.width || 0;
    const height = videoStream.height || 0;

    return {
      filename: filePath,
      originalFilename,
      filesize: stat.size,
      duration,
      formattedDuration: formatDuration(duration),
      width,
      height,
      resolution: width && height ? `${width} × ${height}` : 'Unknown',
      fps,
      format: (info.format?.format_name || 'mp4').toUpperCase().split(',')[0],
      videoCodec: (videoStream.codec_name || 'h264').toUpperCase(),
      hasAudio: !!audioStream,
      audioCodec: audioStream ? (audioStream.codec_name || 'aac').toUpperCase() : undefined,
      audioChannels: audioStream?.channels,
      audioSampleRate: audioStream?.sample_rate ? parseInt(audioStream.sample_rate, 10) : undefined,
      bitrate: info.format?.bit_rate ? parseInt(info.format.bit_rate, 10) : undefined,
    };
  } catch (err: any) {
    if (err.message && err.message.includes('No valid video stream')) {
      throw err;
    }
    throw new Error(`Failed to analyze video: ${err.message || 'Corrupted file'}`);
  }
}
