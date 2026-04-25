<template>
  <div class="card-container">
    <div class="page-header">
      <h2>Markdown 文档</h2>
      <el-button type="primary" @click="createNew">
        <el-icon><Plus /></el-icon> 新建文档
      </el-button>
    </div>

    <el-table :data="list" v-loading="loading" stripe>
      <el-table-column label="标题" prop="title" min-width="200">
        <template #default="{ row }">
          <el-link @click="$router.push(`/markdown/${row.id}`)">{{ row.title }}</el-link>
        </template>
      </el-table-column>
      <el-table-column label="更新时间" prop="updatedAt" width="180">
        <template #default="{ row }">{{ formatTime(row.updatedAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="160" align="right">
        <template #default="{ row }">
          <el-button size="small" @click="$router.push(`/markdown/${row.id}`)">编辑</el-button>
          <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-empty v-if="!list.length && !loading" description="暂无 Markdown 文档" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { markdownAPI } from '../../api/documents'
import { ElMessage, ElMessageBox } from 'element-plus'

const router = useRouter()
const list = ref([])
const loading = ref(false)

function formatTime(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString('zh-CN')
}

async function loadList() {
  loading.value = true
  try {
    const res = await markdownAPI.list()
    list.value = res.data || []
  } catch {
    list.value = []
  } finally {
    loading.value = false
  }
}

async function createNew() {
  try {
    const res = await markdownAPI.create({ title: '未命名文档', content: '# 新文档\n\n开始编写...' })
    router.push(`/markdown/${res.data?.id}`)
  } catch {
    router.push('/markdown/new')
  }
}

async function handleDelete(row) {
  await ElMessageBox.confirm(`确定删除"${row.title}"？`, '提示', { type: 'warning' })
  await markdownAPI.delete(row.id)
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
</style>
