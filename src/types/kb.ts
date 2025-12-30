export type UploadedDocumentSummary = {
  id: string
  fileName: string
  pageCount: number
  createdAt: Date
}

export type UploadError = {
  fileName: string
  error: string
}

export type KBOrder = Partial<Record<'createdAt' | 'updatedAt' | 'name', 'ASC' | 'DESC'>>
