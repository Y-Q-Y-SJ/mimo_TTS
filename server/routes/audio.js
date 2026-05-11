const express = require('express');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const config = require('../utils/config');
const { getTask } = require('../services/task-manager');

const router = express.Router();

// 获取单章音频
router.get('/:taskId/:chapterIndex', (req, res) => {
  const { taskId, chapterIndex } = req.params;
  const task = getTask(taskId);

  if (!task) {
    return res.status(404).json({ error: '任务不存在' });
  }

  const ch = task.chapters[parseInt(chapterIndex)];
  if (!ch || !ch.audioPath || !fs.existsSync(ch.audioPath)) {
    return res.status(404).json({ error: '音频文件不存在' });
  }

  res.sendFile(path.resolve(ch.audioPath));
});

// 打包下载整书音频
router.get('/:taskId/zip/all', async (req, res) => {
  const { taskId } = req.params;
  const task = getTask(taskId);

  if (!task) {
    return res.status(404).json({ error: '任务不存在' });
  }

  const outputDir = path.join(config.outputDir, taskId);

  // 收集所有已完成的音频文件
  const mp3Files = task.chapters
    .filter(ch => ch.status === 'done' && ch.audioPath && fs.existsSync(ch.audioPath))
    .map(ch => ch.audioPath);

  if (mp3Files.length === 0) {
    return res.status(404).json({ error: '没有可下载的音频' });
  }

  const zipPath = path.join(outputDir, `${task.bookName || 'book'}.zip`);

  // 如果 zip 已存在且是最新的，直接返回
  if (fs.existsSync(zipPath)) {
    return res.sendFile(path.resolve(zipPath));
  }

  // 使用系统 zip 命令或 Node.js 方案
  try {
    const archiver = require('archiver');
    // archiver 可能未安装，用简单方案
    throw new Error('skip');
  } catch {
    // 回退：用系统命令
    try {
      const fileList = mp3Files.map(f => `"${f}"`).join(' ');
      // Windows 用 PowerShell，Linux 用 zip
      if (process.platform === 'win32') {
        const files = mp3Files.map(f => `'${f}'`).join(',');
        // 简单方案：逐个文件返回
      }
    } catch { /* ignore */ }
  }

  // 简单方案：返回文件列表让用户逐个下载
  const downloadList = task.chapters
    .filter(ch => ch.status === 'done' && ch.audioPath)
    .map(ch => ({
      index: ch.index,
      title: ch.title,
      downloadUrl: `/api/audio/${taskId}/${ch.index - 1}`,
    }));

  res.json({
    message: '整书打包功能开发中，请使用逐章下载',
    files: downloadList,
  });
});

module.exports = { audioRouter: router };
