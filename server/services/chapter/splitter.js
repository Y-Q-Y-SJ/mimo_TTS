// 匹配行首的章节标题，排除嵌入正文中的 "第X篇" 等
// 要求 "第" 前面是行首或空白字符，且后面紧跟数字/中文数字+章/节/回
const DEFAULT_CHAPTER_PATTERN = /(?:^|\n)\s*(第[\d一二三四五六七八九十百千]+[章节回]\s*[^\n]*)/g;

/**
 * 按章节标题拆分文本
 * @param {string} text - 书籍全文
 * @param {string} customPattern - 用户自定义正则字符串
 * @returns {{ index: number, title: string, content: string, charCount: number }[]}
 */
function splitChapters(text, customPattern = '') {
  let pattern;
  if (customPattern) {
    try {
      pattern = new RegExp(customPattern, 'g');
    } catch {
      pattern = DEFAULT_CHAPTER_PATTERN;
    }
  } else {
    pattern = DEFAULT_CHAPTER_PATTERN;
  }

  const matches = [];
  let match;
  while ((match = pattern.exec(text)) !== null) {
    // 使用捕获组的内容作为标题
    const title = (match[1] || match[0]).trim();
    // index 是匹配到的位置，需要加上捕获组前导字符的偏移
    const fullMatch = match[0];
    const offset = fullMatch.indexOf(match[1]);
    const pos = match.index + (offset >= 0 ? offset : 0);
    matches.push({ title, index: pos });
  }

  // 没有匹配到章节标题，按固定字数切分
  if (matches.length === 0) {
    return splitByChunkSize(text);
  }

  const chapters = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const content = text.slice(start, end).trim();

    chapters.push({
      index: i + 1,
      title: matches[i].title,
      content,
      charCount: content.length,
    });
  }

  return chapters;
}

/**
 * 按固定字数切分
 */
function splitByChunkSize(text, chunkSize = 5000) {
  const chapters = [];
  let index = 0;
  let offset = 0;

  while (offset < text.length) {
    let end = Math.min(offset + chunkSize, text.length);

    // 尽量在句号处截断
    if (end < text.length) {
      const slice = text.slice(offset, end);
      const lastPeriod = Math.max(
        slice.lastIndexOf('。'),
        slice.lastIndexOf('！'),
        slice.lastIndexOf('？'),
        slice.lastIndexOf('\n'),
      );
      if (lastPeriod > chunkSize * 0.5) {
        end = offset + lastPeriod + 1;
      }
    }

    const content = text.slice(offset, end).trim();
    if (content) {
      index++;
      chapters.push({
        index,
        title: `第${index}段`,
        content,
        charCount: content.length,
      });
    }
    offset = end;
  }

  return chapters;
}

module.exports = { splitChapters };
