const express = require('express');
const { getBookChapters } = require('./book');
const config = require('../utils/config');
const {
  createTask,
  getTask,
  addSSEClient,
  removeSSEClient,
} = require('../services/task-manager');
const { runTask } = require('../services/run-task');
const logger = require('../utils/logger');

const router = express.Router();

// 创建合成任务
router.post('/create', async (req, res) => {
  try {
    const { bookId, bookName, mode, voiceConfig, concurrency, maxTextLength, chapterIndices, audioBitrate } = req.body;

    if (!bookId) {
      return res.status(400).json({ error: '缺少 bookId' });
    }

    const chapters = getBookChapters(bookId);
    if (!chapters) {
      return res.status(404).json({ error: '书籍数据不存在，请重新上传' });
    }

    const task = createTask({
      bookId,
      chapters,
      mode: mode || 'single',
      voiceConfig: voiceConfig || { voice: '冰糖' },
      bookName: bookName || 'untitled',
      concurrency: concurrency || config.concurrency,
      maxTextLength: maxTextLength || config.maxTextLength,
      chapterIndices,
      audioBitrate,
    });

    logger.info(`Task created: ${task.id}`);

    // 后台启动合成
    runTask(task.id).catch(err => {
      logger.error(`Task ${task.id} execution error:`, err);
    });

    res.json({
      taskId: task.id,
      total: task.total,
    });
  } catch (err) {
    logger.error('Task create error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 获取任务状态
router.get('/:id', (req, res) => {
  const task = getTask(req.params.id);
  if (!task) {
    return res.status(404).json({ error: '任务不存在' });
  }
  res.json({
    id: task.id,
    bookName: task.bookName,
    mode: task.mode,
    status: task.status,
    chapters: task.chapters,
    total: task.total,
    done: task.done,
    failed: task.failed,
  });
});

// SSE 实时进度
router.get('/:id/stream', (req, res) => {
  const taskId = req.params.id;
  const task = getTask(taskId);
  if (!task) {
    return res.status(404).json({ error: '任务不存在' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  // 发送当前状态
  res.write(`data: ${JSON.stringify({
    status: task.status,
    chapters: task.chapters,
    total: task.total,
    done: task.done,
    failed: task.failed,
  })}\n\n`);

  addSSEClient(taskId, res);

  req.on('close', () => {
    removeSSEClient(taskId, res);
  });
});

module.exports = { taskRouter: router };
