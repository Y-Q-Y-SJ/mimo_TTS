const AD_PATTERNS = [
  /https?:\/\/[^\s]+/i,
  /www\.[^\s]+/i,
  /[a-zA-Z0-9-]+\.(com|cn|net|org|io|cc|me|tv|xyz)/i,
  /公众号/,
  /微信/,
  /QQ群/,
  /书友群/,
  /读者群/,
  /笔趣阁/,
  /顶点小说/,
  /最快更新/,
  /请收藏/,
  /最新章节请访问/,
  /本书首发/,
  /免费阅读/,
  /下载APP/,
  /关注.*(?:获取|领取)/,
  /追更/,
  /加入.*(?:群|社区)/,
  /订阅.*(?:本书|小说)/,
  /打赏/,
  /月票/,
  /推荐票/,
  /(?:欢迎|感谢).*(?:订阅|收藏|支持)/,
  /本章未完.*(?:点击|下一页)/,
  /(?:精彩|更多).*(?:小说|内容).*(?:请|尽在)/,
];

function isAdLine(line, extraPatterns = []) {
  const trimmed = line.trim();

  // 跳过空行
  if (!trimmed) return false;

  // 保护章节标题行不被误删（即使标题中包含 "求月票" 等促销文字）
  if (/^\s*第[\d一二三四五六七八九十百千]+[章节回]/.test(line)) {
    return false;
  }

  // 检查默认广告模式
  for (const pattern of AD_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }

  // 检查用户自定义模式
  for (const pat of extraPatterns) {
    try {
      if (new RegExp(pat, 'i').test(trimmed)) return true;
    } catch {
      // 忽略无效正则
    }
  }

  // 过短且无标点的行（可能是网站署名）
  if (trimmed.length < 5 && !/[，。！？、；：""''…—]/.test(trimmed)) {
    return true;
  }

  return false;
}

/**
 * 过滤文本中的广告行
 * @param {string} text - 原始文本
 * @param {string[]} extraPatterns - 用户自定义过滤正则
 * @returns {string} 过滤后的文本
 */
function filterAds(text, extraPatterns = []) {
  const lines = text.split('\n');
  const filtered = [];

  for (const line of lines) {
    if (!isAdLine(line, extraPatterns)) {
      filtered.push(line);
    }
  }

  // 压缩连续空行为单个空行
  const result = [];
  let lastEmpty = false;
  for (const line of filtered) {
    if (line.trim() === '') {
      if (!lastEmpty) result.push('');
      lastEmpty = true;
    } else {
      result.push(line);
      lastEmpty = false;
    }
  }

  return result.join('\n');
}

module.exports = { filterAds, isAdLine };
