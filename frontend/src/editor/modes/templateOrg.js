import { createDocument, createNode, normalizeEdgeStyle } from '../model/document'

// 示例模板：组织结构图（三层，水平排布）
export function createOrgTemplateDocument() {
  const document = createDocument({
    mode: 'flowchart',
    title: '示例：组织结构'
  })

  const node = (id, kind, x, y, width, height, text, accent = 'slate') => createNode({
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
    node('org-ceo', 'roundrect', 520, 70, 180, 70, '总经理', 'blue'),

    node('org-tech', 'roundrect', 180, 250, 180, 70, '技术部', 'teal'),
    node('org-market', 'roundrect', 500, 250, 180, 70, '市场部', 'amber'),
    node('org-ops', 'roundrect', 820, 250, 180, 70, '运营部', 'violet'),

    node('org-fe', 'process', 90, 430, 160, 64, '前端组'),
    node('org-be', 'process', 290, 430, 160, 64, '后端组'),
    node('org-brand', 'process', 500, 430, 160, 64, '品牌组'),
    node('org-sales', 'process', 700, 430, 160, 64, '销售组'),
    node('org-content', 'process', 900, 430, 160, 64, '内容组')
  ]

  const edge = (id, from, to) => ({
    id,
    fromNodeId: from,
    toNodeId: to,
    fromAnchor: 'bottom',
    toAnchor: 'top',
    layerId: 'layer-edges',
    label: '',
    style: normalizeEdgeStyle({ route: 'orthogonal', stroke: 'solid', marker: 'arrow' })
  })

  document.content.edges = [
    edge('org-e1', 'org-ceo', 'org-tech'),
    edge('org-e2', 'org-ceo', 'org-market'),
    edge('org-e3', 'org-ceo', 'org-ops'),
    edge('org-e4', 'org-tech', 'org-fe'),
    edge('org-e5', 'org-tech', 'org-be'),
    edge('org-e6', 'org-market', 'org-brand'),
    edge('org-e7', 'org-market', 'org-sales'),
    edge('org-e8', 'org-ops', 'org-content')
  ]

  return document
}
