import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { CONFIG } from './config';
import { probeVideoFile } from './ffprobe';
import { VideoMetadata } from './types';

const SAMPLE_DIR = path.join(process.cwd(), 'temp', 'samples');

if (!fs.existsSync(SAMPLE_DIR)) {
  fs.mkdirSync(SAMPLE_DIR, { recursive: true });
}

export async function getOrCreateSampleVideo(type: 'nature' | 'countdown' | 'ambient' = 'nature'): Promise<{
  filePath: string;
  metadata: VideoMetadata;
}> {
  const filename = `sample_${type}_8s.mp4`;
  const filePath = path.join(SAMPLE_DIR, filename);

  if (fs.existsSync(filePath)) {
    const metadata = await probeVideoFile(filePath, `sample-${type}-8s.mp4`);
    return { filePath, metadata };
  }

  // Generate a high-quality 8-second sample video with FFmpeg
  console.log(`Generating sample video: ${filename}`);

  let filterGraph = '';
  if (type === 'countdown') {
    filterGraph = 'testsrc=duration=8:size=1280x720:rate=30,drawtext=text=\'Sample Clip %{pts\\:hms}\':fontcolor=white:fontsize=48:box=1:boxcolor=black@0.6:boxborderw=10:x=(w-text_w)/2:y=(h-text_h)/2';
  } else if (type === 'ambient') {
    filterGraph = 'mandelbrot=duration=8:size=1280x720:rate=30';
  } else {
    // Nature/gradient style synth
    filterGraph = 'smptebars=duration=8:size=1280x720:rate=30';
  }

  const audioSynth = 'sine=frequency=528:duration=8';

  await new Promise<void>((resolve, reject) => {
    const args = [
      '-y',
      '-f',
      'lavfi',
      '-i',
      filterGraph,
      '-f',
      'lavfi',
      '-i',
      audioSynth,
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-movflags',
      '+faststart',
      filePath,
    ];

    const proc = spawn('ffmpeg', args);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Failed to generate sample video (code ${code})`));
    });
    proc.on('error', reject);
  });

  const metadata = await probeVideoFile(filePath, `sample-${type}-8s.mp4`);
  return { filePath, metadata };
}
