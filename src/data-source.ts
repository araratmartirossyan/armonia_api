import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { User } from './entities/User';
import { License } from './entities/License';
import { KnowledgeBase } from './entities/KnowledgeBase';
import { Configuration } from './entities/Configuration';
import { Document } from './entities/Document';
import dotenv from 'dotenv';
dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'beauty_db',
  synchronize: process.env.NODE_ENV !== 'production', // Set to false in production and use migrations
  logging: process.env.DB_LOGGING === 'true',
  entities: [User, License, KnowledgeBase, Configuration, Document],
  migrations: [],
  ssl: {
    rejectUnauthorized: false,
  },
  subscribers: [],
});
