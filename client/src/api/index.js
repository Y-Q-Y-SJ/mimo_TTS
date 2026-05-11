import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

/**
 * 上传书籍
 */
export function uploadBook(file, { chapterPattern = '', adFilters = [] } = {}) {
  const formData = new FormData()
  formData.append('book', file)
  if (chapterPattern) formData.append('chapterPattern', chapterPattern)
  if (adFilters.length > 0) formData.append('adFilters', JSON.stringify(adFilters))

  return api.post('/books/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  })
}

/**
 * 获取音色列表
 */
export function getVoices() {
  return api.get('/voices')
}

/**
 * 创建合成任务
 */
export function createTask({ bookId, bookName, mode, voiceConfig, concurrency, maxTextLength, chapterIndices, audioBitrate }) {
  return api.post('/tasks/create', { bookId, bookName, mode, voiceConfig, concurrency, maxTextLength, chapterIndices, audioBitrate })
}

/**
 * 获取任务状态
 */
export function getTaskStatus(taskId) {
  return api.get(`/tasks/${taskId}`)
}

/**
 * 创建 SSE 连接获取实时进度
 */
export function createTaskStream(taskId, onMessage) {
  const eventSource = new EventSource(`/api/tasks/${taskId}/stream`)

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      onMessage(data)
    } catch {
      // ignore parse errors
    }
  }

  eventSource.onerror = () => {
    eventSource.close()
  }

  return eventSource
}

/**
 * 获取音频 URL
 */
export function getAudioUrl(taskId, chapterIndex) {
  return `/api/audio/${taskId}/${chapterIndex}`
}
