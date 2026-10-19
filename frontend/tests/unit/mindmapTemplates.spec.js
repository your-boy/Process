import { describe, expect, it } from 'vitest'
import {
  MINDMAP_TEMPLATE_IDS,
  createMindmapTemplateDocument,
  isMindmapTemplate
} from '../../src/editor/modes/mindmapTemplates'

describe('mind map templates', () => {
  it('registers the built-in templates', () => {
    expect(MINDMAP_TEMPLATE_IDS.length).toBeGreaterThanOrEqual(5)
    MINDMAP_TEMPLATE_IDS.forEach(id => {
      expect(isMindmapTemplate(id)).toBe(true)
    })
    expect(isMindmapTemplate('template-mind-unknown')).toBe(false)
  })

  it('builds a valid tree for every template', () => {
    MINDMAP_TEMPLATE_IDS.forEach(id => {
      const document = createMindmapTemplateDocument(id)
      expect(document).toBeTruthy()
      expect(document.mode).toBe('mindmap')
      expect(document.title).toBeTruthy()

      const nodes = document.content.nodes
      expect(nodes.length).toBeGreaterThan(5)

      const roots = nodes.filter(node => !node.parentId)
      expect(roots).toHaveLength(1)

      const ids = new Set(nodes.map(node => node.id))
      nodes.filter(node => node.parentId).forEach(node => {
        expect(ids.has(node.parentId)).toBe(true)
      })

      expect(document.content.edges).toHaveLength(nodes.length - 1)
    })
  })
})
