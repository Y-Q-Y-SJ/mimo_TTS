const path = require('path');
const { parseTxt } = require('./txt-parser');
const { parseEpub } = require('./epub-parser');
const { parsePdf } = require('./pdf-parser');

/**
 * 根据文件扩展名选择解析器
 * @param {string} filePath - 文件路径
 * @param {string[]} extraFilterPatterns - 额外的广告过滤正则
 * @returns {Promise<string>} 纯文本内容
 */
async function parseBook(filePath, extraFilterPatterns = []) {
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case '.txt':
      return parseTxt(filePath, extraFilterPatterns);
    case '.epub':
      return parseEpub(filePath, extraFilterPatterns);
    case '.pdf':
      return parsePdf(filePath, extraFilterPatterns);
    default:
      throw new Error(`Unsupported file format: ${ext}`);
  }
}

module.exports = { parseBook };
