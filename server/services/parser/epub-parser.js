const fs = require('fs');
const JSZip = require('jszip');
const cheerio = require('cheerio');
const path = require('path');
const { filterAds } = require('./ad-filter');

/**
 * 解析 EPUB 文件
 * @param {string} filePath - 文件路径
 * @param {string[]} extraFilterPatterns - 额外的广告过滤正则
 * @returns {Promise<string>} 纯文本内容
 */
async function parseEpub(filePath, extraFilterPatterns = []) {
  const data = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(data);

  // 找到 OPF 文件来确定阅读顺序
  const containerXml = await zip.file('META-INF/container.xml')?.async('string');
  if (!containerXml) throw new Error('Invalid EPUB: missing container.xml');

  const $container = cheerio.load(containerXml, { xmlMode: true });
  const opfPath = $container('rootfile').attr('full-path');
  if (!opfPath) throw new Error('Invalid EPUB: missing OPF path');

  const opfDir = path.posix.dirname(opfPath);
  const opfContent = await zip.file(opfPath)?.async('string');
  if (!opfContent) throw new Error('Invalid EPUB: cannot read OPF');

  const $opf = cheerio.load(opfContent, { xmlMode: true });

  // 获取 spine 中的 item id
  const spineItems = [];
  $opf('spine itemref').each((_, el) => {
    const id = $opf(el).attr('idref');
    if (id) spineItems.push(id);
  });

  // 建立 id → href 映射
  const idToHref = {};
  $opf('manifest item').each((_, el) => {
    const id = $opf(el).attr('id');
    const href = $opf(el).attr('href');
    if (id && href) idToHref[id] = href;
  });

  // 按 spine 顺序提取文本
  const texts = [];
  for (const id of spineItems) {
    const href = idToHref[id];
    if (!href) continue;

    const contentPath = path.posix.join(opfDir, href);
    const htmlContent = await zip.file(contentPath)?.async('string');
    if (!htmlContent) continue;

    const $ = cheerio.load(htmlContent);
    // 移除 script 和 style
    $('script, style, nav').remove();
    const text = $('body').text().trim();
    if (text) texts.push(text);
  }

  const fullText = texts.join('\n\n');
  return filterAds(fullText, extraFilterPatterns);
}

module.exports = { parseEpub };
