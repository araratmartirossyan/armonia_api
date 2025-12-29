import { Document as LCDocument } from '@langchain/core/documents'
import { AppDataSource } from '../../data-source'
import { Document as KBDocument } from '../../entities/Document'
import { In } from 'typeorm'

export type RagSource = { idx: number; label: string }

export async function loadDocumentNames(documentIds: string[]): Promise<Record<string, string>> {
  if (!documentIds.length) return {}
  const repo = AppDataSource.getRepository(KBDocument)
  const docs = await repo.find({ where: { id: In(documentIds) } })
  return docs.reduce<Record<string, string>>((acc, doc) => {
    if (doc.id) acc[doc.id] = doc.fileName || ''
    return acc
  }, {})
}

export function buildSources(
  results: Array<[LCDocument, number]>,
  docNameMap: Record<string, string>,
): { sources: RagSource[]; context: string } {
  // Build a de-duplicated sources list (same PDF can appear in multiple retrieved chunks).
  const seen = new Set<string>()
  const sources: RagSource[] = []
  for (const [doc] of results) {
    const docId = doc.metadata?.documentId ? String(doc.metadata.documentId) : null
    const fileName = doc.metadata?.fileName || (docId ? docNameMap[docId] : null)
    const sourceUrl = doc.metadata?.sourceUrl ? String(doc.metadata.sourceUrl) : null

    const key = docId || sourceUrl || fileName || 'unknown'
    if (seen.has(key)) continue
    seen.add(key)

    const label =
      fileName && sourceUrl ? `[${fileName}](${sourceUrl})` : fileName ? fileName : 'unknown'
    sources.push({ idx: sources.length + 1, label })
  }

  const context = results
    .map(([doc, score], idx) => {
      const parts: string[] = []
      const docId = doc.metadata?.documentId ? String(doc.metadata.documentId) : null
      const fileName = doc.metadata?.fileName || (docId ? docNameMap[docId] : null)
      if (fileName) parts.push(fileName)
      if (docId) parts.push(`documentId=${docId}`)
      const source = parts.length ? parts.join(' | ') : 'unknown'
      return `### Source ${idx + 1} (score=${Number(score).toFixed(4)}): ${source}\n\n${doc.pageContent}`
    })
    .join('\n\n---\n\n')

  return { sources, context }
}

export function formatSourcesSection(sources: RagSource[]): string {
  if (!sources.length) return ''
  return `\n\nSources:\n${sources.map(s => `- Source ${s.idx}: ${s.label}`).join('\n')}`
}
