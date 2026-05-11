# 书籍转语音 — 需求文档

## 1. 项目概述

基于 Node.js 开发一个命令行工具，将书籍文件（TXT / EPUB / PDF）自动拆分为章节，并通过小米 MiMo TTS API 逐章合成为 MP3 音频文件。

## 2. 功能需求

### 2.1 书籍导入（多格式解析）

| 格式 | 解析方式 |
|------|---------|
| TXT  | 直接读取文本内容 |
| EPUB | 解压 ZIP 容器，提取 XHTML/HTML 正文，清洗 HTML 标签后提取纯文本 |
| PDF  | 使用 `pdf-parse` 提取文本 |

- 支持通过命令行参数指定书籍文件路径
- 输出统一为纯文本，供后续章节拆分使用

### 2.2 章节拆分

- **拆分策略**：基于正则/关键词匹配
  - 默认匹配模式：`第[一二三四五六七八九十百千\d]+[章节回篇集]`、`Chapter\s+\d+`、`CHAPTER\s+\d+`
  - 支持用户通过配置文件自定义正则表达式
- **未匹配到章节标题时**：按固定字数（默认 5000 字）切分为一个段落
- **每个章节**：包含章节标题（如果匹配到）+ 该章节正文内容
- **元信息**：输出章节列表 JSON（章节序号、标题、起始位置、字数统计）

### 2.3 TTS 语音合成

#### 2.3.1 API 接入

- **平台**：小米 MiMo 开放平台
- **端点**：`https://api.xiaomimimo.com/v1/chat/completions`
- **认证方式**：HTTP Header `api-key: $MIMO_API_KEY`
- **SDK 兼容**：OpenAI SDK 兼容接口（`base_url: https://api.xiaomimimo.com/v1`）
- **模型**：`mimo-v2.5-tts`（使用预置音色）

#### 2.3.2 请求格式

```json
{
  "model": "mimo-v2.5-tts",
  "messages": [
    { "role": "user", "content": "<风格指令，可选>" },
    { "role": "assistant", "content": "<待合成文本>" }
  ],
  "audio": {
    "format": "wav",
    "voice": "<音色名称>"
  }
}
```

#### 2.3.3 长文本处理（分段合成 + 音频拼接）

由于 API 对单次请求文本长度可能存在限制，长章节需要分段处理：

1. **按句子切分**：以句号（。）、问号（？）、感叹号（！）、省略号（……）为断句点
2. **每段上限**：默认 500 字/段（可配置），确保不超出 API 限制
3. **逐段调用 TTS**：每段独立发送合成请求，获取音频数据
4. **音频拼接**：使用 `fluent-ffmpeg` 将多段 PCM/WAV 音频拼接为完整章节音频
5. **错误重试**：单段合成失败时自动重试（最多 3 次），重试间隔递增

#### 2.3.4 音频输出

- **格式**：MP3（最终通过 ffmpeg 转码）
- **命名规则**：`{书籍名}/chapter_{序号:03d}_{章节标题}.mp3`
- **采样率**：24kHz（MiMo API 输出默认采样率）
- **每个章节一个 MP3 文件**

### 2.4 进度与日志

- 控制台实时展示：
  - 当前正在合成的章节/段落
  - 已完成 / 总数 进度条
  - 预估剩余时间
- 日志文件记录合成过程中的错误与重试信息

## 3. 非功能需求

### 3.1 性能

- 支持并发合成：多个段落/章节可并行请求 API（默认并发数 3，可配置）
- 控制请求速率，避免触发 API 限流

### 3.2 断点续传

- 合成过程中断后，再次运行时跳过已完成的章节，从断点继续
- 通过在输出目录生成 `progress.json` 记录已完成章节

### 3.3 配置管理

- 支持 `.env` 文件配置 API Key
- 支持 `config.json` 配置项：

```json
{
  "apiKey": "",
  "apiBaseUrl": "https://api.xiaomimimo.com/v1",
  "model": "mimo-v2.5-tts",
  "voice": "冰糖",
  "outputFormat": "mp3",
  "maxTextLength": 500,
  "chapterPattern": "",
  "fallbackChunkSize": 5000,
  "concurrency": 3,
  "maxRetries": 3,
  "outputDir": "./output"
}
```

## 4. 技术选型

| 模块 | 依赖 | 用途 |
|------|------|------|
| HTTP 请求 | `openai` (npm) | 调用 MiMo TTS API（OpenAI 兼容） |
| EPUB 解析 | `epub` / `jszip` + `cheerio` | 解压并提取 EPUB 正文 |
| PDF 解析 | `pdf-parse` | 提取 PDF 文本 |
| 音频处理 | `fluent-ffmpeg` + `ffmpeg-static` | 拼接音频、WAV→MP3 转码 |
| 命令行 | `commander` | CLI 参数解析 |
| 进度条 | `ora` / `cli-progress` | 终端进度展示 |
| 环境变量 | `dotenv` | 加载 `.env` 配置 |
| 文本分句 | `@nltk/sentence-tokenizer` 或自实现 | 按标点切分长文本 |

## 5. CLI 接口设计

```bash
# 基本用法
node index.js --book ./books/novel.txt

# 指定音色和输出目录
node index.js --book ./books/novel.epub --voice 冰糖 --output ./audiobooks

# 自定义章节正则
node index.js --book ./books/novel.txt --chapter-pattern "卷[一二三四五六七八九十]+第[\\d]+章"

# 续传上次中断的任务
node index.js --book ./books/novel.txt --resume
```

## 6. 项目目录结构

```
book-tts/
├── src/
│   ├── index.js              # CLI 入口
│   ├── parser/
│   │   ├── txt-parser.js     # TXT 解析
│   │   ├── epub-parser.js    # EPUB 解析
│   │   ├── pdf-parser.js     # PDF 解析
│   │   └── index.js          # 解析器调度
│   ├── chapter/
│   │   ├── splitter.js       # 章节拆分
│   │   └── chunker.js        # 长文本分段
│   ├── tts/
│   │   ├── client.js         # MiMo TTS API 客户端
│   │   ├── synthesizer.js    # 合成调度（并发/重试/进度）
│   │   └── audio-utils.js    # 音频拼接/转码
│   └── utils/
│       ├── config.js         # 配置加载
│       ├── logger.js         # 日志
│       └── progress.js       # 断点续传进度管理
├── output/                   # 音频输出目录
├── .env.example              # 环境变量模板
├── config.json.example       # 配置文件模板
├── package.json
└── README.md
```

## 7. 流程图

```
书籍文件 (TXT/EPUB/PDF)
    │
    ▼
┌─────────────┐
│  格式解析器   │ → 统一纯文本
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  章节拆分器   │ → [Chapter 1, Chapter 2, ...]
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  文本分段器   │ → 每章拆为 ≤500字的段落
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ TTS 合成调度  │ → 并发请求 MiMo API → PCM 音频
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  音频拼接     │ → 章节内多段 PCM 合并
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ WAV → MP3    │ → 最终 MP3 文件
└─────────────┘
```

## 8. 新增需求（2026-05-11）

### 8.1 章节范围选择

解析书籍后，用户可选择仅转换部分章节：

- **UI 位置**：在 Config 配置页，章节列表上方
- **交互方式**：
  - 每章左侧有勾选框，默认全选
  - 提供范围输入框，支持格式如 `1-10, 15, 20-25`，输入后回车自动勾选对应章节
  - 提供"全选"/"全不选"/"反选"快捷按钮
- **传递方式**：`createTask` 接口新增 `chapterIndices` 参数（数组，从 0 开始的章节索引），为空则处理全部章节
- **后端处理**：`run-task.js` 根据 `chapterIndices` 过滤，仅合成指定章节

### 8.2 音频体积压缩

MP3 比特率可选，降低比特率可显著减小文件体积：

| 比特率 | 体积（相对128k） | 音质 | 适用场景 |
|--------|-----------------|------|---------|
| 64kbps | 约 50% | 语音够用 | 追求小体积 |
| 96kbps | 约 75% | 均衡 | 推荐默认 |
| 128kbps | 100% | 最佳 | 追求音质 |

- **UI 位置**：Config 配置页，新增"音频质量"下拉选择
- **传递方式**：`createTask` 接口新增 `audioBitrate` 参数（默认 `96k`）
- **后端处理**：`audio-utils.js` 的 `wavToMp3` 函数使用传入的比特率

### 8.3 合成速度优化

当前每章串行合成（等一章完成才开始下一章），速度很慢。优化方案：

- **章节级并发**：多个章节同时合成，总并发数受 `concurrency` 限制
- **全局并发池**：维护一个全局并发控制，确保所有任务的总 API 请求数不超过限制
- **预估提速**：3 章并发相比串行可提速约 3 倍（受 API 响应时间影响）

## 9. 待确认项

> 以下问题需用户确认后方可定稿：

1. **MiMo API 单次请求文本上限**：文档中未明确说明，请确认具体限制值
2. **流式输出当前状态**：文档说明流式功能暂未上线，当前是否只用非流式模式？
3. **API 并发/QPS 限制**：未知，先保守处理（每任务 3 并发）
4. **默认音色选择**：已支持多角色模式
