<template>
  <div class="config">
    <el-page-header @back="$router.push('/')" :content="`配置合成参数 — ${bookName}`" />

    <!-- 章节选择 -->
    <div class="chapter-select" v-if="chapters.length > 0">
      <div class="chapter-header">
        <h3>选择要合成的章节 ({{ selectedCount }}/{{ chapters.length }})</h3>
        <div class="chapter-actions">
          <el-button size="small" @click="selectAll">全选</el-button>
          <el-button size="small" @click="selectNone">全不选</el-button>
          <el-button size="small" @click="selectInvert">反选</el-button>
        </div>
      </div>

      <div class="range-input">
        <el-input
          v-model="rangeInput"
          placeholder="输入范围快速选择，如: 1-10, 15, 20-25"
          clearable
          @keyup.enter="applyRange"
          style="width: 400px"
        >
          <template #prepend>范围</template>
          <template #append>
            <el-button @click="applyRange">应用</el-button>
          </template>
        </el-input>
        <span class="range-hint" v-if="rangeError" style="color: #f56c6c">{{ rangeError }}</span>
      </div>

      <el-table
        :data="chapters"
        stripe
        max-height="400"
        @selection-change="handleSelectionChange"
        ref="tableRef"
        row-key="index"
        class="chapter-table"
      >
        <el-table-column type="selection" width="45" :selectable="() => true" />
        <el-table-column prop="index" label="序号" width="70" />
        <el-table-column prop="title" label="标题" show-overflow-tooltip />
        <el-table-column prop="charCount" label="字数" width="100">
          <template #default="{ row }">{{ row.charCount?.toLocaleString() }}</template>
        </el-table-column>
      </el-table>
    </div>

    <el-form :model="form" label-width="140px" class="config-form">
      <el-form-item label="语音模式">
        <el-radio-group v-model="form.mode">
          <el-radio-button value="single">单音色</el-radio-button>
          <el-radio-button value="multi">多音色（自动角色）</el-radio-button>
        </el-radio-group>
      </el-form-item>

      <!-- 音色选择 + 试听 -->
      <el-form-item label="音色" v-if="form.mode === 'single'">
        <div class="voice-list">
          <div
            v-for="v in voices"
            :key="v.id"
            class="voice-item"
            :class="{ active: form.voice === v.id }"
            @click="form.voice = v.id"
          >
            <div class="voice-info">
              <span class="voice-name">{{ v.name }}</span>
              <span class="voice-tag">{{ v.gender === 'female' ? '女' : v.gender === 'male' ? '男' : '通用' }}</span>
              <span class="voice-desc">{{ v.description }}</span>
            </div>
            <el-button
              circle
              size="small"
              :loading="playingVoice === v.id"
              @click.stop="playSample(v.id)"
            >
              <span v-if="playingVoice === v.id && !loadingVoice">■</span>
              <span v-else>▶</span>
            </el-button>
          </div>
        </div>
      </el-form-item>

      <template v-if="form.mode === 'multi'">
        <el-form-item label="旁白音色">
          <div class="voice-list compact">
            <div
              v-for="v in voices"
              :key="v.id"
              class="voice-item"
              :class="{ active: form.voiceConfig.narrator === v.id }"
              @click="form.voiceConfig.narrator = v.id"
            >
              <div class="voice-info">
                <span class="voice-name">{{ v.name }}</span>
                <span class="voice-tag">{{ v.gender === 'female' ? '女' : '男' }}</span>
              </div>
              <el-button circle size="small" :loading="playingVoice === v.id" @click.stop="playSample(v.id)">
                <span v-if="playingVoice === v.id && !loadingVoice">■</span>
                <span v-else>▶</span>
              </el-button>
            </div>
          </div>
        </el-form-item>
        <el-form-item label="对话音色池">
          <div class="voice-list compact">
            <div
              v-for="v in voices"
              :key="v.id"
              class="voice-item"
              :class="{ active: form.voiceConfig.dialogueVoices.includes(v.id) }"
              @click="toggleDialogueVoice(v.id)"
            >
              <div class="voice-info">
                <span class="voice-name">{{ v.name }}</span>
                <span class="voice-tag">{{ v.gender === 'female' ? '女' : '男' }}</span>
              </div>
              <el-button circle size="small" :loading="playingVoice === v.id" @click.stop="playSample(v.id)">
                <span v-if="playingVoice === v.id && !loadingVoice">■</span>
                <span v-else>▶</span>
              </el-button>
            </div>
          </div>
        </el-form-item>
      </template>

      <el-form-item label="音频质量">
        <el-select v-model="form.audioBitrate" style="width: 300px">
          <el-option label="64kbps — 最小体积（约减半）" value="64k" />
          <el-option label="96kbps — 均衡推荐（约减25%）" value="96k" />
          <el-option label="128kbps — 最佳音质" value="128k" />
        </el-select>
      </el-form-item>

      <el-form-item label="章节并发数">
        <el-input-number v-model="form.concurrency" :min="1" :max="10" />
        <span class="form-hint">同时合成的章节数</span>
      </el-form-item>

      <el-form-item label="每段最大字数">
        <el-input-number v-model="form.maxTextLength" :min="100" :max="3000" :step="100" />
      </el-form-item>
    </el-form>

    <div class="actions">
      <el-button @click="$router.push('/')">返回</el-button>
      <el-button type="primary" size="large" :loading="creating" @click="handleCreate">
        开始合成 ({{ selectedCount }} 章)
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, computed, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getVoices, createTask } from '../api'

const props = defineProps({
  bookId: String,
})

const route = useRoute()
const router = useRouter()

const bookName = ref(route.query.bookName || 'untitled')
const chapters = ref([])
const voices = ref([])
const creating = ref(false)
const tableRef = ref(null)
const rangeInput = ref('')
const rangeError = ref('')

const selectedRows = ref([])
const playingVoice = ref(null)
const loadingVoice = ref(false)
let audioEl = null

const selectedCount = computed(() => selectedRows.value.length)

const form = reactive({
  mode: 'single',
  voice: '冰糖',
  voiceConfig: {
    narrator: '冰糖',
    dialogueVoices: ['茉莉', '苏打', '白桦'],
  },
  audioBitrate: '96k',
  concurrency: 5,
  maxTextLength: 2000,
})

onMounted(async () => {
  if (window.history.state?.chapters) {
    try { chapters.value = JSON.parse(window.history.state.chapters) } catch { /* ignore */ }
  }

  nextTick(() => {
    if (tableRef.value && chapters.value.length > 0) {
      chapters.value.forEach(row => tableRef.value.toggleRowSelection(row, true))
    }
  })

  try {
    const { data } = await getVoices()
    voices.value = data
  } catch {
    ElMessage.error('获取音色列表失败')
  }
})

onUnmounted(() => {
  if (audioEl) { audioEl.pause(); audioEl = null }
})

function playSample(voiceId) {
  // 如果正在播放同一个音色，停止
  if (playingVoice.value === voiceId && audioEl) {
    audioEl.pause()
    audioEl = null
    playingVoice.value = null
    return
  }

  // 停止之前的
  if (audioEl) { audioEl.pause() }

  playingVoice.value = voiceId
  loadingVoice.value = true

  const url = `/api/voices/${encodeURIComponent(voiceId)}/sample`
  audioEl = new Audio(url)
  audioEl.addEventListener('canplaythrough', () => { loadingVoice.value = false }, { once: true })
  audioEl.addEventListener('ended', () => { playingVoice.value = null }, { once: true })
  audioEl.addEventListener('error', () => {
    playingVoice.value = null
    loadingVoice.value = false
    ElMessage.error('播放失败')
  }, { once: true })
  audioEl.play().catch(() => {
    playingVoice.value = null
    loadingVoice.value = false
  })
}

function toggleDialogueVoice(id) {
  const idx = form.voiceConfig.dialogueVoices.indexOf(id)
  if (idx >= 0) form.voiceConfig.dialogueVoices.splice(idx, 1)
  else form.voiceConfig.dialogueVoices.push(id)
}

function handleSelectionChange(rows) { selectedRows.value = rows }
function selectAll() { chapters.value.forEach(row => tableRef.value.toggleRowSelection(row, true)) }
function selectNone() { tableRef.value.clearSelection() }
function selectInvert() {
  const selected = new Set(selectedRows.value.map(r => r.index))
  chapters.value.forEach(row => tableRef.value.toggleRowSelection(row, !selected.has(row.index)))
}

function applyRange() {
  rangeError.value = ''
  const input = rangeInput.value.trim()
  if (!input) return
  const indices = new Set()
  const parts = input.split(/[,，]/).map(s => s.trim()).filter(Boolean)
  for (const part of parts) {
    const rangeMatch = part.match(/^(\d+)\s*[-—~]\s*(\d+)$/)
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1]), end = parseInt(rangeMatch[2])
      if (start > end || start < 1 || end > chapters.value.length) {
        rangeError.value = `范围 ${part} 无效（共 ${chapters.value.length} 章）`; return
      }
      for (let i = start; i <= end; i++) indices.add(i)
    } else if (/^\d+$/.test(part)) {
      const num = parseInt(part)
      if (num < 1 || num > chapters.value.length) {
        rangeError.value = `第 ${num} 章不存在（共 ${chapters.value.length} 章）`; return
      }
      indices.add(num)
    } else { rangeError.value = `无法识别: "${part}"`; return }
  }
  tableRef.value.clearSelection()
  chapters.value.forEach(row => { if (indices.has(row.index)) tableRef.value.toggleRowSelection(row, true) })
}

async function handleCreate() {
  if (selectedCount.value === 0) { ElMessage.warning('请至少选择一章'); return }
  creating.value = true
  try {
    const voiceConfig = form.mode === 'single' ? { voice: form.voice } : form.voiceConfig
    const chapterIndices = selectedRows.value.map(ch => ch.index - 1)
    const { data } = await createTask({
      bookId: props.bookId, bookName: bookName.value, mode: form.mode,
      voiceConfig, concurrency: form.concurrency, maxTextLength: form.maxTextLength,
      chapterIndices, audioBitrate: form.audioBitrate,
    })
    ElMessage.success(`任务已创建，合成 ${selectedCount.value} 章`)
    router.push({ name: 'Task', params: { taskId: data.taskId } })
  } catch (err) {
    ElMessage.error('创建任务失败: ' + (err.response?.data?.error || err.message))
  } finally { creating.value = false }
}
</script>

<style scoped>
.config {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.chapter-select { margin-top: 16px; }

.chapter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.chapter-header h3 { margin: 0; color: #303133; }

.range-input {
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.range-hint { font-size: 12px; }

.config-form { margin-top: 8px; }

.form-hint {
  margin-left: 12px;
  font-size: 12px;
  color: #909399;
}

.voice-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  max-width: 500px;
}

.voice-list.compact .voice-item { padding: 6px 12px; }

.voice-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 14px;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.voice-item:hover { border-color: #409eff; background: #ecf5ff; }
.voice-item.active { border-color: #409eff; background: #ecf5ff; box-shadow: 0 0 0 1px #409eff; }

.voice-info { display: flex; align-items: center; gap: 8px; }
.voice-name { font-weight: 600; color: #303133; }

.voice-tag {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 3px;
  background: #f0f2f5;
  color: #909399;
}

.voice-desc { font-size: 12px; color: #909399; }

.actions {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-top: 24px;
}
</style>
