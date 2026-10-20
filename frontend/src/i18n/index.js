import { ref } from 'vue'

const STORAGE_KEY = 'diagram-editor:locale'

import { en } from './messages/en'
import { zh } from './messages/zh'

const messages = { zh, en }

const storedLocale = typeof window !== 'undefined'
  ? window.localStorage.getItem(STORAGE_KEY)
  : ''
export const locale = ref(storedLocale === 'en' ? 'en' : 'zh')

export function setLocale(nextLocale) {
  locale.value = nextLocale === 'en' ? 'en' : 'zh'
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale.value === 'en' ? 'en' : 'zh-CN'
  }
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, locale.value)
    } catch {
      // 存储不可用时只影响当前会话
    }
  }
}

export function toggleLocale() {
  setLocale(locale.value === 'zh' ? 'en' : 'zh')
}

export function t(key, params = {}) {
  const table = messages[locale.value] || messages.zh
  const template = table[key] || messages.zh[key] || key
  return String(template).replace(/\{(\w+)\}/g, (_, name) => (
    params[name] === undefined ? `{${name}}` : params[name]
  ))
}
