import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

// 开发/预览期的服务配置全部走环境变量（.env / .env.local），不写死：
//   VITE_DEV_HOST              监听地址，默认 127.0.0.1
//   VITE_DEV_PORT              端口，默认 5173
//   VITE_DEV_STRICT_PORT       端口被占用时是否直接失败，默认 true（false 才允许顺延）
//   VITE_DEV_API_PROXY_TARGET  /api 代理目标，默认 http://127.0.0.1:8080；置空则关闭代理
//   VITE_PREVIEW_PORT          npm run preview 的端口，默认 4173
//
// 默认走 /api 同源代理：浏览器只访问 dev server，跨域、IPv6、端口漂移都不会再变成
// “无法连接服务器”。将来上线由 Nginx 反代 /api 时前端无需改动
// （VITE_API_BASE_URL 留空即按同源处理）。
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const host = env.VITE_DEV_HOST || '127.0.0.1'
  const port = Number(env.VITE_DEV_PORT || 5173)
  const previewPort = Number(env.VITE_PREVIEW_PORT || 4173)
  const strictPort = env.VITE_DEV_STRICT_PORT !== 'false'
  const proxyTarget = env.VITE_DEV_API_PROXY_TARGET ?? 'http://127.0.0.1:8080'
  const proxy = proxyTarget
    ? { '/api': { target: proxyTarget, changeOrigin: false } }
    : undefined

  return {
    plugins: [vue()],
    server: { host, port, strictPort, proxy },
    preview: { host, port: previewPort, strictPort, proxy },
    build: {
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/@tiptap') || id.includes('node_modules/prosemirror')) {
              return 'tiptap'
            }
            if (id.includes('node_modules/@antv')) {
              return 'antv'
            }
            if (id.includes('node_modules/jszip')) {
              return 'jszip'
            }
          }
        }
      }
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        'uuid/v4': fileURLToPath(new URL('./src/shims/uuid-v4.js', import.meta.url))
      }
    }
  }
})
