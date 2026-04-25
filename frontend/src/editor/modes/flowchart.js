import { createDocument, createNode, normalizeEdgeStyle } from '../model/document'

const FLOWCHART_NODE_PRESETS = {
  process: {
    label: '处理',
    width: 176,
    height: 68,
    style: { accent: 'teal', theme: 'aurora', elevation: 'soft' }
  },
  terminator: {
    label: '开始',
    width: 184,
    height: 68,
    style: { accent: 'rose', theme: 'aurora', elevation: 'soft' }
  },
  decision: {
    label: '判断',
    width: 176,
    height: 96,
    style: { accent: 'amber', theme: 'aurora', elevation: 'soft' }
  },
  ellipse: {
    label: '状态',
    width: 170,
    height: 78,
    style: { accent: 'sky', theme: 'aurora', elevation: 'soft' }
  },
  parallelogram: {
    label: '输入',
    width: 184,
    height: 70,
    style: { accent: 'violet', theme: 'aurora', elevation: 'soft' }
  },
  document: {
    label: '文档',
    width: 184,
    height: 78,
    style: { accent: 'rose', theme: 'aurora', elevation: 'soft' }
  },
  cylinder: {
    label: '数据',
    width: 184,
    height: 84,
    style: { accent: 'emerald', theme: 'aurora', elevation: 'soft' }
  },
  hexagon: {
    label: '准备',
    width: 184,
    height: 74,
    style: { accent: 'amber', theme: 'aurora', elevation: 'soft' }
  },
  card: {
    label: '卡片',
    width: 184,
    height: 74,
    style: { accent: 'blue', theme: 'aurora', elevation: 'soft' }
  },
  delay: {
    label: '等待',
    width: 184,
    height: 74,
    style: { accent: 'slate', theme: 'aurora', elevation: 'soft' }
  },
  note: {
    label: '注释',
    width: 188,
    height: 84,
    style: { accent: 'violet', theme: 'aurora', elevation: 'soft' }
  },
  cloud: {
    label: '外部服务',
    width: 188,
    height: 96,
    style: { accent: 'sky', theme: 'aurora', elevation: 'glow' }
  }
}

export function createFlowchartDocument() {
  return createDocument({
    mode: 'flowchart'
  })
}

export function createFlowchartNode(kind, index, position = {}) {
  const preset = FLOWCHART_NODE_PRESETS[kind] || FLOWCHART_NODE_PRESETS.process
  return createNode({
    id: `node-${index}`,
    kind,
    x: position.x ?? 140 + (index % 3) * 220,
    y: position.y ?? 160 + Math.floor(index / 3) * 120,
    width: preset.width,
    height: preset.height,
    text: `${preset.label} ${index + 1}`,
    layerId: 'layer-nodes',
    style: preset.style
  })
}

export function createFlowchartEdge({ fromNodeId, toNodeId, fromAnchor, toAnchor, index, style = {} }) {
  return {
    id: `edge-${index}`,
    fromNodeId,
    toNodeId,
    fromAnchor,
    toAnchor,
    layerId: 'layer-edges',
    style: normalizeEdgeStyle(style)
  }
}