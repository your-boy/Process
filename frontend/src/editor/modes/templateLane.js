import { createDocument, createNode, normalizeEdgeStyle } from '../model/document'

// 示例模板：泳道 + UML 类图 + 参与者
export function createLaneTemplateDocument() {
  const document = createDocument({
    mode: 'flowchart',
    title: '示例：泳道与类图'
  })

  const lane = createNode({
    id: 'lane-main',
    kind: 'swimlane',
    x: 60,
    y: 60,
    width: 1080,
    height: 380,
    text: '报销审批',
    layerId: 'layer-nodes',
    style: { accent: 'slate', theme: 'aurora', elevation: 'soft' }
  })

  document.content.nodes = [
    lane,
    createNode({
      id: 'lane-submit',
      kind: 'process',
      x: 140,
      y: 180,
      width: 176,
      height: 68,
      text: '提交单据',
      layerId: 'layer-nodes',
      style: { accent: 'slate', theme: 'aurora', elevation: 'soft' }
    }),
    createNode({
      id: 'lane-review',
      kind: 'roundrect',
      x: 400,
      y: 180,
      width: 180,
      height: 70,
      text: '主管审批',
      layerId: 'layer-nodes',
      style: { accent: 'blue', theme: 'aurora', elevation: 'soft' }
    }),
    createNode({
      id: 'lane-archive',
      kind: 'document',
      x: 680,
      y: 176,
      width: 180,
      height: 78,
      text: '归档',
      layerId: 'layer-nodes',
      style: { accent: 'violet', theme: 'aurora', elevation: 'soft' }
    }),
    createNode({
      id: 'uml-claim',
      kind: 'umlclass',
      x: 120,
      y: 490,
      width: 230,
      height: 150,
      text: 'Claim',
      layerId: 'layer-nodes',
      style: { accent: 'slate', theme: 'aurora', elevation: 'soft' }
    }),
    createNode({
      id: 'actor-clerk',
      kind: 'actor',
      x: 480,
      y: 500,
      width: 90,
      height: 120,
      text: '报销人',
      layerId: 'layer-nodes',
      style: { accent: 'slate', theme: 'aurora', elevation: 'soft' }
    })
  ]

  const edge = (id, from, to, fromAnchor, toAnchor, label = '') => ({
    id,
    fromNodeId: from,
    toNodeId: to,
    fromAnchor,
    toAnchor,
    layerId: 'layer-edges',
    label,
    style: normalizeEdgeStyle({ route: 'orthogonal', stroke: 'solid', marker: 'arrow' })
  })

  document.content.edges = [
    edge('lane-e1', 'lane-submit', 'lane-review', 'right', 'left'),
    edge('lane-e2', 'lane-review', 'lane-archive', 'right', 'left')
  ]

  return document
}
