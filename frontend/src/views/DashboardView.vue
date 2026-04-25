<template>
  <div class="card-container">
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6" v-for="stat in stats" :key="stat.label">
        <el-card class="stat-card" shadow="hover" @click="$router.push(stat.route)">
          <div class="stat-content">
            <el-icon :size="36" :color="stat.color">
              <component :is="stat.icon" />
            </el-icon>
            <div class="stat-info">
              <div class="stat-num">{{ stat.count }}</div>
              <div class="stat-label">{{ stat.label }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="recent-row">
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>最近的流程图</span>
              <el-button text @click="$router.push('/flowchart')">查看全部</el-button>
            </div>
          </template>
          <el-empty v-if="!recentFlowcharts.length" description="暂无流程图" />
          <el-list v-else>
            <div
              v-for="item in recentFlowcharts"
              :key="item.id"
              class="recent-item"
              @click="$router.push(`/flowchart/${item.id}`)"
            >
              <el-icon><Share /></el-icon>
              <span class="item-title">{{ item.title }}</span>
              <span class="item-time">{{ formatTime(item.updatedAt) }}</span>
            </div>
          </el-list>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>最近的思维导图</span>
              <el-button text @click="$router.push('/mindmap')">查看全部</el-button>
            </div>
          </template>
          <el-empty v-if="!recentMindmaps.length" description="暂无思维导图" />
          <div v-else>
            <div
              v-for="item in recentMindmaps"
              :key="item.id"
              class="recent-item"
              @click="$router.push(`/mindmap/${item.id}`)"
            >
              <el-icon><Grid /></el-icon>
              <span class="item-title">{{ item.title }}</span>
              <span class="item-time">{{ formatTime(item.updatedAt) }}</span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { flowchartAPI, mindmapAPI, markdownAPI, notesAPI } from '../api/documents'

const stats = ref([
  { label: '流程图', icon: 'Share', color: '#409EFF', count: 0, route: '/flowchart' },
  { label: '思维导图', icon: 'Grid', color: '#67C23A', count: 0, route: '/mindmap' },
  { label: 'Markdown', icon: 'Document', color: '#E6A23C', count: 0, route: '/markdown' },
  { label: '随记', icon: 'EditPen', color: '#F56C6C', count: 0, route: '/notes' }
])

const recentFlowcharts = ref([])
const recentMindmaps = ref([])

function formatTime(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN')
}

onMounted(async () => {
  try {
    const [flowcharts, mindmaps, markdowns, notes] = await Promise.all([
      flowchartAPI.list(),
      mindmapAPI.list(),
      markdownAPI.list(),
      notesAPI.list()
    ])
    stats.value[0].count = flowcharts.data?.length || 0
    stats.value[1].count = mindmaps.data?.length || 0
    stats.value[2].count = markdowns.data?.length || 0
    stats.value[3].count = notes.data?.length || 0

    recentFlowcharts.value = (flowcharts.data || []).slice(0, 5)
    recentMindmaps.value = (mindmaps.data || []).slice(0, 5)
  } catch {
    // API not available in demo mode
  }
})
</script>

<style scoped>
.stats-row {
  margin-bottom: 24px;
}

.stat-card {
  cursor: pointer;
  transition: transform 0.2s;
}

.stat-card:hover {
  transform: translateY(-4px);
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 0;
}

.stat-num {
  font-size: 28px;
  font-weight: 700;
  color: #303133;
}

.stat-label {
  font-size: 14px;
  color: #909399;
}

.recent-row {
  margin-bottom: 24px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.recent-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  transition: color 0.2s;
}

.recent-item:last-child {
  border-bottom: none;
}

.recent-item:hover {
  color: #409EFF;
}

.item-title {
  flex: 1;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-time {
  font-size: 12px;
  color: #c0c4cc;
}
</style>
