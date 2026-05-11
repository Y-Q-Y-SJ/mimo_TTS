const fs = require('fs');
const { filterAds } = require('./ad-filter');

/**
 * 解析 TXT 文件
 * @param {string} filePath - 文件路径
 * @param {string[]} extraFilterPatterns - 额外的广告过滤正则
 * @returns {Promise<string>} 纯文本内容
 */
async function parseTxt(filePath, extraFilterPatterns = []) {
  const content = fs.readFileSync(filePath, 'utf-8');
  return filterAds(content, extraFilterPatterns);
}

module.exports = { parseTxt };
