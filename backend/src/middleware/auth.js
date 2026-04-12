import jwt from 'jsonwebtoken'
import { config } from '../config/index.js'

export function requireAuth(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' })
  }
  try {
    const token = header.slice(7)
    req.user = jwt.verify(token, config.jwtSecret)
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

export function generateToken(payload) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '7d' })
}