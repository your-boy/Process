import { describe, expect, it } from 'vitest'
import {
  applyContentToActivePage,
  applyPageDataToContent,
  createEmptyPage,
  createNode,
  normalizeDocument
} from '../../src/editor/model/document'

describe('document pages', () => {
  it('migrates legacy single-page documents', () => {
    const doc = normalizeDocument({
      id: 1,
      title: 'Legacy',
      mode: 'flowchart',
      content: {
        nodes: [{ id: 'a', kind: 'process', x: 10, y: 20, width: 100, height: 50, text: 'A' }],
        edges: []
      }
    })

    expect(doc.content.pages).toHaveLength(1)
    expect(doc.content.pages[0].id).toBe('page-1')
    expect(doc.content.activePageId).toBe('page-1')
    expect(doc.content.pages[0].nodes[0].id).toBe('a')
  })

  it('does not add flowchart-only layers to Markdown pages', () => {
    const doc = normalizeDocument({
      title: 'Markdown',
      mode: 'markdown',
      content: {
        sourceText: '# Title',
        layers: [{ id: 'layer-nodes', name: 'Default layer', visible: true, locked: false, order: 0 }]
      }
    })

    expect(doc.content.layers.map(layer => layer.id)).toEqual(['layer-nodes'])
    expect(doc.content.pages[0].layers.map(layer => layer.id)).toEqual(['layer-nodes'])
  })

  it('keeps all pages and treats the active page as the root content', () => {
    const page1 = createEmptyPage({ id: 'page-1', name: 'One' })
    page1.nodes = [createNode({ id: 'n1', x: 1, y: 2, text: 'One' })]
    const page2 = createEmptyPage({ id: 'page-2', name: 'Two' })
    page2.nodes = [createNode({ id: 'n2', x: 3, y: 4, text: 'Two' })]

    const doc = normalizeDocument({
      title: 'Pages',
      mode: 'flowchart',
      content: {
        activePageId: 'page-2',
        pages: [page1, page2],
        ...page2
      }
    })

    expect(doc.content.pages).toHaveLength(2)
    expect(doc.content.pages.map(page => page.name)).toEqual(['One', 'Two'])
    expect(doc.content.nodes.map(node => node.id)).toEqual(['n2'])

    const working = { pages: doc.content.pages, activePageId: 'page-2' }
    applyPageDataToContent(working, doc.content.pages[0])
    expect(working.nodes.map(node => node.id)).toEqual(['n1'])
    expect(working.activePageId).toBe('page-2')
  })

  it('syncs live root edits back into the active page before persistence', () => {
    const page1 = createEmptyPage({ id: 'page-1', name: 'One' })
    const page2 = createEmptyPage({ id: 'page-2', name: 'Two' })
    const doc = normalizeDocument({
      title: 'Pages',
      mode: 'mindmap',
      content: {
        activePageId: 'page-2',
        pages: [page1, page2]
      }
    })

    doc.content.textBlocks = [{
      id: 'block-1',
      nodeId: 'topic-root',
      text: '活动页文本',
      width: 260,
      height: 80,
      order: 0,
      layerId: 'layer-notes'
    }]
    applyContentToActivePage(doc.content)

    expect(doc.content.pages[0].textBlocks).toHaveLength(0)
    expect(doc.content.pages[1].textBlocks[0].text).toBe('活动页文本')
  })
})
