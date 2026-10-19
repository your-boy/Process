import { createApp } from 'vue'
import App from './App.vue'
import './styles/tokens.css'

// 构建标记：用来快速判断「当前页面是不是最新代码」
const BUILD_STAMP = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : new Date().toISOString()
if (typeof document !== 'undefined') {
  document.documentElement.dataset.build = BUILD_STAMP
}
console.info(`[Process] build ${BUILD_STAMP}`)

const app = createApp(App)
app.config.errorHandler = (error, instance, info) => {
  console.error('[Process] unhandled Vue error', { error, info })
}
app.mount('#app')
