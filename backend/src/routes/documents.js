import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { upload } from '../middleware/upload.js'
import { uploadToCloudinary, deleteFromCloudinary, getFileType } from '../services/fileService.js'
import { runExtraction } from '../services/claudeService.js'

const router = Router()
const prisma = new PrismaClient()

router.post('/upload', upload.single('file'), async (req, res) => {
  const file = req.file
  if (!file) return res.status(400).json({ error: 'No file provided' })

  const fileType = getFileType(file.mimetype)
  let opts = {}
  try { opts = JSON.parse(req.body.options || '{}') } catch {}

  const { url, publicId } = await uploadToCloudinary(
    file.buffer, file.mimetype, file.originalname
  )

  const doc = await prisma.document.create({
    data: {
      filename:     file.originalname,
      originalName: file.originalname,
      fileType,
      fileSize:     file.size,
      fileUrl:      url || 'local',
      publicId:     publicId || null,
      status:       'PROCESSING',
    },
  })

  try {
    const data = await runExtraction(file.buffer, file.mimetype, fileType, opts)

    await prisma.extraction.create({
      data: {
        documentId:      doc.id,
        documentTitle:   data.document_title    || null,
        documentType:    data.document_type     || null,
        language:        data.language          || null,
        confidence:      data.confidence        ?? null,
        wordCount:       data.word_count        ?? null,
        pageCount:       data.page_count        ?? null,
        summaryBrief:    data.summary?.brief    || null,
        keyPoints:       data.summary?.key_points || [],
        entities:        data.entities          || {},
        keyInformation:  data.key_information   || [],
        sentiment:       data.sentiment         || {},
        tables:          data.tables            || [],
        rawJson:         data,
        extractionNotes: data.extraction_notes  || null,
      },
    })

    await prisma.document.update({
      where: { id: doc.id },
      data:  { status: 'DONE' },
    })

    const full = await prisma.document.findUnique({
      where:   { id: doc.id },
      include: { extraction: true },
    })
    res.status(201).json(full)

  } catch (err) {
    await prisma.document.update({
      where: { id: doc.id },
      data:  { status: 'ERROR' },
    })
    throw err
  }
})

router.get('/', async (req, res) => {
  const docs = await prisma.document.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true, originalName: true, fileType: true,
      fileSize: true, status: true, createdAt: true,
    },
  })
  res.json(docs)
})

router.get('/:id', async (req, res) => {
  const doc = await prisma.document.findUniqueOrThrow({
    where:   { id: req.params.id },
    include: { extraction: true },
  })
  res.json(doc)
})

router.delete('/:id', async (req, res) => {
  const doc = await prisma.document.findUniqueOrThrow({
    where: { id: req.params.id },
  })
  if (doc.publicId) await deleteFromCloudinary(doc.publicId)
  await prisma.document.delete({ where: { id: req.params.id } })
  res.json({ deleted: true })
})

export default router