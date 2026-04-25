<template>
  <div class="card-container">
    <div class="page-header">
      <h2>流程图</h2>
      <el-button type="primary" @click="createNew">
        <el-icon><Plus /></el-icon> 新建流程图
      </el-button>
    </div>

    <el-row :gutter="16">
      <el-col :span="6" v-for="item in list" :key="item.id">
        <el-card class="doc-card" shadow="hover">
          <div class="doc-preview" @click="$router.push(`/flowchart/${item.id}`)">
            <el-icon size="48" color="#409EFF"><Share /></el-icon>
          </div>
          <div class="doc-info">
            <div class="doc-title">{{ item.title }}</div>
            <div class="doc-time">{{ formatTime(item.updatedAt) }}</div>
          </div>
          <div class="doc-actions">
            <el-button size="small" text @click="$router.push(`/flowchart/${item.id}`)">编辑</el-button>
            <el-button size="small" text type="danger" @click="handleDelete(item)">删除</el-button>
          </div>
        </el-card>
      </el-col>

      <el-col :span="6">
        <el-card class="doc-card add-card" shadow="hover" @click="createNew">
          <div class="add-icon">
            <el-icon size="48" color="#c0c4cc"><Plus /></el-icon>
            <p>新建流程图</p>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-empty v-if="!list.length && !loading" description="暂无流程图，点击新建开始创作" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { flowchartAPI } from '../../api/documents'
import { ElMessage, ElMessageBox } from 'element-plus'

const router = useRouter()
const list = ref([])
const loading = ref(false)

function formatTime(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('zh-CN')
}

async function loadList() {
  loading.value = true
  try {
    const res = await flowchartAPI.list()
    list.value = res.data || []
  } catch {
    list.value = []
  } finally {
    loading.value = false
  }
}

async function createNew() {
  try {
    const res = await flowchartAPI.create({ title: '未命名流程图', content: '{}' })
    router.push(`/flowchart/${res.data?.id}`)
  } catch {
    router.push('/flowchart/new')
  }
}

async function handleDelete(item) {
  await ElMessageBox.confirm(`确定删除"${item.title}"？`, '提示', { type: 'warning' })
  await flowchartAPI.delete(item.id)
  ElMessage.success('已删除')
  loadList()
}

onMounted(loadList)
</script>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-header h2 {
  font-size: 20px;
  font-weight: 600;
}

.doc-card {
  margin-bottom: 16px;
  cursor: pointer;
  transition: transform 0.2s;
}

.doc-card:hover {
  transform: translateY(-4px);
}

.doc-preview {
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  border-radius: 8px;
  margin-bottom: 12px;
}

.add-card {
  height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.add-icon {
  text-align: center;
  color: #909399;
}

.add-icon p {
  margin-top: 8px;
  font-size: 14px;
}

.doc-info {
  margin-bottom: 8px;
}

.doc-title {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.doc-time {
  font-size: 12px;
  color: #909399;
}

.doc-actions {
  display: flex;
  gap: 4px;
}
</style>
