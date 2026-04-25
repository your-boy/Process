const DEFAULT_LAYER_ID = 'layer-nodes'

export const DOCUMENT_MODES = ['flowchart', 'mindmap', 'markdown', 'mind-note']
export const DEFAULT_NODE_STYLE = Object.freeze({
  theme: 'aurora',
  accent: 'teal',
  elevation: 'soft'
})
export const DEFAULT_EDGE_STYLE = Object.freeze({
  route: 'orthogonal',
  stroke: 'solid',
  marker: 'arrow'
})

export function normalizeNodeStyle(style = {}) {
  return {
    ...DEFAULT_NODE_STYLE,
    ...(style || {})
  }
}

export function normalizeEdgeStyle(style = {}) {
  return {
    ...DEFAULT_EDGE_STYLE,
    ...(style || {})
  }
}

export function createDefaultLayer() {
  return createDefaultLayers('flowchart')[1]
}

export function createDefaultLayers(mode = 'flowchart') {
  if (mode === 'flowchart') {
    return [
      { id: 'layer-edges', name: '连线', visible: true, locked: false, order: 0 },
      { id: 'layer-nodes', name: '节点', visible: true, locked: false, order: 1 },
      { id: 'layer-notes', name: '标注', visible: true, locked: false, order: 2 }
    ]
  }

  if (mode === 'mindmap') {
    return [
      { id: 'layer-edges', name: '关系线', visible: true, locked: false, order: 0 },
      { id: 'layer-nodes', name: '主题节点', visible: true, locked: false, order: 1 },
      { id: 'layer-notes', name: '文本块', visible: true, locked: false, order: 2 }
    ]
  }

  if (mode === 'mind-note') {
    return [
      { id: 'layer-edges', name: '关系线', visible: true, locked: false, order: 0 },
      { id: 'layer-nodes', name: '主题节点', visible: true, locked: false, order: 1 },
      { id: 'layer-notes', name: '文本块', visible: true, locked: false, order: 2 }
    ]
  }

  return [{ id: DEFAULT_LAYER_ID, name: '默认图层', visible: true, locked: false, order: 0 }]
}

export function createDocumentContent(partial = {}) {
  return {
    viewport: {
      x: 0,
      y: 0,
      zoom: 1,
      ...(partial.viewport || {})
    },
    layers: Array.isArray(partial.layers) && partial.layers.length
      ? partial.layers.map(layer => ({ ...layer }))
      : createDefaultLayers(partial.mode),
    nodes: Array.isArray(partial.nodes) ? partial.nodes.map(node => ({ ...node })) : [],
    edges: Array.isArray(partial.edges) ? partial.edges.map(edge => ({ ...edge })) : [],
    textBlocks: Array.isArray(partial.textBlocks) ? partial.textBlocks.map(block => ({ ...block })) : [],
    sourceText: typeof partial.sourceText === 'string' ? partial.sourceText : '',
    meta: {
      revision: 0,
      exportReady: true,
      autosavedAt: null,
      ...(partial.meta || {})
    }
  }
}

export function createDocument({ id = null, title = '', mode = 'flowchart', content = {}, createdAt = null, updatedAt = null } = {}) {
  return {
    id,
    title: title || defaultTitleForMode(mode),
    mode,
    content: createDocumentContent({ ...content, mode }),
    createdAt,
    updatedAt
  }
}

export function normalizeDocument(input = {}) {
  const mode = DOCUMENT_MODES.includes(input.mode) ? input.mode : 'flowchart'
  const document = createDocument({
    id: input.id ?? null,
    title: typeof input.title === 'string' ? input.title.trim() : '',
    mode,
    content: input.content || {},
    createdAt: input.createdAt ?? null,
    updatedAt: input.updatedAt ?? null
  })

  document.content.layers = ensureLayers(document.content.layers, mode)
  document.content.nodes = document.content.nodes.map(node => ({
    width: 160,
    height: 64,
    layerId: DEFAULT_LAYER_ID,
    ...node,
    style: normalizeNodeStyle(node.style)
  }))
  document.content.edges = document.content.edges.map(edge => ({
    layerId: 'layer-edges',
    ...edge,
    style: normalizeEdgeStyle(edge.style)
  }))

  return document
}

export function validateDocument(input) {
  const errors = []
  if (!input || typeof input !== 'object') {
    return { valid: false, errors: ['文档不能为空'] }
  }

  if (typeof input.title !== 'string' || !input.title.trim()) {
    errors.push('文档标题不能为空')
  }
  if (!DOCUMENT_MODES.includes(input.mode)) {
    errors.push('文档模式无效')
  }
  if (!input.content || typeof input.content !== 'object') {
    errors.push('文档内容不能为空')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

export function createNode({ id, kind = 'process', x = 120, y = 120, width = 160, height = 64, text = '新节点', layerId = DEFAULT_LAYER_ID, style = {} } = {}) {
  return {
    id: id || `node-${Date.now()}`,
    kind,
    x,
    y,
    width,
    height,
    text,
    layerId,
    style: normalizeNodeStyle(style)
  }
}

export function defaultTitleForMode(mode) {
  const labelMap = {
    flowchart: '未命名流程图',
    mindmap: '未命名思维导图',
    markdown: '未命名 Markdown 文档',
    'mind-note': '未命名思维笔记'
  }
  return labelMap[mode] || labelMap.flowchart
}

function ensureLayers(layers, mode = 'flowchart') {
  if (!Array.isArray(layers) || !layers.length) {
    return createDefaultLayers(mode)
  }

  const normalizedLayers = layers.map((layer, index) => ({
    id: layer.id || `layer-${index + 1}`,
    name: layer.name || `图层 ${index + 1}`,
    visible: layer.visible !== false,
    locked: Boolean(layer.locked),
    order: Number.isFinite(layer.order) ? layer.order : index
  }))

  const existingLayerIds = new Set(normalizedLayers.map(layer => layer.id))
  const missingDefaultLayers = createDefaultLayers(mode)
    .filter(layer => !existingLayerIds.has(layer.id))
    .map(layer => ({ ...layer }))

  return [...normalizedLayers, ...missingDefaultLayers]
    .sort((left, right) => left.order - right.order)
}

export { DEFAULT_LAYER_ID }