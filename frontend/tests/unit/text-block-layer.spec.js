import { describe, expect, it } from 'vitest'
import {
  createMindNoteTextBlock,
  getVisibleTextBlocks,
  normalizeMindNoteBlock
} from '../../src/editor/render/textBlockLayer'

describe('mind-note text blocks', () => {
  it('generates unique ids instead of note-1/note-2 counters', () => {
    const first = createMindNoteTextBlock({ nodeId: 'root', order: 1 })
    const second = createMindNoteTextBlock({ nodeId: 'root', order: 2 })
    expect(first.id).not.toBe(second.id)
    expect(first.id.startsWith('note-')).toBe(true)
  })

  it('migrates legacy text/format blocks to html', () => {
    const block = normalizeMindNoteBlock({
      id: 'legacy',
      nodeId: 'root',
      text: '旧格式',
      format: 'bold',
      offsetX: 0,
      offsetY: 0,
      layerId: 'layer-notes'
    }, 0)

    expect(block.text).toBe('旧格式')
    expect(block.html).toContain('<strong>旧格式</strong>')
    expect(block.width).toBeGreaterThanOrEqual(180)
  })

  it('honors explicit block width and height', () => {
    const nodes = [{ id: 'root', x: 100, y: 100, width: 100, height: 40 }]
    const blocks = [createMindNoteTextBlock({
      id: 'note-sized',
      nodeId: 'root',
      text: '尺寸',
      width: 320,
      height: 200
    })]

    const visible = getVisibleTextBlocks(blocks, nodes, [], new Set(['layer-notes']), 1200)
    expect(visible[0]).toMatchObject({ width: 320, baseHeight: 200 })
  })

  it('stacks multiple blocks attached to the same node', () => {
    const nodes = [{ id: 'root', x: 100, y: 100, width: 100, height: 40 }]
    const blocks = [
      createMindNoteTextBlock({ id: 'note-a', nodeId: 'root', order: 1, text: '第一块' }),
      createMindNoteTextBlock({ id: 'note-b', nodeId: 'root', order: 2, text: '第二块' })
    ]

    const visible = getVisibleTextBlocks(
      blocks,
      nodes,
      [],
      new Set(['layer-notes']),
      1200
    )

    expect(visible).toHaveLength(2)
    expect(visible[0].x).toBe(228)
    expect(visible[0].height).toBeGreaterThan(80)
    expect(visible[1].y).toBe(visible[0].y + visible[0].height + 12)
    expect(visible[0].stackIndex).toBe(0)
    expect(visible[1].stackIndex).toBe(1)
  })
})
