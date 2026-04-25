export const ANCHOR_SIDES = ['top', 'right', 'bottom', 'left']

export function getAnchorPoint(node, side) {
  if (!node) {
    return { x: 0, y: 0 }
  }

  switch (side) {
    case 'top':
      return { x: node.x + node.width / 2, y: node.y }
    case 'right':
      return { x: node.x + node.width, y: node.y + node.height / 2 }
    case 'bottom':
      return { x: node.x + node.width / 2, y: node.y + node.height }
    case 'left':
    default:
      return { x: node.x, y: node.y + node.height / 2 }
  }
}

export function routeOrthogonalEdge(edge, nodes) {
  const fromNode = nodes.find(node => node.id === edge.fromNodeId)
  const toNode = nodes.find(node => node.id === edge.toNodeId)
  const start = getAnchorPoint(fromNode, edge.fromAnchor)
  const end = getAnchorPoint(toNode, edge.toAnchor)

  const horizontalBias = Math.abs(start.x - end.x) >= Math.abs(start.y - end.y)
  const midX = horizontalBias ? (start.x + end.x) / 2 : start.x
  const midY = horizontalBias ? end.y : (start.y + end.y) / 2
  const secondMidX = horizontalBias ? midX : end.x
  const secondMidY = horizontalBias ? start.y : midY

  const points = [
    start,
    { x: midX, y: secondMidY },
    { x: secondMidX, y: midY },
    end
  ]

  return points.filter((point, index, list) => index === 0 || point.x !== list[index - 1].x || point.y !== list[index - 1].y)
}

export function routeStraightEdge(edge, nodes) {
  const fromNode = nodes.find(node => node.id === edge.fromNodeId)
  const toNode = nodes.find(node => node.id === edge.toNodeId)
  return [
    getAnchorPoint(fromNode, edge.fromAnchor),
    getAnchorPoint(toNode, edge.toAnchor)
  ]
}

export function routeEdge(edge, nodes) {
  const route = edge?.style?.route || 'orthogonal'
  if (route === 'straight' || route === 'curve') {
    return routeStraightEdge(edge, nodes)
  }
  return routeOrthogonalEdge(edge, nodes)
}

export function buildEdgePath(points, style = {}) {
  if (!points.length) {
    return ''
  }

  if ((style.route === 'curve') && points.length >= 2) {
    const start = points[0]
    const end = points[points.length - 1]
    const deltaX = end.x - start.x
    const deltaY = end.y - start.y

    if (Math.abs(deltaX) >= Math.abs(deltaY)) {
      const bend = Math.max(44, Math.abs(deltaX) * 0.35)
      const direction = deltaX >= 0 ? 1 : -1
      return [
        `M ${start.x} ${start.y}`,
        `C ${start.x + (bend * direction)} ${start.y}, ${end.x - (bend * direction)} ${end.y}, ${end.x} ${end.y}`
      ].join(' ')
    }

    const bend = Math.max(44, Math.abs(deltaY) * 0.35)
    const direction = deltaY >= 0 ? 1 : -1
    return [
      `M ${start.x} ${start.y}`,
      `C ${start.x} ${start.y + (bend * direction)}, ${end.x} ${end.y - (bend * direction)}, ${end.x} ${end.y}`
    ].join(' ')
  }

  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
}