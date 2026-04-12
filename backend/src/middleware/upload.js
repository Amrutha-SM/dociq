import multer from 'multer'
import { config } from '../config/index.js'

const ALLOWED_MIME = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/plain',
  'text/csv',
  'text/markdown',
]

const storage = multer.memoryStorage()

export const upload = multer({
  storage,
  limits: { fileSize: config.maxFileSizeMb * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (ALLOWED_MIME.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(Object.assign(new Error(`Unsupported file type: ${file.mimetype}`), { status: 400 }))
    }
  },
})