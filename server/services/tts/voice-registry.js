/**
 * MiMo 预置音色注册表
 * 来自小米 MiMo 开放平台官方文档
 * Available voices: [mimo_default, 冰糖, 茉莉, 苏打, 白桦, Mia, Chloe, Milo, Dean]
 */
const VOICES = [
  { id: 'mimo_default', name: '默认', gender: 'unisex', lang: '中文', description: '默认音色' },
  { id: '冰糖', name: '冰糖', gender: 'female', lang: '中文', description: '女声，中文' },
  { id: '茉莉', name: '茉莉', gender: 'female', lang: '中文', description: '女声，中文' },
  { id: '苏打', name: '苏打', gender: 'male', lang: '中文', description: '男声，中文' },
  { id: '白桦', name: '白桦', gender: 'male', lang: '中文', description: '男声，中文' },
  { id: 'Mia', name: 'Mia', gender: 'female', lang: '英文', description: '女声，英文' },
  { id: 'Chloe', name: 'Chloe', gender: 'female', lang: '英文', description: '女声，英文' },
  { id: 'Milo', name: 'Milo', gender: 'male', lang: '英文', description: '男声，英文' },
  { id: 'Dean', name: 'Dean', gender: 'male', lang: '英文', description: '男声，英文' },
];

/**
 * 多音色模式的默认角色分配
 */
const MULTI_VOICE_DEFAULTS = {
  narrator: '冰糖',
  dialogueVoices: ['茉莉', '苏打', '白桦', 'Chloe', 'Dean'],
};

/**
 * 获取音色列表
 */
function getVoices() {
  return VOICES;
}

/**
 * 根据角色分析结果分配音色
 * @param {import('./role-analyzer').Segment[]} segments - 角色分析结果
 * @param {object} voiceConfig - { narrator: string, dialogueVoices: string[] }
 * @returns {import('./role-analyzer').Segment[] & { voice: string }[]}
 */
function assignVoices(segments, voiceConfig = MULTI_VOICE_DEFAULTS) {
  const { narrator, dialogueVoices } = voiceConfig;
  const voices = dialogueVoices.length > 0 ? dialogueVoices : [narrator];

  return segments.map(seg => ({
    ...seg,
    voice: seg.type === 'narration' ? narrator : voices[(seg.voiceIndex - 1) % voices.length],
  }));
}

module.exports = { getVoices, assignVoices, MULTI_VOICE_DEFAULTS, VOICES };
