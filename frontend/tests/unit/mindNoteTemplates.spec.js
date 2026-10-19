import { describe, expect, it } from 'vitest'
import {
  MIND_NOTE_TEMPLATE_IDS,
  createMindNoteTemplateDocument,
  isMindNoteTemplate
} from '../../src/editor/modes/mindNoteTemplates'

describe('mind note templates', () => {
  it('注册了两个内置模板', () => {
    expect(MIND_NOTE_TEMPLATE_IDS).toHaveLength(2)
    expect(isMindNoteTemplate('template-note-meeting')).toBe(true)
    expect(isMindNoteTemplate('template-note-retro')).toBe(true)
    expect(isMindNoteTemplate('template-note-unknown')).toBe(false)
  })

  it('会议纪要模板：主题结构完整，笔记块挂在存在的主题上', () => {
    const document = createMindNoteTemplateDocument('template-note-meeting')
    expect(document.mode).toBe('mind-note')
    expect(document.title).toBe('会议纪要')

    const nodeIds = new Set(document.content.nodes.map(node => node.id))
    expect(document.content.nodes.length).toBeGreaterThan(5)
    expect(document.content.textBlocks.length).toBeGreaterThan(3)

    document.content.textBlocks.forEach(block => {
      expect(nodeIds.has(block.nodeId)).toBe(true)
      expect(block.html).toContain('<')
    })
  })

  it('项目复盘模板：包含根因与行动项', () => {
    const document = createMindNoteTemplateDocument('template-note-retro')
    const texts = document.content.nodes.map(node => node.text)
    expect(texts).toContain('根因分析')
    expect(texts).toContain('下一步行动')

    const html = document.content.textBlocks.map(block => block.html).join('')
    expect(html).toMatch(/taskList|根因|流程/)
  })

  it('未知模板返回 null', () => {
    expect(createMindNoteTemplateDocument('template-note-unknown')).toBeNull()
  })
})
