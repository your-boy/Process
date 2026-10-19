import { describe, expect, it } from 'vitest'
import { createFlowTemplateDocument } from '../../src/editor/modes/templateFlowchart'

describe('flowchart sample template', () => {
  const document = createFlowTemplateDocument()

  it('creates a flowchart document with its own title', () => {
    expect(document.mode).toBe('flowchart')
    expect(document.title).toBe('示例：登录流程')
    expect(document.content.nodes.length).toBeGreaterThan(0)
    expect(document.content.edges.length).toBeGreaterThan(0)
  })

  it('uses unique node ids and wires every edge to existing nodes', () => {
    const ids = new Set(document.content.nodes.map(node => node.id))
    expect(ids.size).toBe(document.content.nodes.length)

    for (const edge of document.content.edges) {
      expect(ids.has(edge.fromNodeId)).toBe(true)
      expect(ids.has(edge.toNodeId)).toBe(true)
      expect(edge.layerId).toBe('layer-edges')
      expect(edge.style.route).toBe('orthogonal')
    }
  })

  it('keeps every node inside the default page', () => {
    const { width, height } = document.content.page
    for (const node of document.content.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(0)
      expect(node.y).toBeGreaterThanOrEqual(0)
      expect(node.x + node.width).toBeLessThanOrEqual(width)
      expect(node.y + node.height).toBeLessThanOrEqual(height)
    }
  })

  it('has exactly one start and one end terminator', () => {
    const terminators = document.content.nodes.filter(node => node.kind === 'terminator')
    expect(terminators).toHaveLength(2)
  })
})
