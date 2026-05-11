const express = require('express');
const fs = require('fs');
const path = require('path');
const { getVoices } = require('../services/tts/voice-registry');
const { synthesize } = require('../services/tts/client');
const { buffersToMp3 } = require('../services/tts/audio-utils');
const config = require('../utils/config');

const router = express.Router();

// 获取可用音色列表
router.get('/', (req, res) => {
  res.json(getVoices());
});

// 获取音色试听样本
router.get('/:voiceId/sample', async (req, res) => {
  const voiceId = decodeURIComponent(req.params.voiceId);
  const voices = getVoices();
  const voice = voices.find(v => v.id === voiceId);
  if (!voice) {
    return res.status(404).json({ error: '音色不存在' });
  }

  // 检查缓存
  const sampleDir = path.join(config.outputDir, 'voice-samples');
  const samplePath = path.join(sampleDir, `${voiceId}.mp3`);
  if (fs.existsSync(samplePath)) {
    res.set('Content-Type', 'audio/mpeg');
    return res.sendFile(samplePath);
  }

  // 生成样本
  try {
    const sampleText = '你好，我是' + voice.name + '。这是一段语音试听，希望能帮助你选择合适的声音。';
    const buf = await synthesize(sampleText, { voice: voiceId });
    fs.mkdirSync(sampleDir, { recursive: true });
    await buffersToMp3([buf], samplePath, '64k');
    res.set('Content-Type', 'audio/mpeg');
    res.sendFile(samplePath);
  } catch (err) {
    res.status(500).json({ error: '生成样本失败: ' + err.message });
  }
});

module.exports = { voiceRouter: router };
