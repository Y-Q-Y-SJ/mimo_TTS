# 项目架构速查

> 用于快速理解各文件职责和调用关系，方便后续调整。

## 整体流程

```
用户上传书籍 → 解析文本 → 按章节拆分 → 选择章节+配置参数 → 并发合成 → 下载MP3
     Home.vue      parser/     splitter.js    Config.vue    run-task.js   Task.vue
       ↕              ↕            ↕               ↕             ↕           ↕
  POST /upload    parseBook()  splitChapters()  POST /create  synthesizer  GET /audio
```

## 目录结构与文件职责

### `server/` — 后端 (Express)

```
server/
├── index.js                      # 入口：注册路由、挂载静态文件、启动监听
├── utils/
│   ├── config.js                 # 全局配置（API Key、端口、并发数、默认参数）
│   └── logger.js                 # 简单日志（带时间戳的 console.log/warn/error）
├── routes/                       # API 路由层，只做请求分发，不含业务逻辑
│   ├── book.js                   # POST /upload — 接收文件，调用 parser+splitter，返回章节列表
│   ├── task.js                   # POST /create, GET /:id, GET /:id/stream(SSE)
│   ├── audio.js                  # GET /:taskId/:chapterIndex（单章）, GET /:taskId/zip/all（打包）
│   └── voice.js                  # GET /（音色列表）, GET /:voiceId/sample（试听缓存）
├── services/
│   ├── parser/                   # 文件解析：不同格式 → 纯文本
│   │   ├── index.js              # 按扩展名分发到对应解析器
│   │   ├── txt-parser.js         # 读取 UTF-8 文件，过滤广告行
│   │   ├── epub-parser.js        # 解压 EPUB，提取 HTML 中的文字
│   │   ├── pdf-parser.js         # 用 pdf-parse 提取 PDF 文字
│   │   └── ad-filter.js          # 网文广告行过滤（URL、公众号、QQ群等 20+ 条规则）
│   ├── chapter/
│   │   ├── splitter.js           # 章节分割：正则匹配"第X章"标题，无匹配时按字数切分
│   │   └── chunker.js            # 文本分段：按句子边界切分，每段 ≤ maxTextLength
│   ├── tts/                      # TTS 合成相关
│   │   ├── client.js             # MiMo API 客户端：直接 HTTPS 请求（非 OpenAI SDK）
│   │   ├── synthesizer.js        # 合成调度：单音色/多音色，段内并发
│   │   ├── audio-utils.js        # WAV 拼接 + MP3 转码（fluent-ffmpeg）
│   │   ├── role-analyzer.js      # 对话/旁白识别：引号内容为 dialogue，其余为 narration
│   │   └── voice-registry.js     # 音色注册表（9个预置音色）+ 多音色模式分配逻辑
│   ├── task-manager.js           # 任务生命周期管理（Map 存储 + SSE 推送 + 进度持久化）
│   └── run-task.js               # 任务执行器：章节级并发池，协调 synthesizer 完成整本书
```

### `client/` — 前端 (Vue 3 + Element Plus)

```
client/src/
├── main.js                       # 入口：挂载 Vue + ElementPlus + Router
├── App.vue                       # 根组件：顶栏标题 + router-view
├── router/index.js               # 3 个路由：/ → /config/:bookId → /task/:taskId
├── api/index.js                  # API 封装（axios）：uploadBook, createTask, getVoices, etc.
└── views/
    ├── Home.vue                  # 上传页：拖拽上传 → 解析 → 预览章节列表
    ├── Config.vue                # 配置页：章节选择（表格+范围输入）+ 音色/模式/质量/并发设置
    └── Task.vue                  # 任务页：SSE 实时进度 + 播放 + 单章下载 + 打包下载
```

## 关键模块详解

### 合成流程 (`run-task.js` → `synthesizer.js` → `client.js`)

```
runTask(taskId)
  ├── 根据 chapterIndices 过滤要合成的章节
  ├── 启动 N 个 chapterWorker（N = concurrency）
  │     └── 每个 worker 循环取章节，调用 synthesizer
  │           ├── 单音色：synthesizeSingleVoice()
  │           │     ├── chunkText() 分段
  │           │     ├── synthesizeParallel() 段内并发调 API
  │           │     └── buffersToMp3() 拼接+转码
  │           └── 多音色：synthesizeMultiVoice()
  │                 ├── analyzeRoles() 识别 dialogue/narration
  │                 ├── assignVoices() 分配音色
  │                 ├── 所有段落打散后并发调 API
  │                 └── buffersToMp3() 拼接+转码
  └── 更新任务状态（completed / completed_with_errors）
```

### MiMo API 调用 (`client.js`)

```javascript
// 请求体结构
{
  model: "mimo-v2.5-tts",
  messages: [
    { role: "user", content: "风格指令（可选）" },
    { role: "assistant", content: "要合成的文本" }
  ],
  audio: { format: "wav", voice: "冰糖" }
}

// 返回
{ choices: [{ message: { audio: { data: "base64 wav..." } } }] }
```

- 直接用 Node.js `https` 模块发送请求（不用 OpenAI SDK，避免 Windows UTF-8 编码问题）
- `style` 参数会放到 `user` 消息中控制语气/风格

### 角色识别 (`role-analyzer.js`)

- 简单启发式：引号（""、""、''、《》）内的内容标记为 `dialogue`
- 对话按轮转分配 voiceIndex（1-5），旁白固定为 0
- 相邻同类型段落会自动合并

### 任务管理 (`task-manager.js`)

- 任务存在内存 `Map` 中，同时写 `output/{taskId}/progress.json` 持久化
- SSE 客户端注册在 `sseClients` Map 中，每次状态变更推送完整状态
- 服务重启后不会自动恢复运行中的任务（只有进度文件，没有自动重启逻辑）

### 批量下载 (`audio.js` 打包接口)

- 用 `jszip` 在内存中生成 zip（不用 archiver）
- 章节按 index 排序，文件名补零：`001_第一章标题.mp3`
- 缓存：`.zip-meta` 记录已打包章节数，新增完成章节后自动重新生成

## 数据流

```
上传文件 ──multer──→ server/uploads/{uuid}.{ext}
                     server/uploads/{bookId}/chapters.json  ← 解析后的章节数据（含content）

创建任务 ──→ server/output/{taskId}/progress.json  ← 任务状态
             server/output/{taskId}/chapter_001_标题.mp3  ← 合成的音频
             server/output/{taskId}/书名.zip  ← 打包下载缓存

音色试听 ──→ server/output/voice-samples/{voiceId}.mp3  ← 首次生成后缓存
```

## 常用配置 (`config.js`)

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `MIMO_API_KEY` | - | 必填，小米 MiMo API 密钥 |
| `PORT` | 3000 | 服务端口 |
| `mimoBaseUrl` | `https://api.xiaomimimo.com/v1` | API 地址 |
| `mimoModel` | `mimo-v2.5-tts` | TTS 模型（还有 voicedesign / voiceclone） |
| `maxTextLength` | 2000 | 单次 API 请求最大字数 |
| `concurrency` | 5 | 章节并发数 / 段内并发数 |
| `maxRetries` | 3 | 单次 TTS 失败重试次数 |

## 改动指南

### 要加新音色？
→ `server/services/tts/voice-registry.js` 的 `VOICES` 数组

### 要改章节分割逻辑？
→ `server/services/chapter/splitter.js` 的 `DEFAULT_CHAPTER_PATTERN` 和 `splitChapters()`

### 要加广告过滤规则？
→ `server/services/parser/ad-filter.js` 的 `AD_PATTERNS` 数组

### 要改 API 调用方式？
→ `server/services/tts/client.js` 的 `synthesize()` 函数

### 要加新的 API 端点？
→ `server/routes/` 下新建或修改路由文件，`index.js` 中已注册 4 组路由

### 要加新页面？
→ `client/src/views/` 下新建 Vue 文件，`client/src/router/index.js` 中添加路由

### 要修改合成流程？
→ 核心在 `server/services/run-task.js`（章节并发）和 `server/services/tts/synthesizer.js`（段内并发）

### 要改前端 API 调用？
→ `client/src/api/index.js`

### 要用 voiceclone / voicedesign 模型？
→ 改 `config.mimoModel`，`client.js` 中 `voice` 字段传 base64 音频（clone）或在 `user` 消息中写音色描述（design）
