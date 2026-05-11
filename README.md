# TTS 有声书合成服务器

基于小米 MiMo TTS API 的有声书生成 Web 应用。上传 TXT / EPUB / PDF 电子书，自动分章后合成为 MP3 音频。

## 功能特性

- 支持 TXT / EPUB / PDF 格式电子书上传与解析
- 自动识别中文章节标题（如"第一章"）进行章节分割
- 自动过滤网文广告行
- **章节选择**：勾选或输入范围（如 `1-10, 15, 20-25`）只转换部分章节
- **单声线合成**：同一声音朗读整章
- **多声线合成**：自动识别对话与旁白，为不同角色分配不同声音
- **音色试听**：每种音色提供试听样本，点击即可试听
- **音频压缩**：可选 64kbps / 96kbps / 128kbps 比特率
- **章节级并发**：多个章节同时合成，大幅提升速度
- **段内并发**：单章内多个分段同时请求 API
- SSE 实时推送合成进度
- 断点续传：中断后可恢复未完成的任务

## 环境要求

- Node.js 18+
- npm
- ffmpeg（已通过 `ffmpeg-static` 自动包含）

## 快速启动

### 1. 安装依赖

```bash
cd server && npm install
cd ../client && npm install
```

### 2. 配置环境变量

在 `server/` 目录下创建 `.env` 文件：

```
MIMO_API_KEY=你的API密钥
PORT=3000
```

| 变量 | 说明 | 默认值 |
|---|---|---|
| `MIMO_API_KEY` | 小米 MiMo API 密钥（必填） | - |
| `PORT` | 服务端口 | `3000` |

### 3. 构建前端 & 启动服务

```bash
# 构建前端
cd client && npm run build

# 启动后端
cd ../server && npm start
```

启动后访问 **http://localhost:3000**。

## 使用流程

```
上传书籍 → 解析章节 → 选择章节 & 配置参数 → 开始合成 → 下载音频
```

### 1. 上传书籍

支持 TXT / EPUB / PDF，最大 100MB。可自定义章节正则和广告过滤关键词。

### 2. 选择章节

解析后进入配置页，可通过以下方式选择要合成的章节：

- **勾选框**：逐章勾选
- **范围输入**：输入如 `1-10, 15, 20-25` 快速批量选择
- **快捷按钮**：全选 / 全不选 / 反选

### 3. 配置参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| 语音模式 | 单音色 / 多音色（自动角色） | 单音色 |
| 音色 | 每个音色有试听按钮 | 冰糖 |
| 音频质量 | 64kbps / 96kbps / 128kbps | 96kbps |
| 章节并发数 | 同时合成的章节数 | 5 |
| 每段最大字数 | 单次 API 请求的文本长度 | 2000 |

### 4. 查看进度

任务页实时显示每章合成状态，支持播放和下载已完成的章节。

## 可用音色

| 音色 ID | 性别 | 语言 |
|---------|------|------|
| mimo_default | 通用 | 中文 |
| 冰糖 | 女 | 中文 |
| 茉莉 | 女 | 中文 |
| 苏打 | 男 | 中文 |
| 白桦 | 男 | 中文 |
| Mia | 女 | 英文 |
| Chloe | 女 | 英文 |
| Milo | 男 | 英文 |
| Dean | 男 | 英文 |

## 性能参考

API 处理速度约 **8-9 字/秒**，实际耗时取决于并发设置：

| 章节字数 | 并发=1 | 并发=5 |
|---------|--------|--------|
| 2000 字 | ~4.5 分钟 | ~4.5 分钟 |
| 4000 字 | ~8.5 分钟 | ~8.5 分钟 |
| 5 章 × 4000 字 | ~42 分钟 | ~8.5 分钟 |

> 单章内多段会并发请求 API（段内并发），所以单章耗时接近单段时间，与段数关系不大。

## API 接口

### 书籍上传

```
POST /api/books/upload
```

- 请求：`multipart/form-data`，字段 `book`
- 可选：`chapterPattern`（自定义章节正则）、`adFilters`（广告过滤 JSON 数组）
- 返回：`bookId`、`bookName`、`totalChapters`、`chapters`

### 创建合成任务

```
POST /api/tasks/create
```

```json
{
  "bookId": "上传返回的 bookId",
  "bookName": "书名",
  "mode": "single",
  "voiceConfig": { "voice": "冰糖" },
  "concurrency": 5,
  "maxTextLength": 2000,
  "chapterIndices": [0, 1, 2],
  "audioBitrate": "96k"
}
```

- `mode`：`single`（单音色）或 `multi`（多音色）
- `chapterIndices`：要合成的章节索引数组（0-based），为空则合成全部
- `audioBitrate`：`64k` / `96k` / `128k`
- 返回：`taskId`、`total`

### 查询任务状态

```
GET /api/tasks/:id
```

### 任务进度流（SSE）

```
GET /api/tasks/:id/stream
```

### 下载音频

```
GET /api/audio/:taskId/:chapterIndex
```

### 音色列表

```
GET /api/voices
```

### 音色试听

```
GET /api/voices/:voiceId/sample
```

返回 MP3 格式的试听音频，首次请求时自动生成并缓存。

## 项目结构

```
tts/
├── README.md
├── .gitignore
│
├── docs/
│   ├── PROJECT.md               # 项目结构说明
│   └── requirements.md          # 需求文档
│
├── test/
│   └── 道爷我修的就是道.txt       # 测试用小说
│
├── server/                      # 后端 (Express)
│   ├── index.js                 # 入口
│   ├── package.json
│   ├── .env.example             # 环境变量模板
│   ├── routes/                  # API 路由
│   │   ├── book.js              # 书籍上传
│   │   ├── task.js              # 任务创建 + SSE 进度
│   │   ├── audio.js             # 音频下载
│   │   └── voice.js             # 音色列表 + 试听
│   ├── services/                # 业务逻辑
│   │   ├── task-manager.js      # 任务状态 & 进度持久化
│   │   ├── run-task.js          # 任务执行器（章节并发）
│   │   ├── parser/              # TXT / EPUB / PDF 解析
│   │   ├── chapter/
│   │   │   ├── splitter.js      # 章节分割
│   │   │   └── chunker.js       # 文本分段
│   │   └── tts/
│   │       ├── client.js        # MiMo API 客户端
│   │       ├── synthesizer.js   # 合成调度（段内并发）
│   │       ├── audio-utils.js   # WAV 拼接 & MP3 转码
│   │       ├── role-analyzer.js # 对话 / 旁白识别
│   │       └── voice-registry.js# 音色注册表
│   └── utils/
│       ├── config.js            # 配置
│       └── logger.js            # 日志
│
└── client/                      # 前端 (Vue 3 + Element Plus)
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── views/
        │   ├── Home.vue         # 上传 & 解析
        │   ├── Config.vue       # 章节选择 & 参数配置 & 音色试听
        │   └── Task.vue         # 进度 & 下载
        ├── api/index.js         # API 封装
        └── router/index.js      # 路由配置
```

## 配置项

`utils/config.js` 中的默认值：

| 配置项 | 默认值 | 说明 |
|---|---|---|
| `maxTextLength` | `2000` | 单次 TTS 调用最大字符数 |
| `concurrency` | `5` | 章节并发数 |
| `maxRetries` | `3` | 单次 TTS 最大重试次数 |
| `audioBitrate` | `96k` | 默认 MP3 比特率 |
| `mimoBaseUrl` | `https://api.xiaomimimo.com/v1` | MiMo API 地址 |
| `mimoModel` | `mimo-v2.5-tts` | TTS 模型 |

## 注意事项

- Windows 命令行测试时，不要在 curl 中直接写中文音色名（如 `冰糖`），Windows curl 会按 GBK 编码导致乱码。请使用 `--data-binary @file.json` 或直接通过浏览器前端操作
- 音色试听样本首次生成后会缓存到 `output/voice-samples/`，后续请求直接返回缓存文件
- 任务进度保存在 `output/{taskId}/progress.json`，服务重启后不会自动恢复运行中的任务
