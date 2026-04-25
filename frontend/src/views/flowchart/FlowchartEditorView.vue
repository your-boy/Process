<template>
  <div class="editor-page">
    <!-- Toolbar -->
    <div class="editor-toolbar">
      <div class="toolbar-left">
        <el-button text @click="$router.push('/flowchart')">
          <el-icon><ArrowLeft /></el-icon> 返回
        </el-button>
        <el-input
          v-model="title"
          class="title-input"
          placeholder="未命名流程图"
          @change="autoSave"
        />
      </div>
      <div class="toolbar-right">
        <el-button-group>
          <el-button @click="graph?.undo()" title="撤销">
            <el-icon><RefreshLeft /></el-icon>
          </el-button>
          <el-button @click="graph?.redo()" title="重做">
            <el-icon><RefreshRight /></el-icon>
          </el-button>
        </el-button-group>
        <el-button-group>
          <el-button @click="addNode('rect')" title="矩形">
            <el-icon><Postcard /></el-icon>
          </el-button>
          <el-button @click="addNode('circle')" title="圆形">
            <el-icon><Medal /></el-icon>
          </el-button>
          <el-button @click="addNode('diamond')" title="菱形">
            <el-icon><Star /></el-icon>
          </el-button>
        </el-button-group>
        <el-dropdown @command="handleExport">
          <el-button type="primary">
            导出 <el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="png">导出 PNG</el-dropdown-item>
              <el-dropdown-item command="jpg">导出 JPG</el-dropdown-item>
              <el-dropdown-item command="svg">导出 SVG</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button type="success" :loading="saving" @click="save">
          <el-icon><Check /></el-icon> 保存
        </el-button>
      </div>
    </div>

    <!-- Canvas -->
    <div ref="containerRef" class="graph-container"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Graph } from '@antv/x6'
import { History } from '@antv/x6-plugin-history'
import { Snapline } from '@antv/x6-plugin-snapline'
import { Clipboard } from '@antv/x6-plugin-clipboard'
import { Selection } from '@antv/x6-plugin-selection'
import { flowchartAPI } from '../../api/documents'
import { ElMessage } from 'element-plus'

const route = useRoute()
const router = useRouter()
const containerRef = ref(null)
const title = ref('未命名流程图')
const saving = ref(false)
let graph = null
let saveTimer = null

onMounted(() => {
  initGraph()
  loadData()
})

onBeforeUnmount(() => {
  graph?.dispose()
  if (saveTimer) clearTimeout(saveTimer)
})

function initGraph() {
  graph = new Graph({
    container: containerRef.value,
    width: containerRef.value.clientWidth,
    height: containerRef.value.clientHeight,
    background: { color: '#ffffff' },
    grid: { visible: true, size: 10 },
    connecting: {
      router: 'manhattan',
      connector: { name: 'rounded', args: { radius: 8 } },
      anchor: 'center',
      connectionPoint: 'anchor',
      allowBlank: false,
      snap: { radius: 20 },
      createEdge() {
        return graph.createEdge({
          attrs: {
            line: {
              stroke: '#5F95FF',
              strokeWidth: 1.5,
              targetMarker: { name: 'block', width: 12, height: 8 }
            }
          }
        })
      }
    },
    highlighting: {
      magnetAdsorbed: {
        name: 'stroke',
        args: { attrs: { fill: '#fff', stroke: '#5F95FF' } }
      }
    },
    mousewheel: { enabled: true, zoomAtMousePosition: true, modifiers: 'ctrl' },
    panning: { enabled: true, modifiers: 'alt' }
  })

  graph.use(new History({ enabled: true }))
  graph.use(new Snapline({ enabled: true }))
  graph.use(new Clipboard({ enabled: true }))
  graph.use(new Selection({ enabled: true, showNodeSelectionBox: true }))

  graph.on('node:changed', autoSave)
  graph.on('edge:changed', autoSave)
}

async function loadData() {
  const id = route.params.id
  if (!id || id === 'new') return
  try {
    const res = await flowchartAPI.get(id)
    title.value = res.data?.title || '未命名流程图'
    const content = JSON.parse(res.data?.content || '{}')
    if (content.cells) graph.fromJSON(content)
  } catch {
    // new document
  }
}

function addNode(type) {
  const shapes = {
    rect: { width: 120, height: 50, shape: 'rect', label: '步骤', attrs: { body: { rx: 4, ry: 4 } } },
    circle: { width: 80, height: 80, shape: 'ellipse', label: '开始/结束' },
    diamond: { width: 120, height: 60, shape: 'polygon', label: '判断', attrs: { body: { refPoints: '0,10 10,0 20,10 10,20' } } }
  }
  const config = shapes[type] || shapes.rect
  graph.addNode({
    x: 100 + Math.random() * 200,
    y: 100 + Math.random() * 200,
    ...config,
    attrs: {
      ...config.attrs,
      body: { ...(config.attrs?.body || {}), fill: '#EFF4FF', stroke: '#5F95FF', strokeWidth: 1.5 },
      label: { text: config.label, fill: '#333', fontSize: 13 }
    }
  })
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
    const content = JSON.stringify(graph.toJSON())
    await flowchartAPI.update(id, { title: title.value, content })
    ElMessage.success('保存成功')
  } catch {
    // handled
  } finally {
    saving.value = false
  }
}

async function handleExport(format) {
  if (format === 'png') {
    graph.toDataURL({ type: 'image/png' }).then(url => downloadFile(url, `${title.value}.png`))
  } else if (format === 'jpg') {
    graph.toDataURL({ type: 'image/jpeg', backgroundColor: '#fff' }).then(url => downloadFile(url, `${title.value}.jpg`))
  } else if (format === 'svg') {
    graph.toSVG(svg => {
      const blob = new Blob([svg], { type: 'image/svg+xml' })
      const url = URL.createObjectURL(blob)
      downloadFile(url, `${title.value}.svg`)
    })
  }
}

function downloadFile(url, filename) {
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
  gap: 12px;
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

.graph-container {
  flex: 1;
  overflow: hidden;
  background: #f5f5f5;
}
</style>
