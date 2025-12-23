import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import type { Request } from 'express';

const getUploadsDir = (): string => {
  const configured = process.env.UPLOADS_DIR?.trim();
  if (configured) {
    return path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
  }
  // Default (backwards-compatible)
  return path.join(process.cwd(), 'uploads');
};

const ensureDirExists = (dirPath: string) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const sanitizeFileBaseName = (name: string): string => {
  const cleaned = name
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned.slice(0, 80);
};

// Configure multer for PDF file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = getUploadsDir();
    ensureDirExists(uploadsDir);
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename derived from original name + UUID (no hardcoded prefix)
    const ext = path.extname(file.originalname) || '.pdf';
    const base = sanitizeFileBaseName(path.basename(file.originalname, ext)) || 'document';
    cb(null, `${base}-${randomUUID()}${ext}`);
  },
});

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Only accept PDF files
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
    files: 10, // Maximum 10 files at once
  },
});

