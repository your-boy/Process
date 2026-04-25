<template>
  <div class="main-layout">
    <!-- Sidebar -->
    <div class="sidebar">
      <div class="logo">
        <el-icon size="32" color="#409EFF"><Connection /></el-icon>
        <h2>Process</h2>
      </div>
      <el-menu
        :default-active="currentRoute"
        router
        background-color="#001529"
        text-color="#a6adb4"
        active-text-color="#ffffff"
        class="sidebar-menu"
      >
        <el-menu-item index="/dashboard">
          <el-icon><House /></el-icon>
          <span>首页</span>
        </el-menu-item>
        <el-menu-item index="/flowchart">
          <el-icon><Share /></el-icon>
          <span>流程图</span>
        </el-menu-item>
        <el-menu-item index="/mindmap">
          <el-icon><Grid /></el-icon>
          <span>思维导图</span>
        </el-menu-item>
        <el-menu-item index="/markdown">
          <el-icon><Document /></el-icon>
          <span>Markdown</span>
        </el-menu-item>
        <el-menu-item index="/notes">
          <el-icon><EditPen /></el-icon>
          <span>随记</span>
        </el-menu-item>
      </el-menu>

      <div class="sidebar-footer">
        <el-dropdown @command="handleCommand">
          <div class="user-info">
            <el-avatar :size="36" :src="userStore.userInfo?.avatar">
              <el-icon><User /></el-icon>
            </el-avatar>
            <span class="username">{{ userStore.userInfo?.username || '用户' }}</span>
            <el-icon><ArrowDown /></el-icon>
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="profile">
                <el-icon><User /></el-icon> 个人设置
              </el-dropdown-item>
              <el-dropdown-item command="logout" divided>
                <el-icon><SwitchButton /></el-icon> 退出登录
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <!-- Content -->
    <div class="content-area">
      <router-view />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import { ElMessageBox, ElMessage } from 'element-plus'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const currentRoute = computed(() => {
  const path = route.path
  if (path.startsWith('/flowchart')) return '/flowchart'
  if (path.startsWith('/mindmap')) return '/mindmap'
  if (path.startsWith('/markdown')) return '/markdown'
  if (path.startsWith('/notes')) return '/notes'
  return path
})

async function handleCommand(cmd) {
  if (cmd === 'profile') {
    router.push('/profile')
  } else if (cmd === 'logout') {
    await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await userStore.logout()
    ElMessage.success('已退出登录')
    router.push('/login')
  }
}
</script>

<style scoped>
.main-layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

.sidebar {
  width: 220px;
  background: #001529;
  color: #fff;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow: hidden;
}

.logo {
  padding: 20px;
  text-align: center;
  border-bottom: 1px solid #132f4c;
}

.logo h2 {
  color: #fff;
  font-size: 20px;
  margin-top: 8px;
}

.sidebar-menu {
  flex: 1;
  border-right: none;
  overflow-y: auto;
}

.sidebar-footer {
  padding: 16px;
  border-top: 1px solid #132f4c;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: #a6adb4;
  padding: 8px;
  border-radius: 8px;
  transition: background 0.2s;
}

.user-info:hover {
  background: #132f4c;
  color: #fff;
}

.username {
  flex: 1;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.content-area {
  flex: 1;
  overflow: auto;
  background: #f5f7fa;
}
</style>
