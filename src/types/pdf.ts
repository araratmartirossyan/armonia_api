export type PdfParseResult = {
  text: string
  pages?: unknown[]
}

export type PdfParseOpts = {
  data: Buffer
}

export type PdfParseCtor = new (opts: PdfParseOpts) => {
  getText(): Promise<PdfParseResult>
}

export type PdfParseModule = {
  PDFParse?: PdfParseCtor
  default?: { PDFParse?: PdfParseCtor }
}
