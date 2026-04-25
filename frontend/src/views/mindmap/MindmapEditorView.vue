<template>
  <div class="editor-page">
    <div class="editor-toolbar">
      <div class="toolbar-left">
        <el-button text @click="$router.push('/mindmap')">
          <el-icon><ArrowLeft /></el-icon> 返回
        </el-button>
        <el-input
          v-model="title"
          class="title-input"
          placeholder="未命名思维导图"
          @change="autoSave"
        />
      </div>
      <div class="toolbar-right">
        <el-tooltip content="Tab: 添加子节点 | Enter: 添加兄弟节点 | Delete: 删除节点">
          <el-button text>
            <el-icon><InfoFilled /></el-icon> 快捷键
          </el-button>
        </el-tooltip>
        <el-dropdown @command="handleExport">
          <el-button type="primary">
            导出 <el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="png">导出 PNG</el-dropdown-item>
              <el-dropdown-item command="jpg">导出 JPG</el-dropdown-item>
              <el-dropdown-item command="xmind">导出 XMind</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button type="success" :loading="saving" @click="save">
          <el-icon><Check /></el-icon> 保存
        </el-button>
      </div>
    </div>

    <div ref="containerRef" class="mindmap-container"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MindElixir from 'mind-elixir'
import { mindmapAPI } from '../../api/documents'
import { ElMessage } from 'element-plus'
import html2canvas from 'html2canvas'

const route = useRoute()
const router = useRouter()
const containerRef = ref(null)
const title = ref('未命名思维导图')
const saving = ref(false)
let mind = null
let saveTimer = null

const defaultData = MindElixir.new('新主题')

onMounted(() => {
  initMindmap()
  loadData()
})

onBeforeUnmount(() => {
  if (saveTimer) clearTimeout(saveTimer)
})

function initMindmap() {
  const options = {
    el: containerRef.value,
    direction: MindElixir.SIDE,
    draggable: true,
    contextMenu: true,
    toolBar: true,
    nodeMenu: true,
    keypress: true,
    locale: 'zh_CN',
    overflowHidden: false,
    primaryLinkStyle: 2,
    primaryNodeHorizontalGap: 65,
    primaryNodeVerticalGap: 25
  }
  mind = new MindElixir(options)
  mind.init(defaultData)
  mind.bus.addListener('operation', autoSave)
}

async function loadData() {
  const id = route.params.id
  if (!id || id === 'new') return
  try {
    const res = await mindmapAPI.get(id)
    title.value = res.data?.title || '未命名思维导图'
    const content = JSON.parse(res.data?.content || 'null')
    if (content) mind.refresh(content)
  } catch {
    // new document
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
    const content = JSON.stringify(mind.getData())
    await mindmapAPI.update(id, { title: title.value, content })
    ElMessage.success('保存成功')
  } catch {
    // handled
  } finally {
    saving.value = false
  }
}

async function handleExport(format) {
  if (format === 'png' || format === 'jpg') {
    const canvas = await html2canvas(containerRef.value, {
      backgroundColor: '#ffffff',
      scale: 2
    })
    const mimeType = format === 'png' ? 'image/png' : 'image/jpeg'
    const url = canvas.toDataURL(mimeType)
    downloadFile(url, `${title.value}.${format}`)
  } else if (format === 'xmind') {
    exportXMind()
  }
}

function exportXMind() {
  const data = mind.getData()
  const xmindContent = generateXMindXml(data)
  const blob = new Blob([xmindContent], { type: 'application/xml' })
  const url = URL.createObjectURL(blob)
  downloadFile(url, `${title.value}.xmind`)
  URL.revokeObjectURL(url)
}

function generateXMindXml(data) {
  function nodeToXml(node, depth = 0) {
    const indent = '  '.repeat(depth)
    let xml = `${indent}<topic id="${node.id}">\n`
    xml += `${indent}  <title>${escapeXml(node.topic)}</title>\n`
    if (node.children && node.children.length > 0) {
      xml += `${indent}  <children>\n`
      for (const child of node.children) {
        xml += nodeToXml(child, depth + 2)
      }
      xml += `${indent}  </children>\n`
    }
    xml += `${indent}</topic>\n`
    return xml
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<xmap-content xmlns="urn:xmind:xmap:xmlns:content:2.0">
  <sheet>
    <title>${escapeXml(data.nodeData?.topic || title.value)}</title>
    ${nodeToXml(data.nodeData)}
  </sheet>
</xmap-content>`
}

function escapeXml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function downloadFile(url, filename) {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
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

.mindmap-container {
  flex: 1;
  overflow: hidden;
}
</style>
