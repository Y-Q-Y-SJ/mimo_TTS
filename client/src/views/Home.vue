<template>
  <div class="home">
    <el-upload
      class="book-uploader"
      drag
      :auto-upload="false"
      :show-file-list="false"
      accept=".txt,.epub,.pdf"
      :on-change="handleFileChange"
    >
      <div v-if="!file">
        <el-icon class="el-icon--upload"><upload-filled /></el-icon>
        <div class="el-upload__text">
          将书籍文件拖到此处，或 <em>点击上传</em>
        </div>
        <div class="el-upload__tip">支持 TXT、EPUB、PDF 格式，最大 100MB</div>
      </div>
      <div v-else class="file-selected">
        <el-icon class="file-icon"><document /></el-icon>
        <div class="file-info">
          <div class="file-name">{{ file.name }}</div>
          <div class="file-size">{{ formatSize(file.size) }}</div>
        </div>
        <el-button type="link" @click.stop="clearFile">更换文件</el-button>
      </div>
    </el-upload>

    <div class="options" v-if="file">
      <el-form label-width="120px">
        <el-form-item label="章节正则">
          <el-input
            v-model="chapterPattern"
            placeholder="留空使用默认：第X章"
            clearable
          />
        </el-form-item>
        <el-form-item label="广告过滤">
          <el-select
            v-model="adFilters"
            multiple
            filterable
            allow-create
            default-first-option
            placeholder="输入关键词或正则，回车添加"
            style="width: 100%"
          >
            <el-option label="公众号" value="公众号" />
            <el-option label="微信" value="微信" />
            <el-option label="QQ群" value="QQ群" />
            <el-option label="笔趣阁" value="笔趣阁" />
            <el-option label="最快更新" value="最快更新" />
            <el-option label="请收藏" value="请收藏" />
            <el-option label="下载APP" value="下载APP" />
          </el-select>
        </el-form-item>
      </el-form>

      <div class="actions">
        <el-button type="primary" size="large" :loading="uploading" @click="handleUpload">
          解析书籍
        </el-button>
      </div>
    </div>

    <div class="chapters-preview" v-if="chapters.length > 0">
      <h3>共解析出 {{ totalChapters }} 章</h3>
      <el-table :data="chapters.slice(0, 20)" stripe max-height="400">
        <el-table-column prop="index" label="序号" width="80" />
        <el-table-column prop="title" label="标题" />
        <el-table-column prop="charCount" label="字数" width="100">
          <template #default="{ row }">{{ row.charCount?.toLocaleString() }}</template>
        </el-table-column>
      </el-table>
      <div v-if="chapters.length > 20" class="more-hint">
        ...还有 {{ chapters.length - 20 }} 章
      </div>
      <div class="actions">
        <el-button type="success" size="large" @click="goToConfig">
          配置合成参数
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { UploadFilled, Document } from '@element-plus/icons-vue'
import { uploadBook } from '../api'

const router = useRouter()

const file = ref(null)
const uploading = ref(false)
const chapterPattern = ref('')
const adFilters = ref([])
const chapters = ref([])
const totalChapters = ref(0)
const bookId = ref('')
const bookName = ref('')

function handleFileChange(uploadFile) {
  file.value = uploadFile.raw
  chapters.value = []
}

function clearFile() {
  file.value = null
  chapters.value = []
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

async function handleUpload() {
  if (!file.value) return

  uploading.value = true
  try {
    const { data } = await uploadBook(file.value, {
      chapterPattern: chapterPattern.value,
      adFilters: adFilters.value,
    })
    bookId.value = data.bookId
    bookName.value = data.bookName
    chapters.value = data.chapters
    totalChapters.value = data.totalChapters
    ElMessage.success(`解析成功，共 ${data.totalChapters} 章`)
  } catch (err) {
    ElMessage.error('解析失败: ' + (err.response?.data?.error || err.message))
  } finally {
    uploading.value = false
  }
}

function goToConfig() {
  router.push({
    name: 'Config',
    params: { bookId: bookId.value },
    query: { bookName: bookName.value, total: totalChapters.value },
    state: { chapters: JSON.stringify(chapters.value) },
  })
}
</script>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.book-uploader {
  width: 100%;
}

.book-uploader :deep(.el-upload-dragger) {
  padding: 40px;
}

.file-selected {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: center;
}

.file-icon {
  font-size: 32px;
  color: #409eff;
}

.file-info {
  text-align: left;
}

.file-name {
  font-weight: 600;
  color: #303133;
}

.file-size {
  font-size: 12px;
  color: #909399;
}

.options {
  padding: 16px 0;
}

.actions {
  text-align: center;
  margin-top: 16px;
}

.chapters-preview h3 {
  margin-bottom: 12px;
  color: #303133;
}

.more-hint {
  text-align: center;
  color: #909399;
  padding: 8px;
  font-size: 13px;
}
</style>
