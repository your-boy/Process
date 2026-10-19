// 思维笔记文本块的纯函数工具：嵌套（缩进/取消缩进）与块内搜索。
// 这里不依赖 Vue / DOM，方便单测，也方便 useEditorState 直接复用。
//
// 数据约定（与 textBlockLayer 保持一致）：
//   block = { id, nodeId, parentId, order, text, html, ... }
//   - parentId 为 null/空 表示挂在主题下的顶层块
//   - 同级块按 order 升序排列，order 不唯一时按数组顺序兜底

function normalizeParentId(value) {
  return value ? String(value) : null
}

function orderOf(block, fallbackIndex) {
  const value = Number(block?.order)
  return Number.isFinite(value) ? value : fallbackIndex
}

function groupKey(block) {
  return `${block.nodeId || ''}|${normalizeParentId(block.parentId) || ''}`
}

/** 取同一主题、同一父块下的兄弟块（按 order 排序） */
export function siblingBlocks(blocks = [], block) {
  const key = groupKey(block)
  return blocks
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => groupKey(item) === key)
    .sort((left, right) => (
      orderOf(left.item, left.index) - orderOf(right.item, right.index) || left.index - right.index
    ))
    .map(({ item }) => item)
}

/** 重新给每个父级下的兄弟块编号，保证 order 连续（0..n-1） */
export function normalizeSiblingOrders(blocks = []) {
  const buckets = new Map()
  blocks.forEach((block, index) => {
    const key = groupKey(block)
    if (!buckets.has(key)) {
      buckets.set(key, [])
    }
    buckets.get(key).push({ block, index })
  })

  const orderMap = new Map()
  buckets.forEach(list => {
    list
      .sort((left, right) => (
        orderOf(left.block, left.index) - orderOf(right.block, right.index) || left.index - right.index
      ))
      .forEach(({ block }, position) => {
        orderMap.set(block.id, position)
      })
  })

  return blocks.map(block => (
    orderMap.has(block.id) ? { ...block, order: orderMap.get(block.id) } : block
  ))
}

/**
 * 把块降级为「上一个兄弟块」的子块。
 * 没有上一个兄弟块时返回 null（表示不能缩进）。
 */
export function indentNoteBlock(blocks = [], blockId = '') {
  const target = blocks.find(block => block.id === blockId)
  if (!target) {
    return null
  }

  const siblings = siblingBlocks(blocks, target)
  const position = siblings.findIndex(block => block.id === target.id)
  if (position <= 0) {
    return null
  }

  const newParent = siblings[position - 1]
  const nextOrder = siblingBlocks(blocks, { ...target, parentId: newParent.id }).length

  const updated = blocks.map(block => (
    block.id === target.id
      ? { ...block, parentId: newParent.id, order: nextOrder }
      : block
  ))

  return normalizeSiblingOrders(updated)
}

/**
 * 把块升级到祖父级，并排在原父块之后。
 * 已经是顶层块时返回 null（表示不能取消缩进）。
 */
export function outdentNoteBlock(blocks = [], blockId = '') {
  const target = blocks.find(block => block.id === blockId)
  if (!target) {
    return null
  }

  const parentId = normalizeParentId(target.parentId)
  if (!parentId) {
    return null
  }

  const parent = blocks.find(block => block.id === parentId)
  const grandParentId = parent ? normalizeParentId(parent.parentId) : null

  // 直接在「祖父级兄弟列表」里把目标块插到父块后面，再统一重排 order，
  // 这样即使历史 order 有重复/空洞也不会错位。
  const siblings = siblingBlocks(blocks, { nodeId: target.nodeId, parentId: grandParentId })
    .filter(block => block.id !== target.id)
  const parentIndex = siblings.findIndex(block => block.id === parentId)
  const insertAt = parentIndex >= 0 ? parentIndex + 1 : siblings.length
  const reordered = [
    ...siblings.slice(0, insertAt),
    { ...target, parentId: grandParentId },
    ...siblings.slice(insertAt)
  ]

  const orderMap = new Map(reordered.map((block, index) => [block.id, index]))

  return blocks.map(block => {
    if (block.id === target.id) {
      return { ...block, parentId: grandParentId, order: orderMap.get(block.id) }
    }
    if (orderMap.has(block.id)) {
      return { ...block, order: orderMap.get(block.id) }
    }
    return block
  })
}

/**
 * 把一个主题下的块展平成「先序 + 层级」列表，供笔记视图按顺序渲染。
 * 返回 [{ ...block, depth }]，父块不存在时按顶层处理。
 */
export function flattenNodeBlocks(blocks = [], nodeId = '') {
  const scoped = blocks.filter(block => block.nodeId === nodeId)
  const ids = new Set(scoped.map(block => block.id))
  const childrenOf = new Map()

  scoped.forEach((block, index) => {
    const parentId = block.parentId && ids.has(block.parentId) ? block.parentId : ''
    if (!childrenOf.has(parentId)) {
      childrenOf.set(parentId, [])
    }
    childrenOf.get(parentId).push({ block, index })
  })

  const result = []
  const walk = (parentId, depth) => {
    const list = (childrenOf.get(parentId) || []).sort((left, right) => (
      orderOf(left.block, left.index) - orderOf(right.block, right.index) || left.index - right.index
    ))
    list.forEach(({ block }) => {
      result.push({ ...block, depth })
      walk(block.id, depth + 1)
    })
  }

  walk('', 0)
  return result
}

/**
 * 文档内搜索：命中主题文本、块纯文本。
 * 返回命中的 nodeIds / blockIds（均为 Set），以及带上下文的 hits 列表。
 */
export function searchNoteContent({ nodes = [], blocks = [], query = '' } = {}) {
  const keyword = String(query || '').trim().toLowerCase()
  const result = { nodeIds: new Set(), blockIds: new Set(), hits: [] }
  if (!keyword) {
    return result
  }

  const nodeMap = new Map(nodes.map(node => [node.id, node]))

  blocks.forEach((block, index) => {
    const haystack = String(block.text || '').toLowerCase()
    if (!haystack.includes(keyword)) {
      return
    }

    result.blockIds.add(block.id)
    if (block.nodeId) {
      result.nodeIds.add(block.nodeId)
    }
    result.hits.push({
      kind: 'block',
      id: block.id,
      nodeId: block.nodeId || null,
      index,
      text: excerpt(block.text, keyword)
    })
  })

  nodes.forEach(node => {
    const haystack = String(node.text || '').toLowerCase()
    if (!haystack.includes(keyword)) {
      return
    }

    result.nodeIds.add(node.id)
    result.hits.push({
      kind: 'node',
      id: node.id,
      nodeId: node.id,
      text: excerpt(node.text, keyword)
    })
  })

  // 命中块时把所属主题也标出来，方便在画布上定位
  result.blockIds.forEach(blockId => {
    const block = blocks.find(item => item.id === blockId)
    if (block?.nodeId && nodeMap.has(block.nodeId)) {
      result.nodeIds.add(block.nodeId)
    }
  })

  return result
}

function excerpt(text = '', keyword = '', radius = 12) {
  const source = String(text || '')
  const position = source.toLowerCase().indexOf(keyword)
  if (position < 0) {
    return source.slice(0, radius * 2)
  }
  const start = Math.max(0, position - radius)
  const end = Math.min(source.length, position + keyword.length + radius)
  return `${start > 0 ? '…' : ''}${source.slice(start, end)}${end < source.length ? '…' : ''}`
}
