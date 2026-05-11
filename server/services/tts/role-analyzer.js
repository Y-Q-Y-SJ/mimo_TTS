/**
 * 分析文本中的旁白和对话段落
 * 提取引号内的文本为 dialogue，其余为 narration
 */

const QUOTE_PAIRS = [
  ['"', '"'],       // 英文双引号
  ["'", "'"],       // 英文单引号
  ['“', '”'], // 中文双引号 "" ""
  ['‘', '’'], // 中文单引号 '' ''
  ['《', '》'], // 书名号《》（有时用于对话）
];

/**
 * 分析文本，返回分段列表
 * @param {string} text - 章节文本
 * @returns {{ type: 'narration'|'dialogue', content: string, voiceIndex: number }[]}
 */
function analyzeRoles(text) {
  const segments = [];
  let remaining = text;
  let dialogueVoiceIndex = 0;
  const dialogueVoices = new Set();

  while (remaining.length > 0) {
    let earliestQuote = -1;
    let quoteEnd = '';

    // 找到最早的引号
    for (const [open, close] of QUOTE_PAIRS) {
      const idx = remaining.indexOf(open);
      if (idx !== -1 && (earliestQuote === -1 || idx < earliestQuote)) {
        earliestQuote = idx;
        quoteEnd = close;
      }
    }

    if (earliestQuote === -1) {
      // 剩余全是旁白
      if (remaining.trim()) {
        segments.push({ type: 'narration', content: remaining.trim(), voiceIndex: 0 });
      }
      break;
    }

    // 引号前的旁白
    const narrationPart = remaining.slice(0, earliestQuote).trim();
    if (narrationPart) {
      segments.push({ type: 'narration', content: narrationPart, voiceIndex: 0 });
    }

    // 找到配对的结束引号
    const afterOpen = remaining.slice(earliestQuote + 1);
    const endIndex = afterOpen.indexOf(quoteEnd);

    if (endIndex === -1) {
      // 没有找到配对的结束引号，剩余全部作为对话
      const dialogueContent = afterOpen.trim();
      if (dialogueContent) {
        segments.push({
          type: 'dialogue',
          content: dialogueContent,
          voiceIndex: getDialogueVoiceIndex(dialogueContent, dialogueVoices, dialogueVoiceIndex),
        });
      }
      break;
    }

    const dialogueContent = afterOpen.slice(0, endIndex).trim();
    if (dialogueContent) {
      const vi = getDialogueVoiceIndex(dialogueContent, dialogueVoices, dialogueVoiceIndex);
      segments.push({ type: 'dialogue', content: dialogueContent, voiceIndex: vi });
      if (vi >= dialogueVoiceIndex) {
        dialogueVoiceIndex = vi + 1;
      }
    }

    remaining = afterOpen.slice(endIndex + 1);
  }

  return mergeAdjacentSegments(segments);
}

/**
 * 根据对话特征分配音色索引（简单启发式：不同说话人用不同音色）
 */
function getDialogueVoiceIndex(content, knownVoices, voiceIndex) {
  // 简单策略：每段新对话轮流分配音色
  // 高级方案可加 NLP 角色识别，这里用轮转
  const vi = (voiceIndex % 5) + 1; // voiceIndex 1-5，0 是旁白
  return vi;
}

/**
 * 合并相邻的同类型段落
 */
function mergeAdjacentSegments(segments) {
  if (segments.length <= 1) return segments;

  const merged = [segments[0]];
  for (let i = 1; i < segments.length; i++) {
    const last = merged[merged.length - 1];
    const curr = segments[i];
    if (last.type === curr.type && last.voiceIndex === curr.voiceIndex) {
      last.content += '\n' + curr.content;
    } else {
      merged.push(curr);
    }
  }
  return merged;
}

module.exports = { analyzeRoles };
