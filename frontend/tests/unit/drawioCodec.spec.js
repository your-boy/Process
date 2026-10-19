import { describe, expect, it } from 'vitest'
import { deflateRaw } from 'pako'
import { exportDrawioDocument, importDrawioDocument } from '../../src/editor/services/drawioCodec'

function roundTrip(document) {
  const xml = exportDrawioDocument(document)
  return { xml, parsed: importDrawioDocument(xml) }
}

function compressDiagram(modelXml) {
  const compressed = deflateRaw(new TextEncoder().encode(modelXml))
  let binary = ''
  compressed.forEach(byte => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary)
}

describe('drawioCodec', () => {
  it('round-trips page, layers, rotation, container, group, waypoints and edge style', () => {
    const document = {
      id: 'doc-1',
      title: '保真测试',
      content: {
        page: { width: 1600, height: 900 },
        showGrid: false,
        layers: [
          { id: 'layer-edges', name: '连线', visible: true, locked: true, order: 0 },
          { id: 'layer-nodes', name: '节点', visible: true, locked: false, order: 1 },
          { id: 'layer-notes', name: '标注', visible: false, locked: false, order: 2 }
        ],
        nodes: [
          {
            id: 'container-1',
            kind: 'container',
            x: 100,
            y: 100,
            width: 400,
            height: 300,
            text: '泳道',
            layerId: 'layer-nodes',
            style: { accent: 'slate', theme: 'aurora', elevation: 'soft' }
          },
          {
            id: 'node-1',
            kind: 'process',
            x: 150,
            y: 160,
            width: 176,
            height: 68,
            text: '提交',
            containerId: 'container-1',
            groupId: 'group-alpha',
            layerId: 'layer-nodes',
            image: 'https://example.com/node.png',
            link: 'https://example.com/docs',
            tooltip: '打开文档',
            style: { accent: 'teal', theme: 'aurora', elevation: 'soft' }
          },
          {
            id: 'node-2',
            kind: 'decision',
            x: 360,
            y: 160,
            width: 160,
            height: 64,
            text: '通过？',
            containerId: 'container-1',
            groupId: 'group-alpha',
            locked: true,
            layerId: 'layer-nodes',
            style: { accent: 'amber', theme: 'aurora', elevation: 'soft' }
          },
          {
            id: 'node-3',
            kind: 'note',
            x: 700,
            y: 400,
            width: 160,
            height: 80,
            text: '倾斜标注',
            rotation: 45,
            layerId: 'layer-notes',
            style: { accent: 'violet', theme: 'aurora', elevation: 'soft' }
          }
        ],
        edges: [
          {
            id: 'edge-1',
            fromNodeId: 'node-1',
            toNodeId: 'node-2',
            fromAnchor: 'right',
            toAnchor: 'left',
            label: '是',
            layerId: 'layer-edges',
            style: {
              route: 'curve',
              stroke: 'dotted',
              marker: 'double-arrow',
              waypoints: [{ x: 280, y: 240 }, { x: 320, y: 240 }]
            }
          },
          {
            id: 'edge-2',
            fromNodeId: 'node-2',
            toNodeId: 'node-3',
            fromAnchor: 'top',
            toAnchor: 'bottom',
            label: '否',
            layerId: 'layer-edges',
            style: { route: 'straight', stroke: 'solid', marker: 'none' }
          }
        ]
      }
    }

    const { xml, parsed } = roundTrip(document)

    expect(xml).toContain('pageWidth="1600"')
    expect(xml).toContain('pageHeight="900"')
    expect(xml).toContain('grid="0"')
    expect(xml).toContain('rotation="45"')
    expect(xml).toContain('<Array as="points">')
    expect(xml).toMatch(/style="group;/)

    expect(parsed.page).toEqual({ width: 1600, height: 900 })
    expect(parsed.showGrid).toBe(false)
    expect(parsed.layers).toHaveLength(3)
    expect(parsed.layers[0]).toMatchObject({ id: 'layer-edges', name: '连线', locked: true })
    expect(parsed.layers[2]).toMatchObject({ id: 'layer-notes', name: '标注', visible: false })

    const node1 = parsed.nodes.find(node => node.id === 'node-1')
    const node2 = parsed.nodes.find(node => node.id === 'node-2')
    const node3 = parsed.nodes.find(node => node.id === 'node-3')
    expect(node1).toMatchObject({
      x: 150,
      y: 160,
      width: 176,
      height: 68,
      containerId: 'container-1',
      groupId: 'group-alpha',
      layerId: 'layer-nodes',
      image: 'https://example.com/node.png',
      link: 'https://example.com/docs',
      tooltip: '打开文档'
    })
    expect(node2).toMatchObject({ x: 360, y: 160, locked: true, groupId: 'group-alpha' })
    expect(node3).toMatchObject({ x: 700, y: 400, rotation: 45, layerId: 'layer-notes' })

    const edge1 = parsed.edges.find(edge => edge.id === 'edge-1')
    expect(edge1).toMatchObject({
      fromAnchor: 'right',
      toAnchor: 'left',
      label: '是',
      style: { route: 'curve', stroke: 'dotted', marker: 'double-arrow' }
    })
    expect(edge1.style.waypoints).toEqual([{ x: 280, y: 240 }, { x: 320, y: 240 }])
    expect(parsed.edges.find(edge => edge.id === 'edge-2')).toMatchObject({
      fromAnchor: 'top',
      toAnchor: 'bottom',
      style: { route: 'straight', marker: 'none' }
    })
  })

  it('round-trips mind-note mode and text blocks', () => {
    const document = {
      id: 'doc-note',
      title: '思维笔记',
      mode: 'mind-note',
      content: {
        page: { width: 1200, height: 720 },
        layers: [
          { id: 'layer-edges', name: '关系线', visible: true, locked: false, order: 0 },
          { id: 'layer-nodes', name: '主题节点', visible: true, locked: false, order: 1 },
          { id: 'layer-notes', name: '文本块', visible: true, locked: false, order: 2 }
        ],
        nodes: [
          { id: 'root', kind: 'topic', x: 180, y: 320, width: 168, height: 52, text: '中心主题', layerId: 'layer-nodes' },
          { id: 'child', kind: 'topic', parentId: 'root', x: 412, y: 300, width: 110, height: 52, text: '分支', layerId: 'layer-nodes' }
        ],
        edges: [],
        textBlocks: [
          { id: 'note-1', nodeId: 'root', text: '根备注', html: '<p><strong>根备注</strong></p>', width: 300, height: 150, format: 'rich', linkUrl: '', offsetX: 0, offsetY: 0, layerId: 'layer-notes' },
          { id: 'note-2', nodeId: 'child', text: '分支备注\n第二行', format: 'paragraph', linkUrl: 'https://example.com', offsetX: 12, offsetY: 6, layerId: 'layer-notes' }
        ]
      }
    }

    const { xml, parsed } = roundTrip(document)
    expect(xml).toContain('processMode="mind-note"')
    expect(xml).toContain('processTextBlockId=note-1')
    expect(parsed.mode).toBe('mind-note')
    expect(parsed.textBlocks).toHaveLength(2)
    expect(parsed.textBlocks[0]).toMatchObject({
      id: 'note-1',
      nodeId: 'root',
      text: '根备注',
      html: '<p><strong>根备注</strong></p>',
      width: 300,
      height: 150,
      format: 'rich',
      layerId: 'layer-notes'
    })
    expect(parsed.textBlocks[1].text).toBe('分支备注\n第二行')
    expect(parsed.textBlocks[1].offsetX).toBe(12)
  })

  it('imports native drawio parent hierarchy as absolute coordinates', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <mxfile host="test">
        <diagram id="page-1" name="Page-1">
          <mxGraphModel dx="0" dy="0" grid="0" pageWidth="800" pageHeight="600">
            <root>
              <mxCell id="0"/>
              <mxCell id="1" value="主层" parent="0"/>
              <mxCell id="g1" value="" style="group=1;" vertex="1" parent="1">
                <mxGeometry x="50" y="50" width="300" height="100" as="geometry"/>
              </mxCell>
              <mxCell id="a" value="A" style="rounded=0;" vertex="1" parent="g1">
                <mxGeometry x="10" y="20" width="80" height="40" as="geometry"/>
              </mxCell>
              <mxCell id="c" value="容器" style="swimlane;container=1;startSize=30;" vertex="1" parent="1">
                <mxGeometry x="400" y="50" width="300" height="200" as="geometry"/>
              </mxCell>
              <mxCell id="b" value="B" style="rounded=0;" vertex="1" parent="c">
                <mxGeometry x="20" y="50" width="100" height="50" rotation="15" as="geometry"/>
              </mxCell>
              <mxCell id="e" value="去" style="edgeStyle=orthogonalEdgeStyle;exitX=1;exitY=0.5;entryX=0;entryY=0.5;" edge="1" parent="1" source="a" target="b">
                <mxGeometry relative="1" as="geometry">
                  <Array as="points">
                    <mxPoint x="320" y="120"/>
                  </Array>
                </mxGeometry>
              </mxCell>
            </root>
          </mxGraphModel>
        </diagram>
      </mxfile>`

    const parsed = importDrawioDocument(xml)

    expect(parsed.page).toEqual({ width: 800, height: 600 })
    expect(parsed.showGrid).toBe(false)
    expect(parsed.layers).toEqual([
      { id: '1', name: '主层', visible: true, locked: false, order: 0 }
    ])

    expect(parsed.nodes.find(node => node.id === 'a')).toMatchObject({
      x: 60,
      y: 70,
      groupId: 'g1',
      layerId: '1'
    })
    expect(parsed.nodes.find(node => node.id === 'b')).toMatchObject({
      x: 420,
      y: 100,
      rotation: 15,
      containerId: 'c',
      layerId: '1'
    })
    expect(parsed.nodes.find(node => node.id === 'c')).toMatchObject({
      kind: 'container',
      x: 400,
      y: 50
    })
    expect(parsed.edges[0]).toMatchObject({
      fromAnchor: 'right',
      toAnchor: 'left',
      style: { route: 'orthogonal' }
    })
    expect(parsed.edges[0].style.waypoints).toEqual([{ x: 320, y: 120 }])
  })

  it('exports and imports multiple pages as separate diagrams', () => {
    const document = {
      id: 'multi',
      title: '多页',
      content: {
        activePageId: 'page-2',
        pages: [
          {
            id: 'page-1',
            name: '第一页',
            page: { width: 800, height: 600 },
            layers: [{ id: 'layer-nodes', name: '节点', visible: true, locked: false, order: 0 }],
            nodes: [{
              id: 'p1-node',
              kind: 'process',
              x: 20,
              y: 30,
              width: 100,
              height: 50,
              text: 'P1',
              layerId: 'layer-nodes'
            }],
            edges: [],
            textBlocks: [],
            guides: [],
            showGrid: true,
            viewport: { x: 0, y: 0, zoom: 1 }
          },
          {
            id: 'page-2',
            name: '第二页',
            page: { width: 900, height: 500 },
            layers: [{ id: 'layer-nodes', name: '节点', visible: true, locked: false, order: 0 }],
            nodes: [{
              id: 'p2-node',
              kind: 'decision',
              x: 40,
              y: 60,
              width: 120,
              height: 70,
              text: 'P2',
              layerId: 'layer-nodes'
            }],
            edges: [],
            textBlocks: [],
            guides: [],
            showGrid: false,
            viewport: { x: 0, y: 0, zoom: 1 }
          },
          {
            id: 'page-3',
            name: '空白页',
            page: { width: 600, height: 400 },
            layers: [{ id: 'layer-nodes', name: '节点', visible: true, locked: false, order: 0 }],
            nodes: [],
            edges: [],
            textBlocks: [],
            guides: [],
            showGrid: true,
            viewport: { x: 0, y: 0, zoom: 1 }
          }
        ],
        page: { width: 900, height: 500 },
        layers: [{ id: 'layer-nodes', name: '节点', visible: true, locked: false, order: 0 }],
        nodes: [],
        edges: [],
        textBlocks: [],
        guides: [],
        showGrid: false
      }
    }

    const xml = exportDrawioDocument(document)
    expect((xml.match(/<diagram /g) || []).length).toBe(3)
    expect(xml).toContain('name="第一页"')
    expect(xml).toContain('name="第二页"')

    const parsed = importDrawioDocument(xml)
    expect(parsed.pages).toHaveLength(3)
    expect(parsed.pages[0].nodes[0]).toMatchObject({ id: 'p1-node', text: 'P1', x: 20, y: 30 })
    expect(parsed.pages[1].nodes[0]).toMatchObject({ id: 'p2-node', text: 'P2', kind: 'decision' })
    expect(parsed.pages[2].nodes).toEqual([])
    expect(parsed.pages[0].page).toEqual({ width: 800, height: 600 })
    expect(parsed.pages[1].page).toEqual({ width: 900, height: 500 })
    expect(parsed.pages[2].page).toEqual({ width: 600, height: 400 })
  })

  it('imports compressed drawio diagram payloads', () => {
    const modelXml = `<mxGraphModel grid="1" pageWidth="900" pageHeight="500">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" value="Layer 1" parent="0"/>
        <mxCell id="a" value="压缩图" style="rounded=0;" vertex="1" parent="1">
          <mxGeometry x="30" y="40" width="120" height="60" as="geometry"/>
        </mxCell>
      </root>
    </mxGraphModel>`
    const encoded = compressDiagram(modelXml)
    const parsed = importDrawioDocument(
      `<mxfile><diagram id="p1" name="Page-1">${encoded}</diagram></mxfile>`
    )

    expect(parsed.page).toEqual({ width: 900, height: 500 })
    expect(parsed.nodes).toHaveLength(1)
    expect(parsed.nodes[0]).toMatchObject({ id: 'a', text: '压缩图', x: 30, y: 40 })
  })
})
