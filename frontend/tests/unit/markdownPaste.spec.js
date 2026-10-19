import { describe, expect, it } from 'vitest'
import { looksLikeMarkdown, markdownToHtml } from '../../src/editor/render/markdownPaste'

describe('markdown paste · 识别', () => {
  it('普通纯文本不当作 Markdown', () => {
    expect(looksLikeMarkdown('今天开会讨论了三件事')).toBe(false)
    expect(looksLikeMarkdown('第一行\n第二行\n第三行')).toBe(false)
    expect(looksLikeMarkdown('')).toBe(false)
  })

  it('识别标题 / 列表 / 引用 / 待办 / 代码块', () => {
    expect(looksLikeMarkdown('# 周报')).toBe(true)
    expect(looksLikeMarkdown('- 完成导出修复')).toBe(true)
    expect(looksLikeMarkdown('1. 第一项')).toBe(true)
    expect(looksLikeMarkdown('> 引用一句话')).toBe(true)
    expect(looksLikeMarkdown('- [x] 已完成')).toBe(true)
    expect(looksLikeMarkdown('```js\nconst a = 1\n```')).toBe(true)
  })
})

describe('markdown paste · 转换', () => {
  it('标题转成 h1', () => {
    const html = markdownToHtml('# 项目周报')
    expect(html).toContain('<h1')
    expect(html).toContain('项目周报')
  })

  it('无序列表转成 ul/li', () => {
    const html = markdownToHtml('- 甲\n- 乙\n- 丙')
    expect(html).toContain('<ul>')
    expect((html.match(/<li>/g) || []).length).toBe(3)
  })

  it('有序列表转成 ol', () => {
    const html = markdownToHtml('1. 甲\n2. 乙')
    expect(html).toContain('<ol>')
  })

  it('嵌套列表保留层级', () => {
    const html = markdownToHtml('- 一级\n  - 二级\n    - 三级')
    expect((html.match(/<ul>/g) || []).length).toBeGreaterThanOrEqual(2)
  })

  it('过滤脚本等危险标签', () => {
    const html = markdownToHtml('- 正常\n\n<script>alert(1)</script>')
    expect(html.toLowerCase()).not.toContain('<script')
  })

  it('空字符串返回空', () => {
    expect(markdownToHtml('')).toBe('')
  })
})
