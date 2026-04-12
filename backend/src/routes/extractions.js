import { Router } from 'express'
import { PrismaClient } from '@prisma/client'

const router = Router()
const prisma = new PrismaClient()

router.get('/:documentId', async (req, res) => {
  const extraction = await prisma.extraction.findFirstOrThrow({
    where: { documentId: req.params.documentId },
  })
  res.json(extraction)
})

export default router