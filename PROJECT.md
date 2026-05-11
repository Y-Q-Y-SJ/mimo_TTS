# TXT转音频 (小米MiMo TTS) — 项目结构

## 项目概述
基于 Node.js + Vue 的书籍转语音 Web 应用，通过小米 MiMo TTS API 将 TXT/EPUB/PDF 书籍拆分为章节并合成为 MP3 音频。

## 目录结构

```
tts/
├── server/                          # 后端服务 (Express)
│   ├── index.js                     # 服务入口，路由注册
│   ├── .env                         # 环境变量 (API Key, Port)
│   ├── .env.example                 # 环境变量模板
│   ├── package.json                 # 依赖配置
│   ├── routes/                      # API 路由
│   │   ├── book.js                  # 书籍上传与解析 (POST /api/books/upload)
│   │   ├── task.js                  # 合成任务管理 (POST /api/tasks/create, SSE 流)
│   │   ├── audio.js                 # 音频下载 (GET /api/audio/:taskId/:chapterIndex)
│   │   └── voice.js                 # 音色列表 (GET /api/voices)
│   ├── services/                    # 业务逻辑
│   │   ├── run-task.js              # 任务执行器（逐章合成）
│   │   ├── task-manager.js          # 任务状态管理 + SSE 推送
│   │   ├── parser/                  # 书籍解析
│   │   │   ├── index.js             # 解析器调度
│   │   │   ├── txt-parser.js        # TXT 解析
│   │   │   ├── epub-parser.js       # EPUB 解析
│   │   │   ├── pdf-parser.js        # PDF 解析
│   │   │   └── ad-filter.js         # 广告/无用内容过滤
│   │   ├── chapter/                 # 章节处理
│   │   │   ├── splitter.js          # 章节拆分（正则匹配章节标题）
│   │   │   └── chunker.js           # 长文本分段（按句子切分，每段≤500字）
│   │   └── tts/                     # TTS 合成
│   │       ├── client.js            # MiMo API 客户端（OpenAI SDK 兼容）
│   │       ├── synthesizer.js       # 合成调度（单音色/多音色 + 重试）
│   │       ├── audio-utils.js       # 音频拼接(WAV) + WAV→MP3 转码
│   │       ├── role-analyzer.js     # 角色分析（旁白/对话分离）
│   │       └── voice-registry.js    # 音色注册表
│   └── utils/
│       ├── config.js                # 配置加载
│       └── logger.js                # 日志
│
├── client/                          # 前端 (Vue 3 + Vite + Element Plus)
│   ├── index.html                   # HTML 入口
│   ├── package.json
│   ├── vite.config.js               # Vite 配置
│   └── src/
│       ├── main.js                  # Vue 应用入口
│       ├── App.vue                  # 根组件
│       ├── api/index.js             # API 封装 (axios)
│       ├── router/index.js          # 路由配置
│       └── views/
│           ├── Home.vue             # 首页：上传书籍、预览章节
│           ├── Config.vue           # 配置页：选择音色、模式、并发数
│           └── Task.vue             # 任务页：进度展示、音频下载
│
├── 道爷我修的就是道.txt              # 测试用小说文件 (4.5MB, 381章)
├── requirements.md                  # 需求文档
└── PROJECT.md                       # 本文件
```

## MiMo TTS API 配置

| 项目 | 值 |
|------|-----|
| Base URL | `https://api.xiaomimimo.com/v1` |
| 端点 | `POST /v1/chat/completions` |
| 模型 | `mimo-v2.5-tts` |
| 认证 | `Authorization: Bearer sk-xxx` |
| 输出格式 | `wav` (服务端转为 mp3) |

## 可用音色列表 (官方)

| 音色 ID | 名称 | 语言 | 性别 |
|---------|------|------|------|
| mimo_default | 默认 | 中文 | - |
| 冰糖 | 冰糖 | 中文 | 女 |
| 茉莉 | 茉莉 | 中文 | 女 |
| 苏打 | 苏打 | 中文 | 男 |
| 白桦 | 白桦 | 中文 | 男 |
| Mia | Mia | 英文 | 女 |
| Chloe | Chloe | 英文 | 女 |
| Milo | Milo | 英文 | 男 |
| Dean | Dean | 英文 | 男 |

## API 请求格式

```json
{
  "model": "mimo-v2.5-tts",
  "messages": [
    { "role": "user", "content": "风格指令（可选）" },
    { "role": "assistant", "content": "待合成的文本" }
  ],
  "audio": { "format": "wav", "voice": "冰糖" }
}
```

## 启动方式

```bash
# 后端
cd server && npm start

# 前端开发
cd client && npm run dev

# 前端构建
cd client && npm run build
```
