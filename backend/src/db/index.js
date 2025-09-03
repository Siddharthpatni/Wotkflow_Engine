import knex from 'knex';
import knexConfig from '../../knexfile.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';

const environment = config.env;
const dbConfig = knexConfig[environment];

const db = knex(dbConfig);

// Test database connection
export async function testConnection() {
  try {
    await db.raw('SELECT 1');
    logger.info('Database connected successfully');
    return true;
  } catch (error) {
    logger.error('Database connection failed:', error);
    throw error;
  }
}

export default db;
