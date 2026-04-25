<template>
  <div class="card-container">
    <div class="page-header">
      <h2>随记</h2>
      <el-button type="primary" @click="showDialog(null)">
        <el-icon><Plus /></el-icon> 新建随记
      </el-button>
    </div>

    <el-row :gutter="16">
      <el-col :span="6" v-for="note in list" :key="note.id">
        <el-card
          class="note-card"
          shadow="hover"
          :style="{ borderTop: `4px solid ${note.color || '#409EFF'}` }"
          @click="showDialog(note)"
        >
          <div class="note-title">{{ note.title }}</div>
          <div class="note-content">{{ note.content }}</div>
          <div class="note-footer">
            <span class="note-time">{{ formatTime(note.updatedAt) }}</span>
            <el-button
              size="small"
              text
              type="danger"
              @click.stop="handleDelete(note)"
            >删除</el-button>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-empty v-if="!list.length && !loading" description="暂无随记，记录你的想法" />

    <!-- Note Dialog -->
    <el-dialog
      v-model="dialogVisible"
      :title="currentNote?.id ? '编辑随记' : '新建随记'"
      width="600px"
      destroy-on-close
    >
      <el-form :model="form" label-position="top">
        <el-form-item label="标题">
          <el-input v-model="form.title" placeholder="随记标题（可选）" />
        </el-form-item>
        <el-form-item label="颜色标签">
          <el-color-picker v-model="form.color" :predefine="colors" />
        </el-form-item>
        <el-form-item label="内容">
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="8"
            placeholder="记录你的想法..."
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveNote">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { notesAPI } from '../../api/documents'
import { ElMessage, ElMessageBox } from 'element-plus'

const list = ref([])
const loading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const currentNote = ref(null)

const colors = ['#409EFF', '#67C23A', '#E6A23C', '#F56C6C', '#909399', '#9B59B6']

const form = reactive({
  title: '',
  content: '',
  color: '#409EFF'
})

function formatTime(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString('zh-CN')
}

async function loadList() {
  loading.value = true
  try {
    const res = await notesAPI.list()
    list.value = res.data || []
  } catch {
    list.value = []
  } finally {
    loading.value = false
  }
}

function showDialog(note) {
  currentNote.value = note
  if (note) {
    form.title = note.title || ''
    form.content = note.content || ''
    form.color = note.color || '#409EFF'
  } else {
    form.title = ''
    form.content = ''
    form.color = '#409EFF'
  }
  dialogVisible.value = true
}

async function saveNote() {
  if (!form.content.trim() && !form.title.trim()) {
    ElMessage.warning('请输入内容')
    return
  }
  saving.value = true
  try {
    if (currentNote.value?.id) {
      await notesAPI.update(currentNote.value.id, form)
    } else {
      await notesAPI.create(form)
    }
    ElMessage.success('保存成功')
    dialogVisible.value = false
    loadList()
  } catch {
    // handled
  } finally {
    saving.value = false
  }
}

async function handleDelete(note) {
  await ElMessageBox.confirm('确定删除此随记？', '提示', { type: 'warning' })
  await notesAPI.delete(note.id)
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

.note-card {
  margin-bottom: 16px;
  cursor: pointer;
  transition: transform 0.2s;
  min-height: 160px;
}

.note-card:hover {
  transform: translateY(-4px);
}

.note-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.note-content {
  font-size: 13px;
  color: #606266;
  line-height: 1.6;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  min-height: 60px;
}

.note-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  padding-top: 8px;
  border-top: 1px solid #f0f0f0;
}

.note-time {
  font-size: 12px;
  color: #c0c4cc;
}
</style>
