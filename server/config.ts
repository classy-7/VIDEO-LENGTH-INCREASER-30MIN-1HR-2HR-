import path from 'path';
import fs from 'fs';

const BASE_TEMP_DIR = path.join(process.cwd(), 'temp');
const UPLOAD_DIR = path.join(BASE_TEMP_DIR, 'uploads');
const SESSIONS_DIR = path.join(UPLOAD_DIR, 'sessions');
const OUTPUT_DIR = path.join(BASE_TEMP_DIR, 'outputs');
const JOBS_DIR = path.join(BASE_TEMP_DIR, 'jobs');

// Ensure directories exist
if (!fs.existsSync(BASE_TEMP_DIR)) {
  fs.mkdirSync(BASE_TEMP_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}
if (!fs.existsSync(JOBS_DIR)) {
  fs.mkdirSync(JOBS_DIR, { recursive: true });
}

export const CONFIG = {
  TEMP_DIR: BASE_TEMP_DIR,
  UPLOAD_DIR,
  SESSIONS_DIR,
  OUTPUT_DIR,
  JOBS_DIR,
  MAX_UPLOAD_SIZE_MB: parseInt(process.env.MAX_UPLOAD_SIZE_MB || '500', 10),
  FILE_EXPIRATION_MINUTES: parseInt(process.env.FILE_EXPIRATION_MINUTES || '1440', 10), // 24 hours
  MAX_CONCURRENT_JOBS: 2,
  ALLOWED_EXTENSIONS: ['.mp4', '.mov', '.webm', '.mkv', '.avi', '.m4v', '.wmv', '.flv'],
  ALLOWED_MIME_TYPES: [
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'video/x-matroska',
    'video/x-msvideo',
    'video/x-m4v',
    'video/x-ms-wmv',
    'video/x-flv',
    'application/octet-stream', // Some browsers send octet-stream for mkv/mov
  ],
};
