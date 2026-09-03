import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { createServer as createViteServer } from 'vite';
import { CONFIG } from './server/config';
import { probeVideoFile } from './server/ffprobe';
import { jobManager } from './server/jobManager';
import { getOrCreateSampleVideo } from './server/sampleVideos';
import { VideoMetadata } from './server/types';

// Map of uploaded files: fileId -> { filePath, metadata }
const uploadedFiles = new Map<string, { filePath: string; metadata: VideoMetadata; expiresAt: number }>();

function saveUploadedFile(fileId: string, entry: { filePath: string; metadata: VideoMetadata; expiresAt: number }) {
  uploadedFiles.set(fileId, entry);
  try {
    const metaPath = path.join(CONFIG.UPLOAD_DIR, `${fileId}.meta.json`);
    fs.writeFileSync(metaPath, JSON.stringify(entry));
  } catch {}
}

function getUploadedFile(fileId: string) {
  if (uploadedFiles.has(fileId)) {
    return uploadedFiles.get(fileId);
  }
  const metaPath = path.join(CONFIG.UPLOAD_DIR, `${fileId}.meta.json`);
  if (fs.existsSync(metaPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      uploadedFiles.set(fileId, parsed);
      return parsed;
    } catch {}
  }
  return undefined;
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, CONFIG.UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const fileExt = path.extname(file.originalname).toLowerCase() || '.mp4';
    const uniqueName = `${Date.now()}_${uuidv4()}${fileExt}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: CONFIG.MAX_UPLOAD_SIZE_MB * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (CONFIG.ALLOWED_EXTENSIONS.includes(ext) || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported video format. Please upload a supported video file (MP4, MOV, WebM, MKV, AVI).'));
    }
  },
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // CORS and preflight headers
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range, Authorization');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Content-Disposition');
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    next();
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Config endpoint
  app.get('/api/config', (req, res) => {
    res.json({
      maxUploadSizeMb: CONFIG.MAX_UPLOAD_SIZE_MB,
      allowedExtensions: CONFIG.ALLOWED_EXTENSIONS,
      fileExpirationMinutes: CONFIG.FILE_EXPIRATION_MINUTES,
    });
  });

  // Standard upload video endpoint
  app.post('/api/upload', (req, res) => {
    upload.single('video')(req, res, async (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            error: `File size exceeds the maximum limit of ${CONFIG.MAX_UPLOAD_SIZE_MB}MB.`,
          });
        }
        return res.status(400).json({
          error: err.message || 'Failed to upload video.',
        });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No video file provided.' });
      }

      const filePath = req.file.path;
      const originalFilename = req.file.originalname;

      try {
        const metadata = await probeVideoFile(filePath, originalFilename);
        const fileId = uuidv4();

        saveUploadedFile(fileId, {
          filePath,
          metadata,
          expiresAt: Date.now() + CONFIG.FILE_EXPIRATION_MINUTES * 60 * 1000,
        });

        return res.json({
          fileId,
          metadata,
        });
      } catch (probeErr: any) {
        // Cleanup file if probe fails
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
          } catch {}
        }
        return res.status(422).json({
          error: probeErr.message || 'Unable to read or parse video file. Please verify the file is not corrupted.',
        });
      }
    });
  });

  // Chunked upload: Step 1 - Initialize session
  app.post('/api/upload/init', (req, res) => {
    try {
      const { filename, filesize, totalChunks } = req.body || {};
      if (!filename || !totalChunks) {
        return res.status(400).json({ error: 'Filename and totalChunks are required.' });
      }

      const sessionId = uuidv4();
      const sessionDir = path.join(CONFIG.SESSIONS_DIR, sessionId);
      fs.mkdirSync(sessionDir, { recursive: true });

      const sessionMeta = {
        sessionId,
        filename,
        filesize: Number(filesize) || 0,
        totalChunks: Number(totalChunks),
        createdAt: Date.now(),
      };
      fs.writeFileSync(path.join(sessionDir, 'meta.json'), JSON.stringify(sessionMeta));

      res.json({
        sessionId,
        chunkSize: 4 * 1024 * 1024,
      });
    } catch (err: any) {
      console.error('Upload init error:', err);
      res.status(500).json({ error: 'Failed to initialize upload session.' });
    }
  });

  // Chunked upload: Step 2 - Upload chunk slice
  app.post('/api/upload/chunk', (req, res) => {
    const sessionId = (req.headers['x-session-id'] as string) || (req.query.sessionId as string);
    const chunkIndex = parseInt(
      (req.headers['x-chunk-index'] as string) || (req.query.chunkIndex as string),
      10
    );

    if (!sessionId || isNaN(chunkIndex)) {
      return res.status(400).json({ error: 'Missing x-session-id or x-chunk-index header.' });
    }

    const sessionDir = path.join(CONFIG.SESSIONS_DIR, sessionId);
    if (!fs.existsSync(sessionDir)) {
      return res.status(404).json({ error: 'Upload session not found or expired.' });
    }

    const chunkPath = path.join(sessionDir, `chunk_${chunkIndex}`);
    const writeStream = fs.createWriteStream(chunkPath);

    req.pipe(writeStream);

    writeStream.on('finish', () => {
      res.json({ success: true, chunkIndex });
    });

    writeStream.on('error', (err) => {
      console.error(`Chunk ${chunkIndex} write error:`, err);
      res.status(500).json({ error: `Failed to write chunk ${chunkIndex}` });
    });
  });

  // Chunked upload: Step 3 - Finalize & Assemble chunks
  app.post('/api/upload/complete', async (req, res) => {
    const { sessionId, originalFilename } = req.body || {};
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required.' });
    }

    const sessionDir = path.join(CONFIG.SESSIONS_DIR, sessionId);
    const metaPath = path.join(sessionDir, 'meta.json');

    if (!fs.existsSync(sessionDir) || !fs.existsSync(metaPath)) {
      return res.status(404).json({ error: 'Upload session not found or expired.' });
    }

    let sessionMeta: any;
    try {
      sessionMeta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    } catch {
      return res.status(500).json({ error: 'Failed to read upload session metadata.' });
    }

    const totalChunks = sessionMeta.totalChunks;
    const name = originalFilename || sessionMeta.filename || 'video.mp4';
    const ext = path.extname(name).toLowerCase() || '.mp4';
    const finalDestPath = path.join(CONFIG.UPLOAD_DIR, `${Date.now()}_${uuidv4()}${ext}`);

    try {
      // Verify all chunks exist
      for (let i = 0; i < totalChunks; i++) {
        const chunkPath = path.join(sessionDir, `chunk_${i}`);
        if (!fs.existsSync(chunkPath)) {
          return res.status(400).json({ error: `Missing chunk ${i} of ${totalChunks}.` });
        }
      }

      // Stream combine chunks sequentially
      const writeStream = fs.createWriteStream(finalDestPath);
      for (let i = 0; i < totalChunks; i++) {
        const chunkPath = path.join(sessionDir, `chunk_${i}`);
        await new Promise<void>((resolve, reject) => {
          const readStream = fs.createReadStream(chunkPath);
          readStream.pipe(writeStream, { end: false });
          readStream.on('end', () => resolve());
          readStream.on('error', reject);
        });
      }
      writeStream.end();

      await new Promise<void>((resolve, reject) => {
        writeStream.on('finish', () => resolve());
        writeStream.on('error', reject);
      });

      // Cleanup session chunk files
      try {
        fs.rmSync(sessionDir, { recursive: true, force: true });
      } catch {}

      // Probe video file
      const metadata = await probeVideoFile(finalDestPath, name);
      const fileId = uuidv4();

      saveUploadedFile(fileId, {
        filePath: finalDestPath,
        metadata,
        expiresAt: Date.now() + CONFIG.FILE_EXPIRATION_MINUTES * 60 * 1000,
      });

      return res.json({
        fileId,
        metadata,
      });
    } catch (err: any) {
      console.error('Upload complete/probe error:', err);
      if (fs.existsSync(finalDestPath)) {
        try {
          fs.unlinkSync(finalDestPath);
        } catch {}
      }
      return res.status(422).json({
        error: err.message || 'Unable to assemble or verify video file.',
      });
    }
  });

  // Sample video endpoint for instant testing
  app.get('/api/sample', async (req, res) => {
    try {
      const type = (req.query.type as any) || 'nature';
      const sample = await getOrCreateSampleVideo(type);
      const fileId = uuidv4();

      saveUploadedFile(fileId, {
        filePath: sample.filePath,
        metadata: sample.metadata,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      });

      res.json({
        fileId,
        metadata: sample.metadata,
      });
    } catch (err: any) {
      res.status(500).json({ error: `Could not load sample video: ${err.message}` });
    }
  });

  // Stream preview of uploaded source video
  app.get('/api/preview-source/:fileId', (req, res) => {
    const fileEntry = getUploadedFile(req.params.fileId);
    if (!fileEntry || !fs.existsSync(fileEntry.filePath)) {
      return res.status(404).json({ error: 'Source video not found or expired.' });
    }

    const videoPath = fileEntry.filePath;
    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;
      const file = fs.createReadStream(videoPath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4',
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
      };
      res.writeHead(200, head);
      fs.createReadStream(videoPath).pipe(res);
    }
  });

  // Create processing job
  app.post('/api/jobs', (req, res) => {
    const { fileId, targetDuration } = req.body;

    if (!fileId || typeof fileId !== 'string') {
      return res.status(400).json({ error: 'fileId is required.' });
    }

    const durationNum = parseFloat(targetDuration);
    if (isNaN(durationNum) || durationNum <= 0) {
      return res.status(400).json({ error: 'Valid targetDuration (in seconds) is required.' });
    }

    const fileEntry = getUploadedFile(fileId);
    if (!fileEntry || !fs.existsSync(fileEntry.filePath)) {
      return res.status(404).json({ error: 'Uploaded video session not found or expired. Please re-upload.' });
    }

    try {
      const job = jobManager.createJob(fileEntry.filePath, fileEntry.metadata, durationNum);
      res.status(201).json(job);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to start video processing job.' });
    }
  });

  // Get job status
  app.get('/api/jobs/:jobId', (req, res) => {
    const job = jobManager.getJob(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found or expired.' });
    }
    res.json(job);
  });

  // Server-Sent Events (SSE) stream for real-time progress updates
  app.get('/api/jobs/:jobId/events', (req, res) => {
    const jobId = req.params.jobId;
    const job = jobManager.getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found.' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    // Send initial state
    res.write(`data: ${JSON.stringify(job)}\n\n`);

    const unsubscribe = jobManager.subscribe(jobId, (updatedJob) => {
      res.write(`data: ${JSON.stringify(updatedJob)}\n\n`);
      if (
        updatedJob.status === 'completed' ||
        updatedJob.status === 'failed' ||
        updatedJob.status === 'cancelled'
      ) {
        // keep connection briefly open or let client close
      }
    });

    req.on('close', () => {
      unsubscribe();
    });
  });

  // Cancel processing job
  app.post('/api/jobs/:jobId/cancel', (req, res) => {
    const success = jobManager.cancelJob(req.params.jobId);
    if (success) {
      res.json({ status: 'cancelled' });
    } else {
      res.status(400).json({ error: 'Cannot cancel job (it may have finished or does not exist).' });
    }
  });

  // Stream preview of generated output video
  app.get('/api/preview/:jobId', (req, res) => {
    const job = jobManager.getJob(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: 'Processing job not found.' });
    }

    if (job.status !== 'completed') {
      return res.status(400).json({ error: 'Video is still being processed or verified.' });
    }

    if (!job.outputFile || !fs.existsSync(job.outputFile)) {
      return res.status(404).json({ error: 'Processed video file not found or expired.' });
    }

    const videoPath = job.outputFile;
    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;

    if (fileSize < 1024) {
      return res.status(500).json({ error: 'Generated video is invalid or empty.' });
    }

    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;
      const file = fs.createReadStream(videoPath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4',
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
        'Accept-Ranges': 'bytes',
      };
      res.writeHead(200, head);
      fs.createReadStream(videoPath).pipe(res);
    }
  });

  // Download metadata endpoint for chunked downloader
  app.get('/api/download-info/:jobId', (req, res) => {
    try {
      const job = jobManager.getJob(req.params.jobId);
      if (!job) {
        return res.status(404).json({ error: 'Processing job not found or expired.' });
      }

      if (job.status !== 'completed') {
        return res.status(400).json({ error: 'Video is still being processed. Please wait for completion.' });
      }

      if (!job.outputFile || !fs.existsSync(job.outputFile)) {
        return res.status(404).json({ error: 'Processed video file not found on disk.' });
      }

      const stat = fs.statSync(job.outputFile);
      const filename = job.downloadFilename || `extended-video-${job.jobId.slice(0, 8)}.mp4`;

      res.json({
        jobId: job.jobId,
        filesize: stat.size,
        filename,
        duration: job.outputMetadata?.duration || job.targetDuration,
        formattedDuration: job.outputMetadata?.formattedDuration || '30:00',
        mimeType: 'video/mp4',
        acceptRanges: true,
      });
    } catch (err: any) {
      console.error('Error getting download info:', err);
      res.status(500).json({ error: 'Failed to retrieve download metadata.' });
    }
  });

  // HEAD endpoint for instant validation and file size verification before download
  app.head('/api/download/:jobId', (req, res) => {
    try {
      const job = jobManager.getJob(req.params.jobId);
      if (!job || !job.outputFile || !fs.existsSync(job.outputFile)) {
        return res.status(404).end();
      }
      const stat = fs.statSync(job.outputFile);
      const filename = job.downloadFilename || `extended-video-${job.jobId.slice(0, 8)}.mp4`;
      const safeAsciiFilename = filename.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '');

      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${safeAsciiFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`
      );
      res.status(200).end();
    } catch {
      res.status(500).end();
    }
  });

  // Download final video endpoint with full binary streaming and Range support
  app.get('/api/download/:jobId', (req, res) => {
    try {
      const job = jobManager.getJob(req.params.jobId);
      if (!job) {
        return res.status(404).json({ error: 'Processing job not found or expired.' });
      }

      if (job.status !== 'completed') {
        return res.status(400).json({ error: 'Video is still being processed. Please wait for completion.' });
      }

      if (!job.outputFile || !fs.existsSync(job.outputFile)) {
        return res.status(404).json({ error: 'Processed video file not found on disk.' });
      }

      const videoPath = job.outputFile;
      const stat = fs.statSync(videoPath);
      const fileSize = stat.size;

      if (fileSize < 1024) {
        return res.status(500).json({ error: 'Generated video is incomplete or corrupted.' });
      }

      const filename = job.downloadFilename || `extended-video-${job.jobId.slice(0, 8)}.mp4`;
      const safeAsciiFilename = filename.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '');

      const range = req.headers.range;
      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        let start = parseInt(parts[0], 10);
        let end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        if (isNaN(start)) start = 0;
        if (isNaN(end) || end >= fileSize) end = fileSize - 1;

        if (start > end || start >= fileSize) {
          res.setHeader('Content-Range', `bytes */${fileSize}`);
          return res.status(416).end();
        }

        const chunksize = end - start + 1;
        const fileStream = fs.createReadStream(videoPath, { start, end });

        res.writeHead(206, {
          'Content-Type': 'video/mp4',
          'Content-Length': chunksize,
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Disposition': `attachment; filename="${safeAsciiFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
          'Cache-Control': 'public, max-age=3600',
        });

        fileStream.on('error', (streamErr) => {
          console.error('File stream range error:', streamErr);
          if (!res.headersSent) {
            res.status(500).end();
          }
        });

        req.on('close', () => {
          fileStream.destroy();
        });

        fileStream.pipe(res);
      } else {
        res.writeHead(200, {
          'Content-Type': 'video/mp4',
          'Content-Length': fileSize,
          'Accept-Ranges': 'bytes',
          'Content-Disposition': `attachment; filename="${safeAsciiFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
          'Cache-Control': 'public, max-age=3600',
        });

        const fileStream = fs.createReadStream(videoPath);

        fileStream.on('error', (streamErr) => {
          console.error('File stream full error:', streamErr);
          if (!res.headersSent) {
            res.status(500).end();
          }
        });

        req.on('close', () => {
          fileStream.destroy();
        });

        fileStream.pipe(res);
      }
    } catch (err: any) {
      console.error('Download route fatal error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message || 'Internal server error while streaming download.' });
      }
    }
  });

  // 404 fallback for any unmatched /api routes
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `API endpoint ${req.method} ${req.path} not found.` });
  });

  // Vite integration
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VIDEO-LENGTH INCREASER server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
