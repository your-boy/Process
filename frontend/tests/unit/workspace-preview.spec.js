import { describe, expect, it } from 'vitest'
import { normalizeDocument } from '../../src/editor/model/document'
import { buildWorkspacePreview, describeWorkspaceDocument } from '../../src/editor/render/workspacePreview'

describe('workspace preview', () => {
  it('reads Markdown summary text from the active preview page', () => {
    const item = {
      mode: 'markdown',
      snapshot: {
        content: {
          activePageId: 'page-2',
          pageCount: 12,
          pages: [
            { id: 'page-1', sourceText: '# 第一页' },
            { id: 'page-2', sourceText: '# 第二页标题\n\n第二页正文' }
          ]
        }
      }
    }

    expect(describeWorkspaceDocument(item)).toBe('第二页标题 / 第二页正文')
    expect(buildWorkspacePreview(item).pageCount).toBe(12)
  })

  it('preserves the server page count while normalizing a summary payload', () => {
    const snapshot = normalizeDocument({
      id: 7,
      title: 'Summary',
      mode: 'markdown',
      content: {
        activePageId: 'page-1',
        pageCount: 17,
        pages: [{ id: 'page-1', sourceText: '# 内容' }]
      }
    })

    expect(snapshot.content.pageCount).toBe(17)
    expect(buildWorkspacePreview({ mode: 'markdown', snapshot }).pageCount).toBe(17)
  })

  it('reads diagram labels from the active preview page instead of the root object', () => {
    const item = {
      mode: 'mindmap',
      snapshot: {
        content: {
          activePageId: 'page-1',
          pageCount: 2,
          pages: [
            {
              id: 'page-1',
              nodes: [{ id: 'a', text: '核心主题', x: 0, y: 0, width: 160, height: 60 }],
              edges: [],
              textBlocks: []
            },
            {
              id: 'page-2',
              nodes: [{ id: 'b', text: '第二页主题', x: 0, y: 0, width: 160, height: 60 }],
              edges: [],
              textBlocks: []
            }
          ]
        }
      }
    }

    expect(describeWorkspaceDocument(item)).toBe('核心主题')
    expect(buildWorkspacePreview(item).nodes.map(node => node.label)).toContain('核心主题')
  })
})
