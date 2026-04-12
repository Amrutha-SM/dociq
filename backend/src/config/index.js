import 'dotenv/config'

export const config = {
  port:           process.env.PORT || 4000,
  nodeEnv:        process.env.NODE_ENV || 'development',
  jwtSecret:      process.env.JWT_SECRET,
  groqKey:        process.env.GROQ_API_KEY,
  allowedOrigins: (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()),
  maxFileSizeMb:  parseInt(process.env.MAX_FILE_SIZE_MB || '10'),
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey:    process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
}

const required = ['JWT_SECRET', 'GROQ_API_KEY', 'DATABASE_URL']
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`)
    process.exit(1)
  }
}