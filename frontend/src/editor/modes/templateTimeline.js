import { createDocument, createNode, normalizeEdgeStyle } from '../model/document'

// 示例模板：时间线（横向里程碑）
export function createTimelineTemplateDocument() {
  const document = createDocument({
    mode: 'flowchart',
    title: '示例：项目时间线'
  })

  const node = (id, kind, x, y, width, height, text, accent) => createNode({
    id,
    kind,
    x,
    y,
    width,
    height,
    text,
    layerId: 'layer-nodes',
    style: { accent, theme: 'aurora', elevation: 'soft' }
  })

  document.content.nodes = [
    node('tl-start', 'terminator', 60, 300, 140, 64, '立项', 'emerald'),
    node('tl-m1', 'roundrect', 260, 170, 160, 70, '需求冻结', 'blue'),
    node('tl-m2', 'roundrect', 450, 320, 160, 70, '开发完成', 'amber'),
    node('tl-m3', 'roundrect', 640, 170, 160, 70, '测试通过', 'violet'),
    node('tl-m4', 'roundrect', 830, 320, 160, 70, '上线', 'teal'),
    node('tl-end', 'terminator', 1040, 170, 120, 64, '复盘', 'slate')
  ]

  const link = (id, from, to, fromAnchor, toAnchor) => ({
    id,
    fromNodeId: from,
    toNodeId: to,
    fromAnchor,
    toAnchor,
    layerId: 'layer-edges',
    label: '',
    style: normalizeEdgeStyle({ route: 'orthogonal', stroke: 'solid', marker: 'arrow' })
  })

  document.content.edges = [
    link('tl-e1', 'tl-start', 'tl-m1', 'right', 'left'),
    link('tl-e2', 'tl-m1', 'tl-m2', 'right', 'left'),
    link('tl-e3', 'tl-m2', 'tl-m3', 'right', 'left'),
    link('tl-e4', 'tl-m3', 'tl-m4', 'right', 'left'),
    link('tl-e5', 'tl-m4', 'tl-end', 'right', 'left')
  ]

  return document
}
