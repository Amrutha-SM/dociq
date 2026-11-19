import 'express-async-errors'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import { config } from './config/index.js'
import { errorHandler } from './middleware/errorHandler.js'
import documentsRouter   from './routes/documents.js'
import extractionsRouter from './routes/extractions.js'
import chatRouter        from './routes/chat.js'

const app = express()

app.set('trust proxy', 1)

app.use(helmet())
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || config.allowedOrigins.includes(origin)) cb(null, true)
    else cb(new Error('Not allowed by CORS'))
  },
  credentials: true,
}))

app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, slow down.' },
}))

app.use(express.json({ limit: '1mb' }))
app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'))

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', env: config.nodeEnv, ts: new Date().toISOString() })
})

app.use('/api/documents',   documentsRouter)
app.use('/api/extractions', extractionsRouter)
app.use('/api/chat',        chatRouter)

app.use((req, res) => res.status(404).json({ error: 'Route not found' }))
app.use(errorHandler)

if (!process.env.VERCEL) {
  app.listen(config.port, () => {
    console.log(`DocIQ API running on http://localhost:${config.port}`)
    console.log(`Environment: ${config.nodeEnv}`)
  })
}

export default app