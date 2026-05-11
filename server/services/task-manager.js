const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const config = require('../utils/config');
const logger = require('../utils/logger');

// 任务存储
const tasks = new Map();

// SSE 客户端存储
const sseClients = new Map();

/**
 * 创建任务
 */
function createTask({ bookId, chapters, mode, voiceConfig, bookName, concurrency, maxTextLength, chapterIndices, audioBitrate }) {
  const taskId = uuidv4();
  const outputDir = path.join(config.outputDir, taskId);
  fs.mkdirSync(outputDir, { recursive: true });

  const task = {
    id: taskId,
    bookId,
    bookName,
    mode,
    voiceConfig,
    concurrency: concurrency || config.concurrency,
    maxTextLength: maxTextLength || config.maxTextLength,
    chapterIndices: chapterIndices || [],
    audioBitrate: audioBitrate || '96k',
    status: 'pending', // pending | running | completed | failed
    chapters: chapters.map((ch, i) => ({
      index: i + 1,
      title: ch.title,
      charCount: ch.charCount,
      status: 'pending',
      audioPath: null,
    })),
    total: chapters.length,
    done: 0,
    failed: 0,
    createdAt: new Date().toISOString(),
    chaptersData: chapters, // 保存章节内容供合成使用
  };

  tasks.set(taskId, task);
  saveProgress(taskId);

  return task;
}

/**
 * 获取任务
 */
function getTask(taskId) {
  return tasks.get(taskId);
}

/**
 * 更新章节状态
 */
function updateChapterStatus(taskId, chapterIndex, status, audioPath = null, error = null) {
  const task = tasks.get(taskId);
  if (!task) return;

  const ch = task.chapters[chapterIndex];
  if (!ch) return;

  ch.status = status;
  if (audioPath) ch.audioPath = audioPath;
  if (error) ch.error = error;

  if (status === 'done') task.done++;
  if (status === 'failed') task.failed++;

  // 通知 SSE 客户端
  notifyClients(taskId);
  saveProgress(taskId);
}

/**
 * 更新任务状态
 */
function updateTaskStatus(taskId, status) {
  const task = tasks.get(taskId);
  if (!task) return;
  task.status = status;
  notifyClients(taskId);
  saveProgress(taskId);
}

/**
 * 保存进度到文件（断点续传）
 */
function saveProgress(taskId) {
  const task = tasks.get(taskId);
  if (!task) return;

  const progressPath = path.join(config.outputDir, taskId, 'progress.json');
  const data = {
    id: task.id,
    bookName: task.bookName,
    mode: task.mode,
    voiceConfig: task.voiceConfig,
    concurrency: task.concurrency,
    maxTextLength: task.maxTextLength,
    chapterIndices: task.chapterIndices,
    audioBitrate: task.audioBitrate,
    status: task.status,
    chapters: task.chapters,
    total: task.total,
    done: task.done,
    failed: task.failed,
  };
  fs.writeFileSync(progressPath, JSON.stringify(data, null, 2));
}

/**
 * 从文件恢复进度
 */
function loadProgress(taskId) {
  const progressPath = path.join(config.outputDir, taskId, 'progress.json');
  if (!fs.existsSync(progressPath)) return null;

  const data = JSON.parse(fs.readFileSync(progressPath, 'utf-8'));
  tasks.set(taskId, data);
  return data;
}

/**
 * 注册 SSE 客户端
 */
function addSSEClient(taskId, res) {
  if (!sseClients.has(taskId)) {
    sseClients.set(taskId, new Set());
  }
  sseClients.get(taskId).add(res);
}

/**
 * 移除 SSE 客户端
 */
function removeSSEClient(taskId, res) {
  const clients = sseClients.get(taskId);
  if (clients) {
    clients.delete(res);
  }
}

/**
 * 通知所有 SSE 客户端
 */
function notifyClients(taskId) {
  const task = tasks.get(taskId);
  if (!task) return;

  const clients = sseClients.get(taskId);
  if (!clients) return;

  const data = JSON.stringify({
    status: task.status,
    chapters: task.chapters,
    total: task.total,
    done: task.done,
    failed: task.failed,
  });

  for (const res of clients) {
    try {
      res.write(`data: ${data}\n\n`);
    } catch {
      clients.delete(res);
    }
  }
}

module.exports = {
  createTask,
  getTask,
  updateChapterStatus,
  updateTaskStatus,
  loadProgress,
  addSSEClient,
  removeSSEClient,
};
