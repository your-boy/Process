import { afterEach, describe, expect, it } from 'vitest'
import { locale, setLocale, t, toggleLocale } from '../../src/i18n'
import { createDocument } from '../../src/editor/model/document'

describe('i18n', () => {
  afterEach(() => setLocale('zh'))

  it('switches between Chinese and English', () => {
    setLocale('zh')
    expect(t('editor.save')).toBe('保存')
    expect(t('editor.imported', { pages: 2, nodes: 3, edges: 1, layers: 2 })).toContain('2 页')
    expect(t('workspace.searchPlaceholder')).toBe('搜索文档标题 / 内容')
    expect(t('workspace.query')).toBe('查询')
    expect(t('workspace.reset')).toBe('重置')
    expect(t('workspace.allTypes')).toBe('全部类型')
    expect(t('workspace.titleColumn')).toBe('标题')
    expect(t('workspace.sortColumn', { column: '页数' })).toBe('按页数排序')
    expect(t('workspace.pageRange', { start: 1, end: 20, total: 31 })).toBe('1–20 / 共 31 项')

    setLocale('en')
    expect(locale.value).toBe('en')
    expect(t('editor.save')).toBe('Save')
    expect(t('editor.imported', { pages: 2, nodes: 3, edges: 1, layers: 2 })).toContain('2 pages')
    expect(t('workspace.searchPlaceholder')).toBe('Search document titles / content')
    expect(t('workspace.pageRange', { start: 1, end: 20, total: 31 })).toBe('1–20 of 31')

    toggleLocale()
    expect(locale.value).toBe('zh')
  })

  it('localizes new document titles, pages and layers', () => {
    setLocale('en')
    const doc = createDocument({ mode: 'flowchart' })
    expect(doc.title).toBe('Untitled diagram')
    expect(doc.content.pages[0].name).toBe('Page 1')
    expect(doc.content.layers.map(layer => layer.name)).toEqual(['Connections', 'Nodes', 'Notes'])
  })
})
