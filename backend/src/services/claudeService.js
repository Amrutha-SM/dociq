import Groq from 'groq-sdk'
import { config } from '../config/index.js'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { PdfReader } = require('pdfreader')

const groq = new Groq({ apiKey: config.groqKey })

const EXTRACTION_PROMPT = `You are an expert document intelligence AI.
Extract structured information and return ONLY valid JSON — no markdown fences, no preamble, no explanation.

Return exactly this JSON structure:
{
  "document_title": "string — guess from content",
  "document_type": "Invoice|Contract|Report|Article|Form|Letter|Resume|Receipt|Other",
  "language": "English",
  "confidence": 0.85,
  "word_count": 500,
  "page_count": 1,
  "summary": {
    "brief": "2-3 sentence overview of the document.",
    "key_points": ["point 1", "point 2", "point 3"]
  },
  "entities": {
    "persons": [],
    "organizations": [],
    "locations": [],
    "dates": [],
    "monetary_values": []
  },
  "key_information": [
    { "field": "label", "value": "value", "confidence": 0.99 }
  ],
  "sentiment": { "overall": "neutral", "score": 0.0, "tone": "formal" },
  "extraction_notes": "string"
}`

function trimText(text, maxChars = 3500) {
  if (!text) return ''
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= maxChars) return cleaned
  return cleaned.substring(0, maxChars) + '\n[Content trimmed...]'
}

function parsePdfBuffer(buffer) {
  return new Promise((resolve, reject) => {
    const items = []
    new PdfReader().parseBuffer(buffer, (err, item) => {
      if (err) {
        reject(err)
      } else if (!item) {
        // End of file
        resolve(items.join(' '))
      } else if (item.text) {
        items.push(item.text)
      }
    })
  })
}

async function extractTextFromBuffer(buffer, mimetype, fileType) {
  if (fileType === 'text') {
    const text = buffer.toString('utf-8')
    console.log('Text file length:', text.length)
    return trimText(text)
  }

  if (fileType === 'pdf') {
    try {
      console.log('Parsing PDF buffer of size:', buffer.length)
      const text = await parsePdfBuffer(buffer)
      console.log('PDF parsed, text length:', text.length)
      console.log('PDF text preview:', text.substring(0, 300))
      if (!text || text.trim().length < 10) {
        return 'This PDF appears to be scanned or image-based. No extractable text found.'
      }
      return trimText(text)
    } catch (err) {
      console.error('PDF parse error:', err.message)
      return 'PDF parsing failed: ' + err.message
    }
  }

  if (fileType === 'image') {
    const b64 = buffer.toString('base64')
    const dataUrl = `data:${mimetype};base64,${b64}`
    try {
      const response = await groq.chat.completions.create({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: dataUrl } },
              { type: 'text', text: 'Extract all text visible in this image. Return only the raw text content.' },
            ],
          },
        ],
        max_tokens: 1000,
      })
      const text = response.choices[0]?.message?.content || ''
      console.log('Image text extracted, length:', text.length)
      return trimText(text)
    } catch (err) {
      console.error('Image extract error:', err.message)
      return 'Could not extract image text: ' + err.message
    }
  }

  return 'No content could be extracted.'
}

export async function runExtraction(buffer, mimetype, fileType, opts = {}) {
  const sections = []
  if (opts.summary)   sections.push('summary')
  if (opts.entities)  sections.push('entities')
  if (opts.keyinfo)   sections.push('key_information')
  if (opts.sentiment) sections.push('sentiment')
  if (opts.tables)    sections.push('tables')

  if (sections.length === 0) {
    sections.push('summary', 'entities', 'key_information', 'sentiment')
  }

  const textContent = await extractTextFromBuffer(buffer, mimetype, fileType)
  console.log('Final text length:', textContent.length)
  console.log('Text preview:', textContent.substring(0, 200))

  const prompt = `${EXTRACTION_PROMPT}

Extract these sections: ${sections.join(', ')}.

Document content:
"""
${textContent}
"""

Even if content is partial, extract as much as possible.
Return only valid JSON, nothing else.`

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 1500,
    temperature: 0.1,
  })

  const raw = response.choices[0]?.message?.content
    ?.replace(/```json|```/g, '')
    ?.trim()

  console.log('Groq response preview:', raw?.substring(0, 300))

  if (!raw) throw new Error('Empty response from Groq')

  return JSON.parse(raw)
}

export async function chatWithDocument(extraction, history, userMessage) {
  const systemContext = `You are a document Q&A assistant.
Document: ${extraction.documentTitle || 'Untitled'}
Type: ${extraction.documentType || 'Unknown'}
Summary: ${extraction.summaryBrief || 'N/A'}
Key points: ${JSON.stringify(extraction.keyPoints || []).substring(0, 300)}
Key info: ${JSON.stringify(extraction.keyInformation || []).substring(0, 300)}
Entities: ${JSON.stringify(extraction.entities || {}).substring(0, 300)}
Answer concisely. If not in document, say so.`

  const messages = [
    { role: 'system', content: systemContext },
    ...history.slice(-6).map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    })),
    { role: 'user', content: userMessage },
  ]

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages,
    max_tokens: 500,
    temperature: 0.3,
  })

  return response.choices[0]?.message?.content || 'Sorry, could not generate a response.'
}