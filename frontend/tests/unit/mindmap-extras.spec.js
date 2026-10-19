import { describe, expect, it } from 'vitest'
import { createDocument, normalizeDocument } from '../../src/editor/model/document'
import { syncMindmapEdges } from '../../src/editor/modes/mindmap'
import { layoutMindmap } from '../../src/editor/render/mindmapLayout'
import { MINDMAP_STYLE_PRESETS } from '../../src/editor/model/mindmapMeta'
import { resolveTopicTextLayout, wrapTopicText } from '../../src/editor/render/mindmapText'

describe('mind map node extras', () => {
  it('normalizes markers, priority, progress, note and labels', () => {
    const doc = normalizeDocument({
      mode: 'mindmap',
      title: 'extras',
      content: {
        nodes: [{
          id: 'topic-a',
          text: 'A',
          x: 0,
          y: 0,
          markers: ['star', 'star', 'unknown', 'flag', 'check', 'idea', 'fire', 'heart', 'pin'],
          priority: 12,
          progress: 140,
          note: 'n'.repeat(2500),
          labels: [' alpha ', 'alpha', 'beta']
        }]
      }
    })

    const node = doc.content.nodes[0]
    expect(node.markers).toEqual(['star', 'flag', 'check', 'idea', 'fire', 'heart'])
    expect(node.priority).toBeNull()
    expect(node.progress).toBe(100)
    expect(node.note).toHaveLength(2000)
    expect(node.labels).toEqual(['alpha', 'beta'])
    expect(doc.content.layout).toEqual({
      direction: 'right',
      theme: 'aurora',
      branchStyle: 'curve',
      rainbow: false,
      numbering: false
    })
    expect(doc.content.boundaries).toEqual([])
    expect(doc.content.summaries).toEqual([])
  })

  it('keeps link and data-url attachments, drops unsafe schemes', () => {
    const doc = normalizeDocument({
      mode: 'mindmap',
      title: 'attachments',
      content: {
        nodes: [{
          id: 'topic-a',
          text: 'A',
          attachments: [
            { name: 'spec.pdf', url: 'https://example.com/a.pdf' },
            { name: 'local.txt', url: 'data:text/plain;base64,aGk=' },
            { name: 'bad', url: 'javascript:alert(1)' }
          ]
        }]
      }
    })

    const attachments = doc.content.nodes[0].attachments
    expect(attachments).toHaveLength(2)
    expect(attachments[0].url).toBe('https://example.com/a.pdf')
    expect(attachments[1].url.startsWith('data:')).toBe(true)
  })

  it('lays out right, left and down directions', () => {
    const nodes = [
      { id: 'root', text: 'R', width: 176, height: 56 },
      { id: 'a', parentId: 'root', text: 'A', width: 176, height: 56 },
      { id: 'b', parentId: 'a', text: 'B', width: 176, height: 56 }
    ]
    const toMap = list => new Map(list.map(node => [node.id, node]))

    const right = toMap(layoutMindmap(nodes, { direction: 'right' }))
    expect(right.get('a').x).toBeGreaterThan(right.get('root').x)
    expect(right.get('b').x).toBeGreaterThan(right.get('a').x)

    const left = toMap(layoutMindmap(nodes, { direction: 'left' }))
    expect(left.get('a').x).toBeLessThan(left.get('root').x)

    const down = toMap(layoutMindmap(nodes, { direction: 'down' }))
    expect(down.get('a').y).toBeGreaterThan(down.get('root').y)
    expect(down.get('b').y).toBeGreaterThan(down.get('a').y)
  })

  it('splits branches to both sides in balanced layout', () => {
    const nodes = [
      { id: 'root', text: 'R' },
      { id: 'a', parentId: 'root', text: 'A' },
      { id: 'b', parentId: 'root', text: 'B' },
      { id: 'c', parentId: 'root', text: 'C' }
    ]

    const balanced = new Map(layoutMindmap(nodes, { direction: 'balanced' }, { width: 1200 }).map(node => [node.id, node]))
    const root = balanced.get('root')
    const rootRight = root.x + root.width

    const leftBranch = balanced.get('b')
    expect(leftBranch.x + leftBranch.width).toBeLessThan(root.x + 1)
    expect(balanced.get('a').x).toBeGreaterThan(rootRight - 1)
    expect(balanced.get('c').x).toBeGreaterThan(rootRight - 1)
  })

  it('top-aligns the root in tree layout and alternates branches on the timeline', () => {
    const nodes = [
      { id: 'root', text: 'R' },
      { id: 'a', parentId: 'root', text: 'A' },
      { id: 'b', parentId: 'root', text: 'B' },
      { id: 'a1', parentId: 'a', text: 'A1' }
    ]
    const toMap = list => new Map(list.map(node => [node.id, node]))

    const tree = toMap(layoutMindmap(nodes, { direction: 'tree' }))
    expect(tree.get('root').y).toBeCloseTo(tree.get('a').y, 5)
    expect(tree.get('a').y).toBeLessThan(tree.get('b').y)

    const timeline = toMap(layoutMindmap(nodes, { direction: 'timeline' }))
    const axisY = timeline.get('root').y + timeline.get('root').height / 2
    expect(timeline.get('a').y).toBeLessThan(axisY)
    expect(timeline.get('b').y).toBeGreaterThan(axisY)
    expect(timeline.get('a1').x).toBeGreaterThan(timeline.get('a').x)
  })

  it('fans branches around a spine in fishbone layout', () => {
    const nodes = [
      { id: 'root', text: 'R' },
      { id: 'a', parentId: 'root', text: 'A' },
      { id: 'b', parentId: 'root', text: 'B' },
      { id: 'a1', parentId: 'a', text: 'A1' }
    ]
    const toMap = list => new Map(list.map(node => [node.id, node]))
    const fishbone = toMap(layoutMindmap(nodes, { direction: 'fishbone' }, { width: 1200, height: 720 }))
    const axisY = fishbone.get('root').y + fishbone.get('root').height / 2

    expect(fishbone.get('a').y).toBeLessThan(axisY)
    expect(fishbone.get('b').y).toBeGreaterThan(axisY)
    expect(fishbone.get('a1').x).toBeGreaterThan(fishbone.get('a').x)
  })

  it('ships layered style presets for every depth', () => {
    expect(MINDMAP_STYLE_PRESETS.length).toBeGreaterThanOrEqual(6)
    MINDMAP_STYLE_PRESETS.forEach(preset => {
      expect(preset.id).toBeTruthy()
      expect(preset.root).toBeTruthy()
      expect(preset.branch).toBeTruthy()
      expect(preset.deep).toBeTruthy()
    })
  })

  it('wraps long topic text and grows the box', () => {
    const lines = wrapTopicText('这是一个很长的主题文字用来验证自动换行是否正常工作', 120, 15)
    expect(lines.length).toBeGreaterThan(1)

    const short = resolveTopicTextLayout({ id: 'a', parentId: 'root', text: '短标题', style: {} })
    const long = resolveTopicTextLayout({ id: 'b', parentId: 'root', text: '这是一个很长的主题文字用来验证自动换行是否正常工作', style: {} })
    expect(long.lines.length).toBeGreaterThan(short.lines.length)
    expect(long.height).toBeGreaterThan(short.height)
    expect(long.width).toBeLessThanOrEqual(208)
    expect(short.width).toBeGreaterThanOrEqual(110)
  })

  it('keeps relationship edges and anchors branch edges per direction', () => {
    const doc = createDocument({ mode: 'mindmap', title: 'edges' })
    doc.content.nodes = [
      { id: 'root', text: 'R', x: 0, y: 0, width: 176, height: 56 },
      { id: 'a', parentId: 'root', text: 'A', x: 0, y: 120, width: 176, height: 56 },
      { id: 'b', text: 'B', x: 260, y: 120, width: 176, height: 56 }
    ]
    doc.content.layout = { direction: 'down', theme: 'aurora' }
    doc.content.edges = [
      { id: 'relation-1', kind: 'relationship', fromNodeId: 'b', toNodeId: 'a', layerId: 'layer-edges' }
    ]

    syncMindmapEdges(doc)

    const branch = doc.content.edges.find(edge => edge.id.startsWith('mind-edge'))
    const relation = doc.content.edges.find(edge => edge.kind === 'relationship')

    expect(branch.fromAnchor).toBe('bottom')
    expect(branch.toAnchor).toBe('top')
    expect(relation).toBeTruthy()
    expect(relation.style.stroke).toBe('dashed')
    // a 在 b 左侧，关系线应从 b 的左边连到 a 的右边
    expect(relation.fromAnchor).toBe('left')
    expect(relation.toAnchor).toBe('right')
  })

  it('routes branch edges with the selected branch style', () => {
    const doc = createDocument({ mode: 'mindmap', title: 'branch style' })
    doc.content.nodes = [
      { id: 'root', text: 'R', x: 0, y: 0 },
      { id: 'a', parentId: 'root', text: 'A', x: 200, y: 80 }
    ]
    doc.content.layout = { direction: 'right', theme: 'aurora', branchStyle: 'straight' }

    syncMindmapEdges(doc)

    const branch = doc.content.edges.find(edge => edge.id.startsWith('mind-edge'))
    expect(branch.style.route).toBe('straight')
  })
})
