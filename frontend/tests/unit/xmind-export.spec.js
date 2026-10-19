import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { buildXMindArchive } from '../../src/editor/exporters/xmindExporter'

describe('xmind export', () => {
  it('produces a readable XMind archive with the overridden uuid dependency', async () => {
    const archive = await buildXMindArchive({
      title: 'Export test',
      content: {
        nodes: [
          { id: 'root', text: 'Center' },
          { id: 'child', parentId: 'root', text: 'Branch' }
        ],
        textBlocks: []
      }
    })

    const zip = await JSZip.loadAsync(archive)
    const names = Object.keys(zip.files)
    expect(names.some(name => name.endsWith('content.json'))).toBe(true)
    expect(names.some(name => name.endsWith('manifest.json'))).toBe(true)

    const legacyXml = await zip.file('content.xml').async('string')
    expect(legacyXml).toContain('<title>Center</title>')
    expect(legacyXml).toContain('<title>Branch</title>')
    expect(legacyXml).not.toContain('can not be opened normally')
  })

  it('exports every document page as its own XMind sheet', async () => {
    const archive = await buildXMindArchive({
      title: 'Multi page',
      content: {
        nodes: [{ id: 'current-root', text: '当前页' }],
        pages: [
          {
            id: 'page-1',
            name: '第一页',
            nodes: [
              { id: 'a-root', text: '第一页中心' },
              { id: 'a-child', parentId: 'a-root', text: '第一页子主题' }
            ],
            edges: [],
            textBlocks: [],
            layout: { direction: 'right' }
          },
          {
            id: 'page-2',
            name: '第二页',
            nodes: [{ id: 'b-root', text: '第二页中心' }],
            edges: [],
            textBlocks: [],
            layout: { direction: 'down' }
          }
        ]
      }
    })

    const zip = await JSZip.loadAsync(archive)
    const sheets = JSON.parse(await zip.file('content.json').async('string'))
    expect(sheets).toHaveLength(2)
    expect(sheets.map(sheet => sheet.title)).toEqual(['第一页', '第二页'])
    expect(sheets[0].rootTopic.title).toBe('第一页中心')
    expect(sheets[0].rootTopic.children.attached[0].title).toBe('第一页子主题')
    expect(sheets[1].rootTopic.title).toBe('第二页中心')

    const legacyXml = await zip.file('content.xml').async('string')
    expect((legacyXml.match(/<sheet /g) || []).length).toBe(2)
    expect(legacyXml).toContain('第一页中心')
    expect(legacyXml).toContain('第一页子主题')
    expect(legacyXml).toContain('第二页中心')
    expect(legacyXml).toContain('org.xmind.ui.org-chart.down')
  })

  it('indents nested mind-note blocks in xmind notes', async () => {
    const archive = await buildXMindArchive({
      title: 'Nested notes',
      content: {
        nodes: [{ id: 'root', text: 'Root' }],
        textBlocks: [
          { id: 'n1', nodeId: 'root', order: 0, text: '根备注' },
          { id: 'n2', nodeId: 'root', parentId: 'n1', order: 0, text: '子备注' }
        ]
      }
    })

    const zip = await JSZip.loadAsync(archive)
    const sheets = JSON.parse(await zip.file('content.json').async('string'))
    const plain = sheets[0].rootTopic.notes.plain.content
    expect(plain).toContain('根备注')
    expect(plain).toContain('  子备注')
  })
})
