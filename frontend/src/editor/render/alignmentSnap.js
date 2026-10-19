// 对齐/等距/缩放吸附的纯计算部分（不依赖 Vue / DOM，便于单测）
//
// 约定：
//   rectLike = { left, right, top, bottom, centerX, centerY, width, height }
//   返回的 delta 为「需要给移动对象施加的位移」

function boxOf(node) {
  return {
    id: node.id,
    left: node.x,
    right: node.x + node.width,
    top: node.y,
    bottom: node.y + node.height,
    centerX: node.x + node.width / 2,
    centerY: node.y + node.height / 2
  }
}

/**
 * 等间距吸附：移动块位于两个同级节点之间且两侧间距接近时，返回让间距相等的位移。
 * 返回 null 表示没有命中。
 */
export function findEqualSpacing({ box, others = [], threshold = 8 } = {}) {
  if (!box) {
    return null
  }

  // 横向：A 在左，B 在右
  const row = others.filter(node => Math.abs((node.y + node.height / 2) - box.centerY) < 60)
  let bestRow = null
  row.forEach(a => {
    if (a.x + a.width > box.left - 1) {
      return
    }
    row.forEach(b => {
      if (b.id === a.id || b.x < box.right + 1) {
        return
      }
      const gapLeft = box.left - (a.x + a.width)
      const gapRight = b.x - box.right
      const diff = Math.abs(gapLeft - gapRight)
      if (diff <= threshold && (!bestRow || diff < bestRow.diff)) {
        bestRow = { a, b, diff }
      }
    })
  })

  if (bestRow) {
    const span = bestRow.b.x - (bestRow.a.x + bestRow.a.width)
    const targetLeft = bestRow.a.x + bestRow.a.width + (span - box.width) / 2
    const gap = Math.round(bestRow.b.x - targetLeft - box.width)
    return {
      axis: 'x',
      delta: targetLeft - box.left,
      gap,
      guides: [
        { x1: bestRow.a.x + bestRow.a.width, y1: box.centerY, x2: targetLeft, y2: box.centerY, spacing: true },
        {
          x1: targetLeft + box.width,
          y1: box.centerY,
          x2: bestRow.b.x,
          y2: box.centerY,
          spacing: true,
          label: String(gap),
          labelX: (targetLeft + box.width + bestRow.b.x) / 2,
          labelY: box.centerY - 8
        }
      ]
    }
  }

  // 横向·追加到已有序列末尾：让新块与最后两块的间距相等
  const rowLeft = row.filter(node => node.x + node.width < box.left - 1)
  if (rowLeft.length >= 2) {
    const sorted = [...rowLeft].sort((a, b) => (a.x + a.width) - (b.x + b.width))
    const prev = sorted[sorted.length - 1]
    const prevPrev = sorted[sorted.length - 2]
    const gapPrev = prev.x - (prevPrev.x + prevPrev.width)
    const gapMoving = box.left - (prev.x + prev.width)
    if (Math.abs(gapPrev - gapMoving) <= threshold) {
      const targetLeft = prev.x + prev.width + gapPrev
      const gap = Math.round(gapPrev)
      return {
        axis: 'x',
        delta: targetLeft - box.left,
        gap,
        guides: [
          {
            x1: targetLeft, y1: box.centerY, x2: box.left + (targetLeft - box.left), y2: box.centerY,
            spacing: true, label: String(gap), labelX: (prev.x + prev.width + targetLeft) / 2, labelY: box.centerY - 8
          }
        ]
      }
    }
  }

  // 纵向：A 在上，B 在下
  const column = others.filter(node => Math.abs((node.x + node.width / 2) - box.centerX) < 60)
  let bestColumn = null
  column.forEach(a => {
    if (a.y + a.height > box.top - 1) {
      return
    }
    column.forEach(b => {
      if (b.id === a.id || b.y < box.bottom + 1) {
        return
      }
      const gapTop = box.top - (a.y + a.height)
      const gapBottom = b.y - box.bottom
      const diff = Math.abs(gapTop - gapBottom)
      if (diff <= threshold && (!bestColumn || diff < bestColumn.diff)) {
        bestColumn = { a, b, diff }
      }
    })
  })

  if (bestColumn) {
    const span = bestColumn.b.y - (bestColumn.a.y + bestColumn.a.height)
    const targetTop = bestColumn.a.y + bestColumn.a.height + (span - box.height) / 2
    const gap = Math.round(bestColumn.b.y - targetTop - box.height)
    return {
      axis: 'y',
      delta: targetTop - box.top,
      gap,
      guides: [
        { x1: box.centerX, y1: bestColumn.a.y + bestColumn.a.height, x2: box.centerX, y2: targetTop, spacing: true },
        {
          x1: box.centerX,
          y1: targetTop + box.height,
          x2: box.centerX,
          y2: bestColumn.b.y,
          spacing: true,
          label: String(gap),
          labelX: box.centerX + 14,
          labelY: (targetTop + box.height + bestColumn.b.y) / 2 + 4
        }
      ]
    }
  }

  return null
}

/**
 * 调整大小时的边缘吸附：把被拖动的边对齐到其它节点的左/中/右或上/中/下。
 * 返回 { rect, guides }。
 */
export function snapResizeRect({ rect, direction = '', others = [], threshold = 8, minSize = 24 } = {}) {
  const next = { ...rect }
  const guides = []

  const snapEdge = (edgeValue, values) => {
    let best = null
    values.forEach(({ value, node }) => {
      const distance = value - edgeValue
      if (Math.abs(distance) <= threshold && (!best || Math.abs(distance) < Math.abs(best.distance))) {
        best = { distance, line: value, node }
      }
    })
    return best
  }

  const xCandidates = others.flatMap(node => ([
    { value: node.x, node },
    { value: node.x + node.width / 2, node },
    { value: node.x + node.width, node }
  ]))
  const yCandidates = others.flatMap(node => ([
    { value: node.y, node },
    { value: node.y + node.height / 2, node },
    { value: node.y + node.height, node }
  ]))

  if (direction.includes('e')) {
    const best = snapEdge(next.x + next.width, xCandidates)
    if (best) {
      next.width = Math.max(minSize, next.width + best.distance)
      guides.push({
        x1: best.line,
        y1: Math.min(next.y, best.node.y) - 24,
        x2: best.line,
        y2: Math.max(next.y + next.height, best.node.y + best.node.height) + 24
      })
    }
  }

  if (direction.includes('w')) {
    const best = snapEdge(next.x, xCandidates)
    if (best) {
      next.x += best.distance
      next.width = Math.max(minSize, next.width - best.distance)
      guides.push({
        x1: best.line,
        y1: Math.min(next.y, best.node.y) - 24,
        x2: best.line,
        y2: Math.max(next.y + next.height, best.node.y + best.node.height) + 24
      })
    }
  }

  if (direction.includes('s')) {
    const best = snapEdge(next.y + next.height, yCandidates)
    if (best) {
      next.height = Math.max(minSize, next.height + best.distance)
      guides.push({
        x1: Math.min(next.x, best.node.x) - 24,
        y1: best.line,
        x2: Math.max(next.x + next.width, best.node.x + best.node.width) + 24,
        y2: best.line
      })
    }
  }

  if (direction.includes('n')) {
    const best = snapEdge(next.y, yCandidates)
    if (best) {
      next.y += best.distance
      next.height = Math.max(minSize, next.height - best.distance)
      guides.push({
        x1: Math.min(next.x, best.node.x) - 24,
        y1: best.line,
        x2: Math.max(next.x + next.width, best.node.x + best.node.width) + 24,
        y2: best.line
      })
    }
  }

  return { rect: next, guides }
}

/** 把节点数组转成 box（供 findEqualSpacing 使用） */
export function toBoxes(nodes = []) {
  return nodes.map(boxOf)
}

/**
 * 容器 / 泳道内的内边距吸附：拖动块在容器内部时，把它的边或中心对齐到
 * 容器的内边距线 / 中线，避免贴着边框。
 * 返回 { dx, dy, guides } 或 null。
 */
export function findContainerSnap({ box, containers = [], padding = 24, threshold = 8 } = {}) {
  if (!box || !containers.length) {
    return null
  }

  let best = null

  containers.forEach(container => {
    const insideX = box.centerX > container.x && box.centerX < container.x + container.width
    const insideY = box.centerY > container.y && box.centerY < container.y + container.height
    if (!insideX || !insideY) {
      return
    }

    const innerLeft = container.x + padding
    const innerRight = container.x + container.width - padding
    const innerTop = container.y + padding
    const innerBottom = container.y + container.height - padding

    const xCandidates = [
      { value: innerLeft, edge: 'left' },
      { value: (innerLeft + innerRight) / 2, edge: 'centerX' },
      { value: innerRight, edge: 'right' }
    ]
    const yCandidates = [
      { value: innerTop, edge: 'top' },
      { value: (innerTop + innerBottom) / 2, edge: 'centerY' },
      { value: innerBottom, edge: 'bottom' }
    ]

    xCandidates.forEach(candidate => {
      const current = candidate.edge === 'left'
        ? box.left
        : (candidate.edge === 'right' ? box.right : box.centerX)
      const distance = candidate.value - current
      if (Math.abs(distance) <= threshold && (!best || Math.abs(distance) < Math.abs(best.dx))) {
        best = {
          dx: distance,
          dy: best?.dy || 0,
          guides: [{
            x1: candidate.value,
            y1: container.y,
            x2: candidate.value,
            y2: container.y + container.height,
            container: true
          }]
        }
      }
    })

    yCandidates.forEach(candidate => {
      const current = candidate.edge === 'top'
        ? box.top
        : (candidate.edge === 'bottom' ? box.bottom : box.centerY)
      const distance = candidate.value - current
      if (Math.abs(distance) <= threshold && (!best || Math.abs(distance) < Math.abs(best.dy))) {
        best = {
          dx: best?.dx || 0,
          dy: distance,
          guides: [...(best?.guides || []), {
            x1: container.x,
            y1: candidate.value,
            x2: container.x + container.width,
            y2: candidate.value,
            container: true
          }]
        }
      }
    })
  })

  return best
}
