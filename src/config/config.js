// Configuration settings for the automation service
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables from .env file
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '../..');

export default {
  // Server configuration
  server: {
    port: process.env.PORT || 3000,
    environment: process.env.NODE_ENV || 'development',
  },
  
  // Database configuration
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'automation_service',
    ssl: process.env.DB_SSL === 'true',
  },
  
  // OpenAI configuration
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4',
  },
  
  // Browser automation configuration
  browser: {
    headless: process.env.BROWSER_HEADLESS !== 'false',
    slowMo: parseInt(process.env.BROWSER_SLOW_MO || '0', 10),
    defaultTimeout: parseInt(process.env.BROWSER_DEFAULT_TIMEOUT || '30000', 10),
    userDataDir: process.env.BROWSER_USER_DATA_DIR || join(rootDir, '.browser-data'),
  },
};