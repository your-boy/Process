import { buildMindmapTree, findRootNode } from '../modes/mindmap'

const HORIZONTAL_GAP = 220
const VERTICAL_GAP = 84

export function layoutMindmap(nodes = []) {
  if (!nodes.length) {
    return []
  }

  const clonedNodes = nodes.map(node => ({ ...node }))
  const nodeMap = new Map(clonedNodes.map(node => [node.id, node]))
  const tree = buildMindmapTree(clonedNodes)
  const root = findRootNode(clonedNodes)
  let nextLeafY = 220

  function place(nodeId, depth) {
    const node = nodeMap.get(nodeId)
    if (!node) {
      return 0
    }

    const children = tree.get(nodeId) || []
    const offsetX = Number(node.offsetX) || 0
    const offsetY = Number(node.offsetY) || 0
    node.x = 180 + depth * HORIZONTAL_GAP + offsetX

    if (!children.length) {
      node.y = nextLeafY + offsetY
      nextLeafY += VERTICAL_GAP
      return node.y
    }

    const centers = children.map(childId => place(childId, depth + 1))
    node.y = ((centers[0] + centers[centers.length - 1]) / 2) + offsetY
    return node.y
  }

  place(root?.id, 0)
  if (root) {
    root.x = 180 + (Number(root.offsetX) || 0)
    root.y = 320 + (Number(root.offsetY) || 0)
  }

  return clonedNodes
}

export function calculateP95(samples = []) {
  if (!samples.length) {
    return 0
  }
  const sorted = [...samples].sort((left, right) => left - right)
  const index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1)
  return sorted[index]
}