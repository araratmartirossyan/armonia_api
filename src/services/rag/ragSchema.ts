import { Pool } from 'pg';

let initialized = false;

export const PGVECTOR_DIMENSION = 1536; // text-embedding-3-small

export async function ensurePgVectorSchema(pgPool: Pool) {
  if (initialized) return;
  const client = await pgPool.connect();
  try {
    await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
    await client.query(`CREATE EXTENSION IF NOT EXISTS vector;`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS kb_documents (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        kb_id text NOT NULL,
        content text NOT NULL,
        metadata jsonb,
        embedding vector(${PGVECTOR_DIMENSION}) NOT NULL
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS kb_documents_kb_id_idx ON kb_documents (kb_id);`);
    await client.query(`
      CREATE INDEX IF NOT EXISTS kb_documents_embedding_hnsw_idx
      ON kb_documents
      USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64);
    `);
    initialized = true;
  } finally {
    client.release();
  }
}
