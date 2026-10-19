import { describe, expect, it } from 'vitest'
import {
  flattenNodeBlocks,
  indentNoteBlock,
  normalizeSiblingOrders,
  outdentNoteBlock,
  searchNoteContent,
  siblingBlocks
} from '../../src/editor/render/noteBlockOps'

const block = (id, order, extra = {}) => ({
  id,
  nodeId: 'topic-1',
  parentId: null,
  order,
  text: id,
  ...extra
})

describe('noteBlockOps · 块嵌套', () => {
  it('按 order 返回同级兄弟块', () => {
    const blocks = [block('b', 2), block('a', 1), block('c', 3)]
    expect(siblingBlocks(blocks, blocks[0]).map(item => item.id)).toEqual(['a', 'b', 'c'])
  })

  it('缩进：挂到上一个兄弟块下面，并把 order 归一化', () => {
    const blocks = [block('a', 0), block('b', 1), block('c', 2)]
    const next = indentNoteBlock(blocks, 'c')

    expect(next).not.toBeNull()
    const moved = next.find(item => item.id === 'c')
    expect(moved.parentId).toBe('b')
    expect(moved.order).toBe(0)

    const roots = siblingBlocks(next, { nodeId: 'topic-1', parentId: null })
    expect(roots.map(item => item.id)).toEqual(['a', 'b'])
  })

  it('第一个兄弟块不能缩进', () => {
    const blocks = [block('a', 0), block('b', 1)]
    expect(indentNoteBlock(blocks, 'a')).toBeNull()
  })

  it('取消缩进：升到祖父级并排在父块之后', () => {
    const blocks = [
      block('a', 0),
      block('b', 1),
      block('c', 0, { parentId: 'b' }),
      block('d', 1)
    ]

    const next = outdentNoteBlock(blocks, 'c')
    expect(next).not.toBeNull()

    const moved = next.find(item => item.id === 'c')
    expect(moved.parentId).toBeNull()

    const roots = siblingBlocks(next, { nodeId: 'topic-1', parentId: null })
    expect(roots.map(item => item.id)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('顶层块不能取消缩进', () => {
    const blocks = [block('a', 0)]
    expect(outdentNoteBlock(blocks, 'a')).toBeNull()
  })

  it('normalizeSiblingOrders 让每个父级下的 order 连续', () => {
    const blocks = [
      block('a', 5),
      block('b', 9),
      block('c', 42, { parentId: 'a' })
    ]
    const next = normalizeSiblingOrders(blocks)
    expect(next.map(item => item.order)).toEqual([0, 1, 0])
  })
})

describe('noteBlockOps · 笔记视图展平', () => {
  it('按先序输出并标注层级', () => {
    const blocks = [
      block('a', 0),
      block('b', 1),
      block('a1', 0, { parentId: 'a' }),
      block('a11', 0, { parentId: 'a1' }),
      block('b1', 0, { parentId: 'b' })
    ]

    expect(flattenNodeBlocks(blocks, 'topic-1').map(item => `${item.id}:${item.depth}`))
      .toEqual(['a:0', 'a1:1', 'a11:2', 'b:0', 'b1:1'])
  })

  it('只返回该主题下的块', () => {
    const blocks = [block('a', 0), block('x', 0, { nodeId: 'topic-2' })]
    expect(flattenNodeBlocks(blocks, 'topic-1').map(item => item.id)).toEqual(['a'])
  })

  it('父块丢失时按顶层处理', () => {
    const blocks = [block('orphan', 0, { parentId: 'missing' })]
    expect(flattenNodeBlocks(blocks, 'topic-1')).toEqual([
      expect.objectContaining({ id: 'orphan', depth: 0 })
    ])
  })
})

describe('noteBlockOps · 文档内搜索', () => {
  const nodes = [
    { id: 'topic-1', text: '项目周报' },
    { id: 'topic-2', text: '风险登记' }
  ]
  const blocks = [
    { id: 'n1', nodeId: 'topic-1', text: '本周完成了导出修复', parentId: null, order: 0 },
    { id: 'n2', nodeId: 'topic-2', text: '供应商交付延期', parentId: null, order: 0 }
  ]

  it('空查询返回空结果', () => {
    const result = searchNoteContent({ nodes, blocks, query: '   ' })
    expect(result.nodeIds.size).toBe(0)
    expect(result.blockIds.size).toBe(0)
    expect(result.hits).toHaveLength(0)
  })

  it('命中块文本，并带出所属主题', () => {
    const result = searchNoteContent({ nodes, blocks, query: '导出' })
    expect([...result.blockIds]).toEqual(['n1'])
    expect([...result.nodeIds]).toEqual(['topic-1'])
    expect(result.hits[0].kind).toBe('block')
    expect(result.hits[0].text).toContain('导出')
  })

  it('命中主题标题，大小写不敏感', () => {
    const result = searchNoteContent({
      nodes: [{ id: 't', text: 'Weekly Report' }],
      blocks: [],
      query: 'weekly'
    })
    expect([...result.nodeIds]).toEqual(['t'])
    expect(result.hits[0].kind).toBe('node')
  })

  it('同时命中主题与块时两边都返回', () => {
    const result = searchNoteContent({ nodes, blocks, query: '周报' })
    expect([...result.nodeIds]).toEqual(['topic-1'])
    expect([...result.blockIds]).toEqual([])
  })
})
