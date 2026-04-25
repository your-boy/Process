import { createDocument, createNode, normalizeEdgeStyle } from '../model/document'

export function createMindmapDocument() {
  const document = createDocument({
    mode: 'mindmap',
    title: '未命名思维导图'
  })

  document.content.nodes = [
    createMindmapNode({
      id: 'topic-root',
      text: '中心主题',
      x: 180,
      y: 320
    })
  ]
  syncMindmapEdges(document)
  return document
}

export function createMindmapNode({ id, parentId, text = '新分支', x = 0, y = 0, collapsed = false, offsetX = 0, offsetY = 0, style } = {}) {
  return {
    ...createNode({
      id,
      kind: 'topic',
      x,
      y,
      width: 176,
      height: 56,
      text,
      layerId: 'layer-nodes',
      style: style || (parentId
        ? { accent: 'teal', theme: 'aurora', elevation: 'soft' }
        : { accent: 'blue', theme: 'aurora', elevation: 'glow' })
    }),
    parentId,
    collapsed,
    offsetX,
    offsetY
  }
}

export function buildMindmapTree(nodes = []) {
  const tree = new Map()
  nodes.forEach(node => {
    if (!node.parentId) {
      return
    }
    const children = tree.get(node.parentId) || []
    children.push(node.id)
    tree.set(node.parentId, children)
  })
  return tree
}

export function syncMindmapEdges(document) {
  const existingEdges = new Map(
    (document.content.edges || []).map(edge => [`${edge.fromNodeId}->${edge.toNodeId}`, edge])
  )

  document.content.edges = document.content.nodes
    .filter(node => node.parentId)
    .map(node => {
      const connectionKey = `${node.parentId}->${node.id}`
      const existingEdge = existingEdges.get(connectionKey)

      return {
        id: existingEdge?.id || `mind-edge-${node.id}`,
        fromNodeId: node.parentId,
        toNodeId: node.id,
        fromAnchor: 'right',
        toAnchor: 'left',
        layerId: 'layer-edges',
        label: existingEdge?.label || '',
        style: normalizeEdgeStyle({
          route: 'curve',
          marker: 'none',
          ...(existingEdge?.style || {})
        })
      }
    })
}

export function findRootNode(nodes = []) {
  return nodes.find(node => !node.parentId) || null
}

export function collectHiddenNodeIds(nodes = []) {
  const tree = buildMindmapTree(nodes)
  const hidden = new Set()

  function collect(nodeId) {
    const children = tree.get(nodeId) || []
    children.forEach(childId => {
      hidden.add(childId)
      collect(childId)
    })
  }

  nodes.forEach(node => {
    if (node.collapsed) {
      collect(node.id)
    }
  })

  return [...hidden]
}