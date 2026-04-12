import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { chatWithDocument } from '../services/claudeService.js'

const router = Router()
const prisma = new PrismaClient()

router.post('/', async (req, res) => {
  const { documentId, message, sessionId } = req.body
  if (!documentId || !message) {
    return res.status(400).json({ error: 'documentId and message are required' })
  }

  const extraction = await prisma.extraction.findFirst({
    where: { documentId },
  })
  if (!extraction) {
    return res.status(400).json({ error: 'Document not extracted yet' })
  }

  let session = sessionId
    ? await prisma.chatSession.findUnique({ where: { id: sessionId } })
    : null

  if (!session) {
    session = await prisma.chatSession.create({
      data: { documentId, messages: [] },
    })
  }

  const history = Array.isArray(session.messages) ? session.messages : []
  const reply   = await chatWithDocument(extraction, history, message)
  const now     = new Date().toISOString()

  const updatedMessages = [
    ...history,
    { role: 'user',      content: message, timestamp: now },
    { role: 'assistant', content: reply,   timestamp: now },
  ]

  await prisma.chatSession.update({
    where: { id: session.id },
    data:  { messages: updatedMessages },
  })

  res.json({
    sessionId: session.id,
    reply,
    history: updatedMessages.map(m => ({ role: m.role, content: m.content })),
  })
})

router.get('/:sessionId', async (req, res) => {
  const session = await prisma.chatSession.findUniqueOrThrow({
    where: { id: req.params.sessionId },
  })
  res.json(session)
})

export default router