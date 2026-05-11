const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const config = require('../utils/config');
const { parseBook } = require('../services/parser');
const { splitChapters } = require('../services/chapter/splitter');
const logger = require('../utils/logger');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(config.uploadsDir, { recursive: true });
    cb(null, config.uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.txt', '.epub', '.pdf'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('仅支持 TXT、EPUB、PDF 格式'));
    }
  },
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});

// 上传书籍并解析章节
router.post('/upload', upload.single('book'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传书籍文件' });
    }

    const bookId = uuidv4();
    const bookName = path.basename(req.file.originalname, path.extname(req.file.originalname));
    const filePath = req.file.path;

    // 获取用户自定义过滤关键词
    let extraFilterPatterns = [];
    if (req.body.adFilters) {
      try {
        extraFilterPatterns = JSON.parse(req.body.adFilters);
      } catch { /* ignore */ }
    }

    logger.info(`Parsing book: ${req.file.originalname}`);
    const text = await parseBook(filePath, extraFilterPatterns);

    // 获取自定义章节正则
    const chapterPattern = req.body.chapterPattern || '';

    logger.info(`Splitting chapters...`);
    const chapters = splitChapters(text, chapterPattern);

    logger.info(`Found ${chapters.length} chapters`);

    // 将章节数据保存到临时文件（大书不会全部存内存）
    const dataDir = path.join(config.uploadsDir, bookId);
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(
      path.join(dataDir, 'chapters.json'),
      JSON.stringify(chapters.map(ch => ({
        index: ch.index,
        title: ch.title,
        charCount: ch.charCount,
        content: ch.content,
      })), null, 2),
    );

    // 返回不含 content 的章节列表给前端
    const chapterList = chapters.map(ch => ({
      index: ch.index,
      title: ch.title,
      charCount: ch.charCount,
    }));

    res.json({
      bookId,
      bookName,
      totalChapters: chapters.length,
      chapters: chapterList,
    });
  } catch (err) {
    logger.error('Book upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 获取书籍章节内容（内部用）
function getBookChapters(bookId) {
  const chaptersPath = path.join(config.uploadsDir, bookId, 'chapters.json');
  if (!fs.existsSync(chaptersPath)) return null;
  return JSON.parse(fs.readFileSync(chaptersPath, 'utf-8'));
}

module.exports = { bookRouter: router, getBookChapters };
