const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');
const os = require('os');

ffmpeg.setFfmpegPath(ffmpegPath);

/**
 * 将多个 WAV buffer 拼接为一个 WAV 文件
 * @param {Buffer[]} buffers - WAV buffer 数组
 * @param {string} outputPath - 输出文件路径
 * @returns {Promise<void>}
 */
async function concatWavBuffers(buffers, outputPath) {
  if (buffers.length === 0) throw new Error('No audio buffers to concat');
  if (buffers.length === 1) {
    fs.writeFileSync(outputPath, buffers[0]);
    return;
  }

  // 将每个 buffer 写为临时文件
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tts-'));
  const tmpFiles = [];

  try {
    for (let i = 0; i < buffers.length; i++) {
      const tmpPath = path.join(tmpDir, `part_${i}.wav`);
      fs.writeFileSync(tmpPath, buffers[i]);
      tmpFiles.push(tmpPath);
    }

    // 创建文件列表
    const listPath = path.join(tmpDir, 'list.txt');
    const listContent = tmpFiles.map(f => `file '${f.replace(/'/g, "'\\''")}'`).join('\n');
    fs.writeFileSync(listPath, listContent);

    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(listPath)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .outputOptions(['-c', 'copy'])
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });
  } finally {
    // 清理临时文件
    for (const f of tmpFiles) {
      try { fs.unlinkSync(f); } catch { /* ignore */ }
    }
    try { fs.unlinkSync(path.join(tmpDir, 'list.txt')); } catch { /* ignore */ }
    try { fs.rmdirSync(tmpDir); } catch { /* ignore */ }
  }
}

/**
 * 将 WAV 文件转码为 MP3
 * @param {string} wavPath - WAV 文件路径
 * @param {string} mp3Path - MP3 输出路径
 * @returns {Promise<void>}
 */
async function wavToMp3(wavPath, mp3Path, bitrate = '96k') {
  await new Promise((resolve, reject) => {
    ffmpeg(wavPath)
      .audioCodec('libmp3lame')
      .audioBitrate(bitrate)
      .output(mp3Path)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}

/**
 * 将多个 WAV buffer 拼接并转为 MP3
 * @param {Buffer[]} buffers - WAV buffer 数组
 * @param {string} mp3Path - MP3 输出路径
 * @returns {Promise<void>}
 */
async function concatAndConvert(buffers, mp3Path) {
  const wavPath = mp3Path.replace(/\.mp3$/, '.wav');
  await concatWavBuffers(buffers, wavPath);
  await wavToMp3(wavPath, wavPath.replace(/\.wav$/, '') + '_tmp.wav');
  // rename to mp3
  fs.renameSync(wavPath.replace(/\.wav$/, '') + '_tmp.wav', mp3Path);
}

/**
 * 拼接 WAV buffers 并输出最终 MP3
 */
async function buffersToMp3(buffers, mp3Path, bitrate = '96k') {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tts-'));
  const wavPath = path.join(tmpDir, 'merged.wav');

  try {
    await concatWavBuffers(buffers, wavPath);
    await wavToMp3(wavPath, mp3Path, bitrate);
  } finally {
    try { fs.unlinkSync(wavPath); } catch { /* ignore */ }
    try { fs.rmdirSync(tmpDir); } catch { /* ignore */ }
  }
}

module.exports = { concatWavBuffers, wavToMp3, buffersToMp3 };
