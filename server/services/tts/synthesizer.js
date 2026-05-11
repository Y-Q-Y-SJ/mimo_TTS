const config = require('../../utils/config');
const logger = require('../../utils/logger');
const { synthesize } = require('./client');
const { chunkText } = require('../chapter/chunker');
const { analyzeRoles } = require('./role-analyzer');
const { assignVoices } = require('./voice-registry');
const { buffersToMp3 } = require('./audio-utils');

/**
 * 合成单个段落（带重试）
 */
async function synthesizeWithRetry(text, voice, style = '', retries = config.maxRetries) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await synthesize(text, { voice, style });
    } catch (err) {
      logger.warn(`TTS attempt ${attempt + 1} failed: ${err.message}`);
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
    }
  }
}

/**
 * 并发合成一组段落，保持顺序
 */
async function synthesizeParallel(chunks, voice, concurrency) {
  const buffers = new Array(chunks.length);
  let index = 0;

  async function worker() {
    while (index < chunks.length) {
      const i = index++;
      buffers[i] = await synthesizeWithRetry(chunks[i], voice);
    }
  }

  const workers = [];
  const n = Math.min(concurrency, chunks.length);
  for (let w = 0; w < n; w++) workers.push(worker());
  await Promise.all(workers);
  return buffers;
}

/**
 * 合成单音色章节（段内并发）
 */
async function synthesizeSingleVoice(chapterContent, voice, outputPath, onProgress, maxTextLength, bitrate) {
  const chunks = chunkText(chapterContent, maxTextLength || config.maxTextLength);

  if (chunks.length === 1) {
    const buf = await synthesizeWithRetry(chunks[0], voice);
    await buffersToMp3([buf], outputPath, bitrate);
    if (onProgress) onProgress(1, 1);
    return;
  }

  // 段内并发：同章节的多个分段同时合成
  const segConcurrency = Math.min(config.concurrency, chunks.length);
  logger.info(`Synthesizing ${chunks.length} segments, segConcurrency=${segConcurrency}`);

  const buffers = await synthesizeParallel(chunks, voice, segConcurrency);
  if (onProgress) onProgress(chunks.length, chunks.length);

  await buffersToMp3(buffers, outputPath, bitrate);
}

/**
 * 合成多音色章节
 */
async function synthesizeMultiVoice(chapterContent, voiceConfig, outputPath, onProgress, maxTextLength, concurrency, bitrate) {
  const segments = analyzeRoles(chapterContent);
  const assigned = assignVoices(segments, voiceConfig);

  const tasks = [];
  for (const seg of assigned) {
    const chunks = chunkText(seg.content, maxTextLength || config.maxTextLength);
    for (const chunk of chunks) {
      tasks.push({ text: chunk, voice: seg.voice });
    }
  }

  const buffers = new Array(tasks.length);
  let index = 0;
  const concurrencyLimit = concurrency || config.concurrency;

  async function worker() {
    while (index < tasks.length) {
      const i = index++;
      buffers[i] = await synthesizeWithRetry(tasks[i].text, tasks[i].voice);
      if (onProgress) {
        const done = buffers.filter(b => b).length;
        onProgress(done, tasks.length);
      }
    }
  }

  const workers = [];
  for (let w = 0; w < Math.min(concurrencyLimit, tasks.length); w++) {
    workers.push(worker());
  }
  await Promise.all(workers);

  await buffersToMp3(buffers, outputPath, bitrate);
}

module.exports = { synthesizeSingleVoice, synthesizeMultiVoice };
