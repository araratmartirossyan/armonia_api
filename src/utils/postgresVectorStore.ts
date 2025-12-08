import { VectorStore } from '@langchain/core/vectorstores';
import { Document } from '@langchain/core/documents';
import { Embeddings } from '@langchain/core/embeddings';
import { Pool } from 'pg';

type DbDocumentRow = {
  content: string;
  metadata: any;
  score: number;
};

export class PostgresVectorStore extends VectorStore {
  private pool: Pool;
  private kbId: string;

  private toVectorLiteral(vec: number[]): string {
    // pgvector expects the canonical text format: [1,2,3]
    return `[${vec.join(',')}]`;
  }

  constructor(embeddings: Embeddings, pool: Pool, kbId: string) {
    super(embeddings, {});
    this.pool = pool;
    this.kbId = kbId;
  }

  _vectorstoreType(): string {
    return 'postgres-pgvector';
  }

  async addDocuments(documents: Document[]): Promise<void> {
    const texts = documents.map((d) => d.pageContent);
    const vectors = await this.embeddings.embedDocuments(texts);
    await this.addVectors(vectors, documents);
  }

  async addVectors(vectors: number[][], documents: Document[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      const insertQuery = `
        INSERT INTO kb_documents (kb_id, content, metadata, embedding)
        VALUES ($1, $2, $3, $4)
      `;
      for (let i = 0; i < documents.length; i++) {
        const vectorLiteral = this.toVectorLiteral(vectors[i]);
        await client.query(insertQuery, [
          this.kbId,
          documents[i].pageContent,
          documents[i].metadata ?? {},
          vectorLiteral,
        ]);
      }
    } finally {
      client.release();
    }
  }

  async similaritySearchVectorWithScore(queryVector: number[], k: number): Promise<[Document, number][]> {
    const client = await this.pool.connect();
    try {
      const queryVectorLiteral = this.toVectorLiteral(queryVector);
      const res = await client.query<DbDocumentRow>(
        `
          SELECT
            content,
            metadata,
            (1 - (embedding <=> $1)) AS score
          FROM kb_documents
          WHERE kb_id = $2
          ORDER BY embedding <-> $1
          LIMIT $3
        `,
        [queryVectorLiteral, this.kbId, k],
      );

      return res.rows.map((row) => [
        new Document({
          pageContent: row.content,
          metadata: row.metadata || {},
        }),
        Number(row.score),
      ]);
    } finally {
      client.release();
    }
  }

  async deleteByKnowledgeBase(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(`DELETE FROM kb_documents WHERE kb_id = $1`, [this.kbId]);
    } finally {
      client.release();
    }
  }
}
