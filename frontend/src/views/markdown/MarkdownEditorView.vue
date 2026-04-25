<template>
  <div class="editor-page">
    <div class="editor-toolbar">
      <div class="toolbar-left">
        <el-button text @click="$router.push('/markdown')">
          <el-icon><ArrowLeft /></el-icon> 返回
        </el-button>
        <el-input
          v-model="title"
          class="title-input"
          placeholder="文档标题"
          @change="autoSave"
        />
      </div>
      <div class="toolbar-right">
        <el-dropdown @command="handleExport">
          <el-button type="primary">
            导出 <el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="md">导出 Markdown (.md)</el-dropdown-item>
              <el-dropdown-item command="html">导出 HTML</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button type="success" :loading="saving" @click="save">
          <el-icon><Check /></el-icon> 保存
        </el-button>
      </div>
    </div>

    <div class="editor-body">
      <MdEditor
        v-model="content"
        :theme="'light'"
        language="zh-CN"
        @onChange="autoSave"
        style="height: 100%"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { MdEditor } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'
import { markdownAPI } from '../../api/documents'
import { ElMessage } from 'element-plus'

const route = useRoute()
const router = useRouter()
const title = ref('未命名文档')
const content = ref('# 新文档\n\n开始编写...')
const saving = ref(false)
let saveTimer = null

onMounted(loadData)
onBeforeUnmount(() => { if (saveTimer) clearTimeout(saveTimer) })

async function loadData() {
  const id = route.params.id
  if (!id || id === 'new') return
  try {
    const res = await markdownAPI.get(id)
    title.value = res.data?.title || '未命名文档'
    content.value = res.data?.content || '# 新文档\n\n开始编写...'
  } catch {
    // new
  }
}

function autoSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(save, 2000)
}

async function save() {
  const id = route.params.id
  if (!id || id === 'new') return
  saving.value = true
  try {
    await markdownAPI.update(id, { title: title.value, content: content.value })
    ElMessage.success('保存成功')
  } catch {
    // handled
  } finally {
    saving.value = false
  }
}

function handleExport(format) {
  if (format === 'md') {
    const blob = new Blob([content.value], { type: 'text/markdown' })
    downloadBlob(blob, `${title.value}.md`)
  } else if (format === 'html') {
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>${title.value}</title></head>
<body><pre>${content.value}</pre></body>
</html>`
    const blob = new Blob([html], { type: 'text/html' })
    downloadBlob(blob, `${title.value}.html`)
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.editor-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.editor-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  flex-shrink: 0;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.title-input {
  width: 200px;
}

.editor-body {
  flex: 1;
  overflow: hidden;
}
</style>
