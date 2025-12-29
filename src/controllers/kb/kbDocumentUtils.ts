import fs from 'fs'
import path from 'path'
import { Document } from '../../entities/Document'
import type { PdfParseCtor } from '../../types/pdf'

type PdfParseModule = {
  PDFParse?: PdfParseCtor
  default?: { PDFParse?: PdfParseCtor }
}

// Lazy load pdf-parse only when needed to avoid memory issues at startup
let PDFParse: PdfParseCtor | null = null
export const getPdfParse = async (): Promise<PdfParseCtor> => {
  if (!PDFParse) {
    const pdfParseModule = (await import('pdf-parse')) as PdfParseModule
    const ctor = pdfParseModule.PDFParse ?? pdfParseModule.default?.PDFParse
    if (!ctor) {
      throw new Error('pdf-parse module did not export PDFParse constructor')
    }
    PDFParse = ctor
  }
  return PDFParse
}

export const getUploadsDir = (): string => {
  const configured = process.env.UPLOADS_DIR?.trim()
  if (configured)
    return path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured)
  return path.join(process.cwd(), 'uploads')
}

export const resolveExistingPdfPath = (doc: Document): string | null => {
  const uploadsDir = getUploadsDir()

  const candidates: string[] = []
  if (doc.filePath) {
    candidates.push(
      path.isAbsolute(doc.filePath) ? doc.filePath : path.join(process.cwd(), doc.filePath),
    )
  }
  if (doc.fileName) {
    candidates.push(path.join(uploadsDir, doc.fileName))
  }

  for (const p of candidates) {
    if (p && fs.existsSync(p)) return p
  }

  // Fallback: if disk filename has UUID suffix, try to find by base name prefix in uploadsDir.
  // Example: "manual.pdf" might exist as "manual-<uuid>.pdf"
  try {
    const ext = path.extname(doc.fileName || '').toLowerCase() || '.pdf'
    const base = path.basename(doc.fileName || '', ext)
    if (!base) return null
    const files = fs.readdirSync(uploadsDir)
    const matches = files
      .filter(f => f.toLowerCase().endsWith(ext) && f.startsWith(`${base}-`))
      .map(f => path.join(uploadsDir, f))
      .filter(p => fs.existsSync(p))
    if (!matches.length) return null
    matches.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)
    return matches[0]
  } catch {
    return null
  }
}
