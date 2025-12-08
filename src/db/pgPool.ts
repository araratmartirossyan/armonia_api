import { Pool } from 'pg';

const useConnectionString = !!process.env.DATABASE_URL;

export const pgPool = new Pool(
  useConnectionString
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: {
          rejectUnauthorized: false,
        },
      }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        user: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_NAME || 'beauty_db',
        ssl: {
          rejectUnauthorized: false,
        },
      },
);
