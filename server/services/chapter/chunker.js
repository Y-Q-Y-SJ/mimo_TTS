/**
 * 将长文本按句子切分为多个段落，每段不超过 maxLen 字
 * @param {string} text - 文本内容
 * @param {number} maxLen - 每段最大字数（默认 500）
 * @returns {string[]} 分段列表
 */
function chunkText(text, maxLen = 500) {
  if (text.length <= maxLen) return [text];

  // 按句子分割（句号、问号、感叹号、省略号、换行）
  const sentences = text.split(/(?<=[。！？……\n])/);

  const chunks = [];
  let current = '';

  for (const sentence of sentences) {
    // 单句就超过 maxLen，强制按字数切割
    if (sentence.length > maxLen) {
      if (current) {
        chunks.push(current);
        current = '';
      }
      let i = 0;
      while (i < sentence.length) {
        chunks.push(sentence.slice(i, i + maxLen));
        i += maxLen;
      }
      continue;
    }

    if ((current + sentence).length > maxLen) {
      if (current) chunks.push(current);
      current = sentence;
    } else {
      current += sentence;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

module.exports = { chunkText };
