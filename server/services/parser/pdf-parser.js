const fs = require('fs');
const pdfParse = require('pdf-parse');
const { filterAds } = require('./ad-filter');

/**
 * 解析 PDF 文件
 * @param {string} filePath - 文件路径
 * @param {string[]} extraFilterPatterns - 额外的广告过滤正则
 * @returns {Promise<string>} 纯文本内容
 */
async function parsePdf(filePath, extraFilterPatterns = []) {
  const data = fs.readFileSync(filePath);
  const result = await pdfParse(data);
  return filterAds(result.text, extraFilterPatterns);
}

module.exports = { parsePdf };
