export type PdfParseResult = {
  text: string
  pages?: unknown[]
}

export type PdfParseCtor = new (opts: { data: Buffer }) => {
  getText(): Promise<PdfParseResult>
}
