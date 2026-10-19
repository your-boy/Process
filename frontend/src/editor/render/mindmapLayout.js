import { buildMindmapTree, findRootNode } from '../modes/mindmap'
import { resolveTopicTextLayout } from './mindmapText'

const HORIZONTAL_GAP = 64
const MIN_VERTICAL_GAP = 26
// 向下（组织结构）布局：行间距与列间距
const MIN_ROW_GAP = 30
const COLUMN_GAP = 46
const ORIGIN_X = 180
const ORIGIN_Y = 200

export function layoutMindmap(nodes = [], layout = {}, options = {}) {
  if (!nodes.length) {
    return []
  }

  const direction = ['left', 'down', 'balanced', 'tree', 'timeline', 'fishbone'].includes(layout?.direction)
    ? layout.direction
    : 'right'

  const clonedNodes = nodes.map(node => {
    const sizing = resolveTopicTextLayout(node)
    return { ...node, width: sizing.width, height: sizing.height }
  })
  const nodeMap = new Map(clonedNodes.map(node => [node.id, node]))
  const tree = buildMindmapTree(clonedNodes)
  const root = clonedNodes.find(node => !node.parentId && node.floating !== true) || findRootNode(clonedNodes)
  const rowOffsets = new Map()
  let maxDepth = 0

  // 浮动主题不参与树布局，保留自己的坐标（没有坐标时停靠在画布下方）
  const floatingNodes = clonedNodes.filter(node => node.floating === true)
  floatingNodes.forEach((node, index) => {
    if (!Number.isFinite(Number(node.x))) {
      node.x = ORIGIN_X + (index % 3) * 240
    }
    if (!Number.isFinite(Number(node.y))) {
      node.y = 520 + Math.floor(index / 3) * 100
    }
  })

  if (!root) {
    return clonedNodes
  }

  const depths = new Map()
  const queue = [{ id: root.id, depth: 0 }]
  while (queue.length) {
    const { id, depth } = queue.shift()
    if (depths.has(id)) {
      continue
    }
    depths.set(id, depth)
    maxDepth = Math.max(maxDepth, depth)
    ;(tree.get(id) || []).forEach(childId => queue.push({ id: childId, depth: depth + 1 }))
  }

  if (direction === 'down') {
    placeDown()
  } else if (direction === 'timeline') {
    placeTimeline()
  } else if (direction === 'fishbone') {
    placeFishbone()
  } else {
    placeHorizontal(direction === 'tree')
  }

  if (root) {
    if (direction === 'down') {
      root.y = (rowOffsets.get(0) ?? ORIGIN_Y) + (Number(root.offsetY) || 0)
    } else if (direction === 'right' || direction === 'left' || direction === 'balanced') {
      root.y = 320 + (Number(root.offsetY) || 0)
    }
  }

  if (direction === 'left') {
    // 以整张图最右边界为镜面做水平翻转，中心主题落在最右侧
    const maxRight = Math.max(...clonedNodes
      .filter(node => node.floating !== true)
      .map(node => node.x + node.width))
    clonedNodes.forEach(node => {
      if (node.floating === true) {
        return
      }
      node.x = ORIGIN_X + maxRight - (node.x + node.width)
    })
  }

  // 双向布局：一级分支一半放右、一半镜像到左，整张图水平居中
  if (direction === 'balanced') {
    const rootChildren = tree.get(root.id) || []
    const leftIds = new Set()

    function collectLeft(nodeId) {
      leftIds.add(nodeId)
      ;(tree.get(nodeId) || []).forEach(collectLeft)
    }

    rootChildren.forEach((childId, index) => {
      if (index % 2 === 1) {
        collectLeft(childId)
      }
    })

    const centerX = root.x + root.width / 2
    clonedNodes.forEach(node => {
      if (node.floating === true || !leftIds.has(node.id)) {
        return
      }
      node.x = 2 * centerX - (node.x + node.width)
    })

    const layoutNodes = clonedNodes.filter(node => node.floating !== true)
    const minX = Math.min(...layoutNodes.map(node => node.x))
    const maxX = Math.max(...layoutNodes.map(node => node.x + node.width))
    const width = Number(options?.width) || 1200
    const shift = Math.max(ORIGIN_X - minX, (width - (maxX - minX)) / 2 - minX)
    clonedNodes.forEach(node => {
      if (node.floating !== true) {
        node.x += shift
      }
    })
  }

  return clonedNodes

  function placeHorizontal(alignTop = false) {
    // 每层按该层最宽节点推进，避免宽主题互相压住
    const maxWidthByDepth = new Map()
    clonedNodes.forEach(node => {
      if (node.floating === true) {
        return
      }
      const depth = depths.get(node.id) ?? 0
      maxWidthByDepth.set(depth, Math.max(maxWidthByDepth.get(depth) ?? 0, node.width))
    })

    const columnX = new Map()
    let cursorX = ORIGIN_X
    for (let depth = 0; depth <= maxDepth; depth += 1) {
      columnX.set(depth, cursorX)
      cursorX += (maxWidthByDepth.get(depth) ?? 160) + HORIZONTAL_GAP
    }

    let nextLeaf = 240

    function place(nodeId, depth) {
      const node = nodeMap.get(nodeId)
      if (!node) {
        return 0
      }

      const children = tree.get(nodeId) || []
      const offsetX = Number(node.offsetX) || 0
      const offsetY = Number(node.offsetY) || 0

      if (!children.length) {
        node.y = nextLeaf + offsetY
        nextLeaf += node.height + MIN_VERTICAL_GAP
        node.x = (columnX.get(depth) ?? ORIGIN_X) + offsetX
        return node.y
      }

      // 子节点手动拖动后的 offset 只影响子节点自身；父节点仍按未偏移的自动布局居中，
      // 否则拖一个叶子主题会把整条父分支和连线一起带走。
      const centers = children.map(childId => {
        const center = place(childId, depth + 1)
        const child = nodeMap.get(childId)
        return center - (Number(child?.offsetY) || 0)
      })
      node.x = (columnX.get(depth) ?? ORIGIN_X) + offsetX
      // 树状图：父主题与第一个子主题顶部对齐，形成纵向主干
      node.y = (alignTop ? centers[0] : ((centers[0] + centers[centers.length - 1]) / 2)) + offsetY
      return node.y
    }

    place(root.id, 0)
  }

  // 时间轴：中心主题在左，一级分支沿水平轴线交替上下排布，后代向外侧展开
  function placeTimeline() {
    const axisY = 360
    const START_X = 320
    const pageWidth = Number(options?.width) || 1200
    const pageHeight = Number(options?.height) || 720
    const branchCount = Math.max(1, (tree.get(root.id) || []).length)
    // 分支间距随画布宽度自适应，避免最后一个分支被右侧裁掉
    const BRANCH_GAP = Math.max(180, Math.min(300, (pageWidth - START_X - 120) / Math.max(1, branchCount - 1)))

    root.x = 70
    root.y = axisY - root.height / 2

    ;(tree.get(root.id) || []).forEach((branchId, index) => {
      const branch = nodeMap.get(branchId)
      if (!branch) {
        return
      }
      const side = index % 2 === 0 ? -1 : 1
      branch.x = START_X + index * BRANCH_GAP
      branch.y = axisY + side * 90 - branch.height / 2
      const baseX = branch.x
      let cursor = axisY + side * 200

      function placeDescendants(parentId, depth) {
        ;(tree.get(parentId) || []).forEach(childId => {
          const child = nodeMap.get(childId)
          if (!child) {
            return
          }
          child.x = baseX + depth * 148
          child.y = cursor - (side < 0 ? child.height : 0)
          cursor += side * (child.height + 18)
          placeDescendants(childId, depth + 1)
        })
      }

      if ((tree.get(branchId) || []).length) {
        placeDescendants(branchId, 1)
      }
    })

    // 时间轴内容可能超出画布：整体平移/等比压缩坐标，保证都落在可视区域内
    fitIntoPage()
  }

  // 鱼骨图：中心主题在左，一级分支作为「主骨」斜向上下展开，子主题沿主骨向外排布
  function placeFishbone() {
    const axisY = 360
    const START_X = 380
    const pageWidth = Number(options?.width) || 1200
    const branchCount = Math.max(1, (tree.get(root.id) || []).length)
    const BRANCH_GAP = Math.max(170, Math.min(260, (pageWidth - START_X - 140) / Math.max(1, branchCount - 1)))

    root.x = 70
    root.y = axisY - root.height / 2

    ;(tree.get(root.id) || []).forEach((branchId, index) => {
      const branch = nodeMap.get(branchId)
      if (!branch) {
        return
      }
      const side = index % 2 === 0 ? -1 : 1
      const level = Math.floor(index / 2)
      branch.x = START_X + index * BRANCH_GAP
      branch.y = axisY + side * (112 + level * 42) - branch.height / 2

      let cursor = 0
      function placeDescendants(parentId, depth) {
        ;(tree.get(parentId) || []).forEach(childId => {
          const child = nodeMap.get(childId)
          if (!child) {
            return
          }
          cursor += child.height + 16
          child.x = branch.x + 78 + depth * 118
          child.y = axisY + side * (112 + level * 42 + 66 + cursor) - (side < 0 ? child.height : 0)
          placeDescendants(childId, depth + 1)
        })
      }

      if ((tree.get(branchId) || []).length) {
        placeDescendants(branchId, 1)
      }
    })

    fitIntoPage()
  }

  // 把整张图平移/等比压缩进画布可视区域（只调整坐标，不改节点尺寸）
  function fitIntoPage() {
    const pageWidth = Number(options?.width) || 1200
    const pageHeight = Number(options?.height) || 720
    const layoutNodes = clonedNodes.filter(node => node.floating !== true)
    const minX = Math.min(...layoutNodes.map(node => node.x))
    const maxX = Math.max(...layoutNodes.map(node => node.x + node.width))
    const minY = Math.min(...layoutNodes.map(node => node.y))
    const maxY = Math.max(...layoutNodes.map(node => node.y + node.height))
    const padX = 40
    const padY = 40
    const spanX = Math.max(1, maxX - minX)
    const spanY = Math.max(1, maxY - minY)
    const scale = Math.min(
      1,
      (pageWidth - padX * 2) / spanX,
      (pageHeight - padY * 2) / spanY
    )
    const finalScale = Math.max(0.55, scale)

    layoutNodes.forEach(node => {
      node.x = padX + (node.x - minX) * finalScale
      node.y = padY + (node.y - minY) * finalScale
    })
  }

  function placeDown() {
    const maxHeightByDepth = new Map()
    clonedNodes.forEach(node => {
      if (node.floating === true) {
        return
      }
      const depth = depths.get(node.id) ?? 0
      maxHeightByDepth.set(depth, Math.max(maxHeightByDepth.get(depth) ?? 0, node.height))
    })

    let cursor = ORIGIN_Y
    for (let depth = 0; depth <= maxDepth; depth += 1) {
      rowOffsets.set(depth, cursor)
      cursor += (maxHeightByDepth.get(depth) ?? 60) + MIN_ROW_GAP
    }

    let nextLeaf = ORIGIN_X

    function place(nodeId, depth) {
      const node = nodeMap.get(nodeId)
      if (!node) {
        return 0
      }

      const children = tree.get(nodeId) || []
      const offsetX = Number(node.offsetX) || 0
      const offsetY = Number(node.offsetY) || 0

      if (!children.length) {
        node.x = nextLeaf + offsetX
        nextLeaf += node.width + COLUMN_GAP
        node.y = (rowOffsets.get(depth) ?? ORIGIN_Y) + offsetY
        return node.x + node.width / 2
      }

      // 同横向布局：子节点的手动水平偏移不应带动父节点。
      const centers = children.map(childId => {
        const center = place(childId, depth + 1)
        const child = nodeMap.get(childId)
        return center - (Number(child?.offsetX) || 0)
      })
      node.x = ((centers[0] + centers[centers.length - 1]) / 2) - node.width / 2 + offsetX
      node.y = (rowOffsets.get(depth) ?? ORIGIN_Y) + offsetY
      return node.x + node.width / 2
    }

    place(root.id, 0)
  }
}

export function calculateP95(samples = []) {
  if (!samples.length) {
    return 0
  }
  const sorted = [...samples].sort((left, right) => left - right)
  const index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1)
  return sorted[index]
}
