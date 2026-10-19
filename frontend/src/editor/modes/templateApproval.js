import { createDocument, createNode, normalizeEdgeStyle } from '../model/document'

// 示例模板：报销审批流程
// 6 个节点、6 条连线（含 2 条带条件标签的分支），用于演示图形库、
// 锚点连线和正交路由的完整效果。
export function createApprovalTemplateDocument() {
  const document = createDocument({
    mode: 'flowchart',
    title: '示例：报销审批流程'
  })

  document.content.nodes = [
    createNode({
      id: 'tmpl-start',
      kind: 'terminator',
      x: 80,
      y: 240,
      width: 150,
      height: 64,
      text: '发起申请',
      layerId: 'layer-nodes',
      style: { accent: 'emerald', theme: 'aurora', elevation: 'soft' }
    }),
    createNode({
      id: 'tmpl-submit',
      kind: 'process',
      x: 300,
      y: 238,
      width: 176,
      height: 68,
      text: '填写报销单',
      layerId: 'layer-nodes',
      style: { accent: 'slate', theme: 'aurora', elevation: 'soft' }
    }),
    createNode({
      id: 'tmpl-review',
      kind: 'decision',
      x: 550,
      y: 228,
      width: 176,
      height: 88,
      text: '金额超过 5000？',
      layerId: 'layer-nodes',
      style: { accent: 'amber', theme: 'aurora', elevation: 'soft' }
    }),
    createNode({
      id: 'tmpl-manager',
      kind: 'process',
      x: 760,
      y: 110,
      width: 176,
      height: 68,
      text: '主管审批',
      layerId: 'layer-nodes',
      style: { accent: 'blue', theme: 'aurora', elevation: 'soft' }
    }),
    createNode({
      id: 'tmpl-finance',
      kind: 'document',
      x: 760,
      y: 350,
      width: 176,
      height: 78,
      text: '财务复核',
      layerId: 'layer-nodes',
      style: { accent: 'violet', theme: 'aurora', elevation: 'soft' }
    }),
    createNode({
      id: 'tmpl-end',
      kind: 'terminator',
      x: 1000,
      y: 232,
      width: 150,
      height: 64,
      text: '打款完成',
      layerId: 'layer-nodes',
      style: { accent: 'emerald', theme: 'aurora', elevation: 'soft' }
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
    edge('tmpl-e1', 'tmpl-start', 'tmpl-submit', 'right', 'left'),
    edge('tmpl-e2', 'tmpl-submit', 'tmpl-review', 'right', 'left'),
    edge('tmpl-e3', 'tmpl-review', 'tmpl-manager', 'top', 'left', '是'),
    edge('tmpl-e4', 'tmpl-review', 'tmpl-finance', 'bottom', 'left', '否'),
    edge('tmpl-e5', 'tmpl-manager', 'tmpl-end', 'right', 'top'),
    edge('tmpl-e6', 'tmpl-finance', 'tmpl-end', 'right', 'bottom')
  ]

  return document
}
