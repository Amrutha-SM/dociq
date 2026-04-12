import { v2 as cloudinary } from 'cloudinary'
import streamifier from 'streamifier'
import { config } from '../config/index.js'

cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key:    config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
})

const MIME_TO_FILETYPE = {
  'application/pdf': 'pdf',
  'image/png':       'image',
  'image/jpeg':      'image',
  'image/webp':      'image',
  'text/plain':      'text',
  'text/csv':        'text',
  'text/markdown':   'text',
}

export async function uploadToCloudinary(buffer, mimetype, originalName) {
  if (!config.cloudinary.cloudName) {
    return { url: null, publicId: null }
  }

  const resourceType = mimetype.startsWith('image/') ? 'image' : 'raw'

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: resourceType,
        folder: 'dociq',
        public_id: `${Date.now()}-${originalName.replace(/\s+/g, '_')}`,
        overwrite: false,
      },
      (err, result) => {
        if (err) reject(err)
        else resolve({ url: result.secure_url, publicId: result.public_id })
      }
    )
    streamifier.createReadStream(buffer).pipe(stream)
  })
}

export async function deleteFromCloudinary(publicId) {
  if (!publicId || !config.cloudinary.cloudName) return
  await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' })
}

export function getFileType(mimetype) {
  return MIME_TO_FILETYPE[mimetype] || 'text'
}