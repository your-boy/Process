export const ANCHOR_SIDES = ['top', 'right', 'bottom', 'left']

const OBSTACLE_PADDING = 12

export function getAnchorPoint(node, side) {
  if (!node) {
    return { x: 0, y: 0 }
  }

  let point
  switch (side) {
    case 'top':
      point = { x: node.x + node.width / 2, y: node.y }
      break
    case 'right':
      point = { x: node.x + node.width, y: node.y + node.height / 2 }
      break
    case 'bottom':
      point = { x: node.x + node.width / 2, y: node.y + node.height }
      break
    case 'left':
    default:
      point = { x: node.x, y: node.y + node.height / 2 }
      break
  }

  const rotation = Number(node.rotation) || 0
  if (!rotation) {
    return point
  }

  // 锚点随图形绕中心旋转
  const cx = node.x + node.width / 2
  const cy = node.y + node.height / 2
  const angle = (rotation * Math.PI) / 180
  const dx = point.x - cx
  const dy = point.y - cy
  return {
    x: cx + dx * Math.cos(angle) - dy * Math.sin(angle),
    y: cy + dx * Math.sin(angle) + dy * Math.cos(angle)
  }
}

export function getEdgeWaypoints(edge) {
  const waypoints = edge?.style?.waypoints
  if (!Array.isArray(waypoints)) {
    return []
  }

  return waypoints
    .filter(point => point && Number.isFinite(point.x) && Number.isFinite(point.y))
    .map(point => ({ x: point.x, y: point.y }))
}

function dedupe(points) {
  return points.filter((point, index, list) => (
    index === 0 || point.x !== list[index - 1].x || point.y !== list[index - 1].y
  ))
}

function withElbows(points) {
  if (points.length < 2) {
    return points
  }

  const result = [points[0]]

  for (let index = 1; index < points.length; index += 1) {
    const previous = result[result.length - 1]
    const next = points[index]

    if (previous.x !== next.x && previous.y !== next.y) {
      const horizontalFirst = Math.abs(next.x - previous.x) >= Math.abs(next.y - previous.y)
      result.push(horizontalFirst ? { x: next.x, y: previous.y } : { x: previous.x, y: next.y })
    }

    result.push(next)
  }

  return dedupe(result)
}

function segmentCrossesRect(from, to, rect, padding = 0) {
  const left = rect.x - padding
  const right = rect.x + rect.width + padding
  const top = rect.y - padding
  const bottom = rect.y + rect.height + padding

  if (from.y === to.y) {
    const y = from.y
    if (y < top || y > bottom) {
      return false
    }
    const minX = Math.min(from.x, to.x)
    const maxX = Math.max(from.x, to.x)
    return maxX > left && minX < right
  }

  if (from.x === to.x) {
    const x = from.x
    if (x < left || x > right) {
      return false
    }
    const minY = Math.min(from.y, to.y)
    const maxY = Math.max(from.y, to.y)
    return maxY > top && minY < bottom
  }

  return false
}

function countCrossings(points, obstacles) {
  let crossings = 0
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1]
    const to = points[index]
    obstacles.forEach(rect => {
      if (segmentCrossesRect(from, to, rect, OBSTACLE_PADDING)) {
        crossings += 1
      }
    })
  }
  return crossings
}

function pathLength(points) {
  let total = 0
  for (let index = 1; index < points.length; index += 1) {
    total += Math.abs(points[index].x - points[index - 1].x) + Math.abs(points[index].y - points[index - 1].y)
  }
  return total
}

function collectObstacles(edge, nodes) {
  return nodes
    .filter(node => node.id !== edge.fromNodeId && node.id !== edge.toNodeId)
    .map(node => ({ x: node.x, y: node.y, width: node.width, height: node.height }))
}

// Builds a few orthogonal candidates and keeps the one that crosses the fewest
// nodes; ties go to the shortest route.
function routeWithObstacles(start, end, obstacles) {
  const candidates = []
  const push = points => candidates.push(dedupe(points))

  push([start, { x: end.x, y: start.y }, end])
  push([start, { x: start.x, y: end.y }, end])

  const midX = (start.x + end.x) / 2
  const midY = (start.y + end.y) / 2
  push([start, { x: midX, y: start.y }, { x: midX, y: end.y }, end])
  push([start, { x: start.x, y: midY }, { x: end.x, y: midY }, end])

  if (obstacles.length) {
    const bounds = obstacles.reduce((acc, rect) => ({
      left: Math.min(acc.left, rect.x),
      right: Math.max(acc.right, rect.x + rect.width),
      top: Math.min(acc.top, rect.y),
      bottom: Math.max(acc.bottom, rect.y + rect.height)
    }), { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity })

    const above = bounds.top - 40
    const below = bounds.bottom + 40
    const leftOf = bounds.left - 40
    const rightOf = bounds.right + 40

    push([start, { x: start.x, y: above }, { x: end.x, y: above }, end])
    push([start, { x: start.x, y: below }, { x: end.x, y: below }, end])
    push([start, { x: leftOf, y: start.y }, { x: leftOf, y: end.y }, end])
    push([start, { x: rightOf, y: start.y }, { x: rightOf, y: end.y }, end])
  }

  const scored = candidates.map(points => ({
    points,
    crossings: countCrossings(points, obstacles),
    length: pathLength(points)
  }))

  scored.sort((a, b) => (a.crossings - b.crossings) || (a.length - b.length))
  return scored[0].points
}

export function routeOrthogonalEdge(edge, nodes) {
  const fromNode = nodes.find(node => node.id === edge.fromNodeId)
  const toNode = nodes.find(node => node.id === edge.toNodeId)
  const start = getAnchorPoint(fromNode, edge.fromAnchor)
  const end = getAnchorPoint(toNode, edge.toAnchor)
  const waypoints = getEdgeWaypoints(edge)

  if (waypoints.length) {
    return dedupe(withElbows([start, ...waypoints, end]))
  }

  return routeWithObstacles(start, end, collectObstacles(edge, nodes))
}

export function routeStraightEdge(edge, nodes) {
  const fromNode = nodes.find(node => node.id === edge.fromNodeId)
  const toNode = nodes.find(node => node.id === edge.toNodeId)
  return dedupe([
    getAnchorPoint(fromNode, edge.fromAnchor),
    ...getEdgeWaypoints(edge),
    getAnchorPoint(toNode, edge.toAnchor)
  ])
}

// 快速路由：只做中点折弯，不做遮挡评分。拖拽/大文档时使用。
export function routeFastEdge(edge, nodes) {
  const fromNode = nodes.find(node => node.id === edge.fromNodeId)
  const toNode = nodes.find(node => node.id === edge.toNodeId)
  const start = getAnchorPoint(fromNode, edge.fromAnchor)
  const end = getAnchorPoint(toNode, edge.toAnchor)
  const waypoints = getEdgeWaypoints(edge)

  if (waypoints.length) {
    return dedupe(withElbows([start, ...waypoints, end]))
  }

  const horizontalBias = Math.abs(start.x - end.x) >= Math.abs(start.y - end.y)
  const midX = horizontalBias ? (start.x + end.x) / 2 : start.x
  const midY = horizontalBias ? end.y : (start.y + end.y) / 2
  return dedupe([
    start,
    { x: midX, y: horizontalBias ? start.y : midY },
    { x: horizontalBias ? midX : end.x, y: midY },
    end
  ])
}

export function routeEdge(edge, nodes, options = {}) {
  const route = edge?.style?.route || 'orthogonal'
  if (route === 'straight' || route === 'curve') {
    return routeStraightEdge(edge, nodes)
  }
  if (options.fast) {
    return routeFastEdge(edge, nodes)
  }
  return routeOrthogonalEdge(edge, nodes)
}

export function buildEdgePath(points, style = {}) {
  if (!points.length) {
    return ''
  }

  const hasWaypoints = Array.isArray(style?.waypoints) && style.waypoints.length > 0

  if (style.route === 'curve' && points.length >= 2 && !hasWaypoints) {
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

export function getSegmentMidpoints(points) {
  const midpoints = []
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1]
    const to = points[index]
    midpoints.push({
      index,
      x: (from.x + to.x) / 2,
      y: (from.y + to.y) / 2,
      horizontal: from.y === to.y
    })
  }
  return midpoints
}
