import { JsonObject } from './json'

export type DbDocumentRow = {
  content: string
  metadata: JsonObject | null
  score: number
}
