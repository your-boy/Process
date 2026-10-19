import baseConfig from './vite.config.js'

export default async (env) => {
  const config = typeof baseConfig === 'function' ? await baseConfig(env) : baseConfig
  return {
    ...config,
    server: {
      ...config.server,
      port: 4174,
      strictPort: true,
      hmr: false
    }
  }
}
