import config from './src/config/index.js';

export default {
  development: {
    client: 'postgresql',
    connection: config.database.url,
    pool: config.database.pool,
    migrations: {
      directory: './src/db/migrations',
    },
    seeds: {
      directory: './src/db/seeds',
    },
  },
  
  production: {
    client: 'postgresql',
    connection: config.database.url,
    pool: config.database.pool,
    migrations: {
      directory: './src/db/migrations',
    },
  },
  
  test: {
    client: 'postgresql',
    connection: config.database.url,
    pool: { min: 1, max: 1 },
    migrations: {
      directory: './src/db/migrations',
    },
  },
};
