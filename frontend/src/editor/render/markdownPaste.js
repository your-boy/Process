import { marked } from 'marked'
import DOMPurify from 'dompurify'

// 粘贴时判断是否需要按 Markdown 解析：
// 只有出现明确的 Markdown 结构（标题/列表/引用/代码块/表格/加粗）才转换，
// 普通多行纯文本保持原样，避免误伤。
const MARKDOWN_PATTERNS = [
  /^#{1,6}\s+\S/m,          // # 标题
  /^\s*[-*+]\s+\S/m,        // - 无序列表
  /^\s*\d+[.)]\s+\S/m,      // 1. 有序列表
  /^\s*>\s+\S/m,            // > 引用
  /^```/m,                  // 代码块
  /^\s*\[[ xX]\]\s+/m,      // - [ ] 待办
  /^\s*\|.*\|\s*$/m,        // 表格
  /\*\*[^*]+\*\*/,          // 粗体
  /`[^`]+`/                 // 行内代码
]

export function looksLikeMarkdown(text = '') {
  const source = String(text || '')
  if (!source.trim()) {
    return false
  }
  return MARKDOWN_PATTERNS.some(pattern => pattern.test(source))
}

export function markdownToHtml(text = '') {
  const source = String(text || '')
  if (!source.trim()) {
    return ''
  }

  const html = marked.parse(source, {
    gfm: true,
    breaks: true,
    async: false
  })

  return DOMPurify.sanitize(html, {
    ADD_ATTR: ['target', 'rel'],
    FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed']
  })
}
