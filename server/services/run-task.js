const fs = require('fs');
const path = require('path');
const config = require('../utils/config');
const logger = require('../utils/logger');
const { synthesizeSingleVoice, synthesizeMultiVoice } = require('./tts/synthesizer');
const {
  updateChapterStatus,
  updateTaskStatus,
  getTask,
} = require('./task-manager');

/**
 * 执行合成任务（在后台运行）
 */
async function runTask(taskId) {
  const task = getTask(taskId);
  if (!task) {
    logger.error(`Task ${taskId} not found`);
    return;
  }

  updateTaskStatus(taskId, 'running');

  const outputDir = path.join(config.outputDir, taskId);
  const chaptersData = task.chaptersData;

  if (!chaptersData || chaptersData.length === 0) {
    logger.error(`[${taskId}] No chapters data found`);
    updateTaskStatus(taskId, 'failed');
    return;
  }

  // 确定要合成的章节索引列表
  const indices = task.chapterIndices && task.chapterIndices.length > 0
    ? task.chapterIndices
    : chaptersData.map((_, i) => i);

  const bitrate = task.audioBitrate || '96k';
  const chapterConcurrency = Math.min(task.concurrency || config.concurrency, indices.length);

  logger.info(`[${taskId}] Synthesizing ${indices.length} chapters, concurrency=${chapterConcurrency}, bitrate=${bitrate}`);

  try {
    // 全局并发池：控制同时进行的章节数
    let cursor = 0;

    async function chapterWorker() {
      while (cursor < indices.length) {
        const ci = cursor++;
        const i = indices[ci];
        const chapter = chaptersData[i];

        // 如果章节已完成（断点续传），跳过
        if (task.chapters[i].status === 'done') continue;

        if (!chapter.content || chapter.content.trim().length === 0) {
          logger.warn(`[${taskId}] Chapter ${i + 1} has no content, skipping`);
          updateChapterStatus(taskId, i, 'failed', null, '章节内容为空');
          continue;
        }

        const safeTitle = chapter.title.replace(/[\/\\:*?"<>|]/g, '_').slice(0, 50);
        const mp3Path = path.join(outputDir, `chapter_${String(i + 1).padStart(3, '0')}_${safeTitle}.mp3`);

        try {
          updateChapterStatus(taskId, i, 'processing');
          logger.info(`[${taskId}] Synthesizing chapter ${i + 1}/${chaptersData.length}: ${chapter.title} (${chapter.content.length} chars)`);

          if (task.mode === 'multi') {
            await synthesizeMultiVoice(
              chapter.content,
              task.voiceConfig,
              mp3Path,
              () => {},
              task.maxTextLength,
              task.concurrency,
              bitrate,
            );
          } else {
            await synthesizeSingleVoice(
              chapter.content,
              task.voiceConfig.voice || '冰糖',
              mp3Path,
              () => {},
              task.maxTextLength,
              bitrate,
            );
          }

          updateChapterStatus(taskId, i, 'done', mp3Path);
          logger.info(`[${taskId}] Chapter ${i + 1} done: ${mp3Path}`);
        } catch (err) {
          const errMsg = err?.message || err?.error?.message || JSON.stringify(err) || String(err);
          logger.error(`[${taskId}] Chapter ${i + 1} failed: ${errMsg}`);
          updateChapterStatus(taskId, i, 'failed', null, errMsg);
        }
      }
    }

    const workers = [];
    for (let w = 0; w < chapterConcurrency; w++) {
      workers.push(chapterWorker());
    }
    await Promise.all(workers);
  } catch (err) {
    logger.error(`[${taskId}] Task execution crashed:`, err);
  }

  const finalTask = getTask(taskId);
  if (finalTask.failed > 0 && finalTask.done < finalTask.total) {
    updateTaskStatus(taskId, 'completed_with_errors');
  } else {
    updateTaskStatus(taskId, 'completed');
  }

  logger.info(`[${taskId}] Task finished. Done: ${finalTask.done}/${finalTask.total}, Failed: ${finalTask.failed}`);
}

module.exports = { runTask };
