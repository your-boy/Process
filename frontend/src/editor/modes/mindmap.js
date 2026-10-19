import { createDocument, createNode, normalizeEdgeStyle } from '../model/document'
import { normalizeMindmapLayout } from '../model/mindmapMeta'

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

export function createMindmapNode({ id, parentId, text = '新分支', x = 0, y = 0, collapsed = false, floating = false, offsetX = 0, offsetY = 0, style } = {}) {
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
    ...(floating ? { floating: true } : {}),
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
  const layout = normalizeMindmapLayout(document.content?.layout)
  const anchors = directionAnchors(layout.direction)
  const branchRoute = layout.direction === 'fishbone'
    ? 'straight'
    : (layout.branchStyle === 'elbow'
        ? 'orthogonal'
        : (layout.branchStyle === 'straight' ? 'straight' : 'curve'))
  const sourceEdges = document.content.edges || []
  const existingEdges = new Map(
    sourceEdges
      .filter(edge => edge.kind !== 'relationship')
      .map(edge => [`${edge.fromNodeId}->${edge.toNodeId}`, edge])
  )

  const nodeMap = new Map(document.content.nodes.map(node => [node.id, node]))
  const useRelativeAnchors = ['balanced', 'timeline', 'fishbone'].includes(layout.direction)

  const branchEdges = document.content.nodes
    .filter(node => node.parentId)
    .map(node => {
      const connectionKey = `${node.parentId}->${node.id}`
      const existingEdge = existingEdges.get(connectionKey)
      const pair = useRelativeAnchors
        ? resolveRelationshipAnchors(nodeMap.get(node.parentId), nodeMap.get(node.id))
        : anchors

      return {
        id: existingEdge?.id || `mind-edge-${node.id}`,
        fromNodeId: node.parentId,
        toNodeId: node.id,
        fromAnchor: pair.from,
        toAnchor: pair.to,
        layerId: 'layer-edges',
        label: existingEdge?.label || '',
        style: normalizeEdgeStyle({
          ...(existingEdge?.style || {}),
          route: branchRoute,
          marker: 'none'
        })
      }
    })

  const relationshipEdges = sourceEdges
    .filter(edge => edge.kind === 'relationship')
    .filter(edge => nodeMap.has(edge.fromNodeId) && nodeMap.has(edge.toNodeId))
    .map(edge => {
      const pair = resolveRelationshipAnchors(nodeMap.get(edge.fromNodeId), nodeMap.get(edge.toNodeId))
      return {
        ...edge,
        fromAnchor: pair.from,
        toAnchor: pair.to,
        style: normalizeEdgeStyle({
          route: 'curve',
          stroke: 'dashed',
          marker: 'arrow',
          ...(edge.style || {})
        })
      }
    })

  document.content.edges = [...branchEdges, ...relationshipEdges]
}

export function directionAnchors(direction) {
  if (direction === 'left') {
    return { from: 'left', to: 'right' }
  }
  if (direction === 'down') {
    return { from: 'bottom', to: 'top' }
  }
  return { from: 'right', to: 'left' }
}

export function resolveRelationshipAnchors(fromNode, toNode) {
  if (!fromNode || !toNode) {
    return { from: 'right', to: 'left' }
  }

  const fromCenterX = fromNode.x + fromNode.width / 2
  const fromCenterY = fromNode.y + fromNode.height / 2
  const toCenterX = toNode.x + toNode.width / 2
  const toCenterY = toNode.y + toNode.height / 2
  const deltaX = toCenterX - fromCenterX
  const deltaY = toCenterY - fromCenterY

  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    return deltaX >= 0 ? { from: 'right', to: 'left' } : { from: 'left', to: 'right' }
  }
  return deltaY >= 0 ? { from: 'bottom', to: 'top' } : { from: 'top', to: 'bottom' }
}

export function collectSubtreeIds(nodes = [], rootId) {
  const tree = buildMindmapTree(nodes)
  const ids = []
  if (!rootId) {
    return ids
  }

  function collect(nodeId) {
    ids.push(nodeId)
    ;(tree.get(nodeId) || []).forEach(childId => collect(childId))
  }

  collect(rootId)
  return ids
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