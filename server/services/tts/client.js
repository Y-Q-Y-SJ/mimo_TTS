const https = require('https');
const http = require('http');
const { URL } = require('url');
const config = require('../../utils/config');

/**
 * 调用 MiMo TTS API 合成语音（直接 HTTP 请求，确保 UTF-8 编码）
 * @param {string} text - 待合成文本
 * @param {object} options
 * @param {string} options.voice - 音色名称
 * @param {string} options.style - 风格指令（可选，放在 user 消息中）
 * @returns {Promise<Buffer>} 音频 buffer（WAV 格式）
 */
async function synthesize(text, { voice = '冰糖', style = '' } = {}) {
  const messages = [];
  if (style) {
    messages.push({ role: 'user', content: style });
  }
  messages.push({ role: 'assistant', content: text });

  const body = JSON.stringify({
    model: config.mimoModel,
    messages,
    audio: { format: 'wav', voice },
  });

  const url = new URL(`${config.mimoBaseUrl}/chat/completions`);
  const transport = url.protocol === 'https:' ? https : http;

  const responseData = await new Promise((resolve, reject) => {
    const req = transport.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Authorization': `Bearer ${config.mimoApiKey}`,
          'Content-Length': Buffer.byteLength(body, 'utf-8'),
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf-8');
          if (res.statusCode >= 400) {
            let errBody;
            try { errBody = JSON.parse(raw); } catch { errBody = { error: { message: raw } }; }
            const errMsg = errBody.error?.param || errBody.error?.message || raw;
            const err = new Error(`${res.statusCode} ${errMsg}`);
            err.status = res.statusCode;
            err.error = errBody.error;
            return reject(err);
          }
          try { resolve(JSON.parse(raw)); } catch (e) { reject(new Error('Invalid JSON response')); }
        });
      }
    );
    req.on('error', reject);
    req.write(body, 'utf-8');
    req.end();
  });

  const audioData = responseData.choices?.[0]?.message?.audio?.data;
  if (!audioData) {
    const err = new Error('No audio data returned from MiMo API');
    err.response = responseData;
    throw err;
  }

  return Buffer.from(audioData, 'base64');
}

module.exports = { synthesize };
