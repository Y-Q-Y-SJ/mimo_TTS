require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const path = require('path');

const config = {
  port: process.env.PORT || 3000,
  mimoApiKey: process.env.MIMO_API_KEY || '',
  mimoBaseUrl: 'https://api.xiaomimimo.com/v1',
  mimoModel: 'mimo-v2.5-tts',
  uploadsDir: path.join(__dirname, '..', 'uploads'),
  outputDir: path.join(__dirname, '..', 'output'),
  maxTextLength: 2000,
  fallbackChunkSize: 5000,
  concurrency: 5,
  maxRetries: 3,
};

module.exports = config;
