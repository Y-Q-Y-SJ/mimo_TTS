const express = require('express');
const path = require('path');
const fs = require('fs');
const JSZip = require('jszip');
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

  // 收集已完成的章节，按序号排序
  const doneChapters = task.chapters
    .filter(ch => ch.status === 'done' && ch.audioPath && fs.existsSync(ch.audioPath))
    .sort((a, b) => (a.index || 0) - (b.index || 0));

  if (doneChapters.length === 0) {
    return res.status(404).json({ error: '没有可下载的音频' });
  }

  const outputDir = path.join(config.outputDir, taskId);
  const zipPath = path.join(outputDir, `${task.bookName || 'book'}.zip`);

  // 统计当前完成的章节数，用于判断缓存是否过期
  const currentDoneCount = doneChapters.length;
  const cacheMetaPath = path.join(outputDir, '.zip-meta');

  // 检查缓存是否有效
  if (fs.existsSync(zipPath) && fs.existsSync(cacheMetaPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(cacheMetaPath, 'utf-8'));
      if (meta.doneCount === currentDoneCount) {
        res.set('Content-Type', 'application/zip');
        res.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(task.bookName || 'book')}.zip`);
        return res.sendFile(path.resolve(zipPath));
      }
    } catch { /* 缓存无效，重新生成 */ }
  }

  // 生成 zip
  try {
    const zip = new JSZip();
    doneChapters.forEach((ch, i) => {
      const paddedIndex = String(ch.index || i + 1).padStart(3, '0');
      const safeTitle = (ch.title || `chapter_${ch.index}`).replace(/[\\/:*?"<>|]/g, '_');
      const ext = path.extname(ch.audioPath) || '.mp3';
      const fileName = `${paddedIndex}_${safeTitle}${ext}`;
      zip.file(fileName, fs.readFileSync(ch.audioPath));
    });

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(zipPath, zipBuffer);
    fs.writeFileSync(cacheMetaPath, JSON.stringify({ doneCount: currentDoneCount, updatedAt: Date.now() }));

    res.set('Content-Type', 'application/zip');
    res.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(task.bookName || 'book')}.zip`);
    res.sendFile(path.resolve(zipPath));
  } catch (err) {
    res.status(500).json({ error: '打包失败: ' + err.message });
  }
});

module.exports = { audioRouter: router };
