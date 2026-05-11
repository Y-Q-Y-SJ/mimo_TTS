const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./utils/config');
const logger = require('./utils/logger');
const { bookRouter } = require('./routes/book');
const { taskRouter } = require('./routes/task');
const { audioRouter } = require('./routes/audio');
const { voiceRouter } = require('./routes/voice');

const app = express();

app.use(cors());
app.use(express.json());

// API 路由
app.use('/api/books', bookRouter);
app.use('/api/tasks', taskRouter);
app.use('/api/audio', audioRouter);
app.use('/api/voices', voiceRouter);

// 静态文件服务（前端构建产物）
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('/{*path}', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(clientDist, 'index.html'), err => {
      if (err) res.status(404).json({ error: 'Not found' });
    });
  }
});

// 错误处理
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(config.port, () => {
  logger.info(`Server running on http://localhost:${config.port}`);
  logger.info(`API Key configured: ${config.mimoApiKey ? 'Yes' : 'No'}`);
});
