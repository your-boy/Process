import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { buildXMindArchive } from '../../src/editor/exporters/xmindExporter'
import {
  markdownToNodes,
  opmlToNodes,
  xmindToNodes,
  xmindToPages,
  xmindXmlToNodes,
  xmindXmlToPages
} from '../../src/editor/services/outlineImport'

describe('mind map outline import', () => {
  it('parses a markdown outline into nodes', () => {
    const { nodes, title } = markdownToNodes([
      '# Plan',
      '- A',
      '  - A1',
      '  - A2',
      '- B'
    ].join('\n'))

    expect(title).toBe('Plan')
    expect(nodes.map(node => node.text)).toEqual(['Plan', 'A', 'A1', 'A2', 'B'])
    expect(nodes[1].parentId).toBe(nodes[0].id)
    expect(nodes[2].parentId).toBe(nodes[1].id)
    expect(nodes[4].parentId).toBe(nodes[0].id)
  })

  it('parses opml outlines', () => {
    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<opml version="2.0"><body>',
      '<outline text="Root"><outline text="A"><outline text="A1"/></outline><outline text="B"/></outline>',
      '</body></opml>'
    ].join('')

    const { nodes, title } = opmlToNodes(xml)
    expect(title).toBe('Root')
    expect(nodes.map(node => node.text)).toEqual(['Root', 'A', 'A1', 'B'])
    expect(nodes[2].parentId).toBe(nodes[1].id)
  })

  it('maps xmind content.json topics', () => {
    const content = {
      sheets: [{
        rootTopic: {
          title: 'Center',
          children: {
            attached: [
              {
                title: 'Branch',
                labels: ['tag'],
                notes: { plain: { content: 'note text' } },
                children: { attached: [{ title: 'Leaf' }] }
              }
            ]
          }
        }
      }]
    }

    const { nodes, title } = xmindToNodes(content)
    expect(title).toBe('Center')
    expect(nodes.map(node => node.text)).toEqual(['Center', 'Branch', 'Leaf'])
    expect(nodes[1].labels).toEqual(['tag'])
    expect(nodes[1].note).toBe('note text')
    expect(nodes[2].parentId).toBe(nodes[1].id)
  })

  it('imports an archive produced by the xmind exporter', async () => {
    const archive = await buildXMindArchive({
      title: 'Round trip',
      content: {
        nodes: [
          { id: 'root', text: 'Root' },
          { id: 'a', parentId: 'root', text: 'A' },
          { id: 'b', parentId: 'a', text: 'B' }
        ],
        textBlocks: []
      }
    })

    const zip = await JSZip.loadAsync(archive)
    const entry = zip.file('content.json') || zip.file(/content\.json$/)[0]
    expect(entry).toBeTruthy()

    const content = JSON.parse(await entry.async('string'))
    const { nodes } = xmindToNodes(content)

    expect(nodes.map(node => node.text)).toEqual(['Root', 'A', 'B'])
    expect(nodes[1].parentId).toBe(nodes[0].id)
    expect(nodes[2].parentId).toBe(nodes[1].id)
  })

  it('round-trips relationship edges through content.xml', async () => {
    const archive = await buildXMindArchive({
      title: 'Rels',
      content: {
        nodes: [
          { id: 'root', text: 'Root' },
          { id: 'a', parentId: 'root', text: 'A' },
          { id: 'b', parentId: 'root', text: 'B' }
        ],
        edges: [
          { id: 'rel-1', kind: 'relationship', fromNodeId: 'a', toNodeId: 'b', label: '关联', layerId: 'layer-edges' }
        ],
        textBlocks: []
      }
    })

    const zip = await JSZip.loadAsync(archive)
    const entry = zip.file('content.xml') || zip.file(/content\.xml$/)[0]
    const { nodes, relationships } = xmindXmlToNodes(await entry.async('string'))

    expect(relationships).toHaveLength(1)
    const a = nodes.find(node => node.text === 'A')
    const b = nodes.find(node => node.text === 'B')
    expect(relationships[0].fromNodeId).toBe(a.id)
    expect(relationships[0].toNodeId).toBe(b.id)
    expect(relationships[0].label).toBe('关联')
  })

  it('round-trips boundary frames through content.xml', async () => {
    const archive = await buildXMindArchive({
      title: 'Boundaries',
      content: {
        nodes: [
          { id: 'root', text: 'Root' },
          { id: 'a', parentId: 'root', text: 'A' }
        ],
        boundaries: [{ id: 'b1', nodeId: 'a', accent: 'rose' }],
        textBlocks: []
      }
    })

    const zip = await JSZip.loadAsync(archive)
    const entry = zip.file('content.xml') || zip.file(/content\.xml$/)[0]
    const { nodes, boundaries } = xmindXmlToNodes(await entry.async('string'))
    const a = nodes.find(node => node.text === 'A')

    expect(boundaries).toHaveLength(1)
    expect(boundaries[0].nodeId).toBe(a.id)
  })

  it('parses xmind 8 content.xml with labels, notes and markers', () => {
    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<xmap-content xmlns="urn:xmind:xmap:xmlns:content:2.0">',
      '<sheet id="s1">',
      '<topic id="t0"><title>Root</title>',
      '<children><topics type="attached">',
      '<topic id="t1"><title>Branch</title>',
      '<marker-refs><marker-ref marker-id="priority-2"/><marker-ref marker-id="star-red"/></marker-refs>',
      '<labels><label>v2</label></labels>',
      '<notes><plain>note text</plain></notes>',
      '<children><topics type="attached"><topic id="t2"><title>Leaf</title></topic></topics></children>',
      '</topic>',
      '</topics></children>',
      '</topic>',
      '</sheet>',
      '</xmap-content>'
    ].join('')

    const { nodes, title } = xmindXmlToNodes(xml)
    expect(title).toBe('Root')
    expect(nodes.map(node => node.text)).toEqual(['Root', 'Branch', 'Leaf'])
    expect(nodes[1].priority).toBe(2)
    expect(nodes[1].markers).toEqual(['star'])
    expect(nodes[1].labels).toEqual(['v2'])
    expect(nodes[1].note).toBe('note text')
    expect(nodes[2].parentId).toBe(nodes[1].id)
  })

  it('round-trips labels and markers through the exporter content.xml', async () => {
    const archive = await buildXMindArchive({
      title: 'Parity',
      content: {
        nodes: [
          { id: 'root', text: 'Root' },
          {
            id: 'a',
            parentId: 'root',
            text: 'A',
            priority: 1,
            progress: 100,
            markers: ['star', 'check'],
            labels: ['milestone']
          }
        ],
        textBlocks: []
      }
    })

    const zip = await JSZip.loadAsync(archive)
    const xmlEntry = zip.file('content.xml') || zip.file(/content\.xml$/)[0]
    expect(xmlEntry).toBeTruthy()

    const { nodes } = xmindXmlToNodes(await xmlEntry.async('string'))
    expect(nodes.map(node => node.text)).toEqual(['Root', 'A'])
    expect(nodes[1].priority).toBe(1)
    expect(nodes[1].progress).toBe(100)
    expect(nodes[1].markers).toEqual(['star', 'check'])
    expect(nodes[1].labels).toEqual(['milestone'])
  })

  it('imports every sheet from a multi-page xmind archive', async () => {
    const archive = await buildXMindArchive({
      title: 'Multi import',
      content: {
        nodes: [{ id: 'current', text: '当前页' }],
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
    const xmlEntry = zip.file('content.xml') || zip.file(/content\.xml$/)[0]
    const jsonEntry = zip.file('content.json') || zip.file(/content\.json$/)[0]

    const xmlPages = xmindXmlToPages(await xmlEntry.async('string'))
    expect(xmlPages).toHaveLength(2)
    expect(xmlPages.map(page => page.sheetTitle)).toEqual(['第一页', '第二页'])
    expect(xmlPages[0].nodes.map(node => node.text)).toEqual(['第一页中心', '第一页子主题'])

    const jsonPages = xmindToPages(JSON.parse(await jsonEntry.async('string')))
    expect(jsonPages).toHaveLength(2)
    expect(jsonPages.map(page => page.sheetTitle)).toEqual(['第一页', '第二页'])
    expect(jsonPages[1].nodes.map(node => node.text)).toEqual(['第二页中心'])
  })
})
