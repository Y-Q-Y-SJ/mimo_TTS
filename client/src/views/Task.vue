<template>
  <div class="task">
    <el-page-header @back="$router.push('/')" :content="`合成任务 — ${task.bookName || ''}`" />

    <div class="progress-section">
      <div class="progress-header">
        <span>总进度</span>
        <span>{{ task.done }} / {{ task.total }} 章</span>
      </div>
      <el-progress
        :percentage="task.total > 0 ? Math.round((task.done / task.total) * 100) : 0"
        :status="progressStatus"
        :stroke-width="20"
        striped
        striped-flow
      />
      <div class="status-tag">
        <el-tag :type="statusTagType">{{ statusText }}</el-tag>
        <el-tag v-if="task.failed > 0" type="danger">{{ task.failed }} 章失败</el-tag>
      </div>
    </div>

    <el-table :data="task.chapters" stripe max-height="500" class="chapter-table">
      <el-table-column prop="index" label="序号" width="70" />
      <el-table-column prop="title" label="标题" show-overflow-tooltip />
      <el-table-column prop="charCount" label="字数" width="80">
        <template #default="{ row }">{{ row.charCount?.toLocaleString() }}</template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="chapterTagType(row.status)" size="small">
            {{ chapterStatusText(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180">
        <template #default="{ row, $index }">
          <el-button
            v-if="row.status === 'done'"
            type="primary"
            size="small"
            text
            @click="playChapter($index)"
          >
            播放
          </el-button>
          <el-button
            v-if="row.status === 'done'"
            type="success"
            size="small"
            text
            @click="downloadChapter($index, row.title)"
          >
            下载
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="audio-player" v-if="currentAudio">
      <h4>正在播放: {{ currentTitle }}</h4>
      <audio
        ref="audioRef"
        :src="currentAudio"
        controls
        autoplay
        style="width: 100%"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { getTaskStatus, createTaskStream, getAudioUrl } from '../api'

const props = defineProps({
  taskId: String,
})

const route = useRoute()
const task = ref({
  bookName: '',
  status: 'pending',
  chapters: [],
  total: 0,
  done: 0,
  failed: 0,
})

const currentAudio = ref('')
const currentTitle = ref('')
const audioRef = ref(null)
let eventSource = null

const progressStatus = computed(() => {
  if (task.value.status === 'completed') return 'success'
  if (task.value.status === 'failed' || task.value.status === 'completed_with_errors') return 'exception'
  return ''
})

const statusText = computed(() => {
  const map = {
    pending: '等待中',
    running: '合成中...',
    completed: '已完成',
    completed_with_errors: '部分完成',
    failed: '失败',
  }
  return map[task.value.status] || task.value.status
})

const statusTagType = computed(() => {
  const map = {
    pending: 'info',
    running: 'warning',
    completed: 'success',
    completed_with_errors: 'warning',
    failed: 'danger',
  }
  return map[task.value.status] || 'info'
})

function chapterTagType(status) {
  const map = {
    pending: 'info',
    processing: 'warning',
    done: 'success',
    failed: 'danger',
  }
  return map[status] || 'info'
}

function chapterStatusText(status) {
  const map = {
    pending: '等待',
    processing: '合成中',
    done: '完成',
    failed: '失败',
  }
  return map[status] || status
}

function playChapter(index) {
  currentAudio.value = getAudioUrl(props.taskId, index)
  currentTitle.value = task.value.chapters[index]?.title || `第${index + 1}章`
}

function downloadChapter(index, title) {
  const url = getAudioUrl(props.taskId, index)
  const a = document.createElement('a')
  a.href = url
  a.download = `${title}.mp3`
  a.click()
}

onMounted(async () => {
  // 先获取当前状态
  try {
    const { data } = await getTaskStatus(props.taskId)
    task.value = data
  } catch {
    // ignore
  }

  // 建立 SSE 连接
  eventSource = createTaskStream(props.taskId, (data) => {
    task.value = {
      ...task.value,
      status: data.status,
      chapters: data.chapters,
      done: data.done,
      failed: data.failed,
    }
  })
})

onUnmounted(() => {
  if (eventSource) {
    eventSource.close()
  }
})
</script>

<style scoped>
.task {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.progress-section {
  padding: 16px 0;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  color: #606266;
  font-size: 14px;
}

.status-tag {
  margin-top: 12px;
  display: flex;
  gap: 8px;
}

.chapter-table {
  margin-top: 8px;
}

.audio-player {
  padding: 16px;
  background: #f5f7fa;
  border-radius: 8px;
}

.audio-player h4 {
  margin-bottom: 12px;
  color: #303133;
}
</style>
