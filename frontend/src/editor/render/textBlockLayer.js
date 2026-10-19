import DOMPurify from 'dompurify'

const DEFAULT_URL = 'https://example.com'
export const NOTE_BLOCK_WIDTH = 260
const NOTE_BLOCK_GAP = 28
const NOTE_BLOCK_STACK_GAP = 12
const NOTE_BLOCK_NEST_INDENT = 24
const CANVAS_PADDING = 24
const MIN_BLOCK_HEIGHT = 96
const MAX_BLOCK_HEIGHT = 560

let noteBlockCounter = 0

export function createMindNoteId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `note-${crypto.randomUUID()}`
  }
  noteBlockCounter += 1
  return `note-${Date.now().toString(36)}-${noteBlockCounter}`
}

export function createMindNoteTextBlock({
  id,
  nodeId,
  text = '',
  html,
  format,
  linkUrl,
  layerId = 'layer-notes',
  offsetX = 0,
  offsetY = 0,
  width = NOTE_BLOCK_WIDTH,
  height = null,
  order = 0
} = {}) {
  const contentHtml = sanitizeMindNoteHtml(html || (text
    ? renderLegacyMindNoteHtml({ text, format, linkUrl })
    : '<p></p>'))
  const plainText = String(text || '').trim() || htmlToPlainText(contentHtml)

  return {
    id: id || createMindNoteId(),
    nodeId,
    text: plainText,
    html: contentHtml,
    format: format || 'rich',
    linkUrl: linkUrl || '',
    offsetX: Number(offsetX) || 0,
    offsetY: Number(offsetY) || 0,
    width: Math.max(180, Number(width) || NOTE_BLOCK_WIDTH),
    height: height !== null && height !== undefined && Number.isFinite(Number(height)) && Number(height) > 80
      ? Number(height)
      : null,
    order: Number.isFinite(Number(order)) ? Number(order) : 0,
    layerId
  }
}

export function normalizeMindNoteBlock(block = {}, index = 0) {
  const html = sanitizeMindNoteHtml(String(block.html || '').trim() || renderLegacyMindNoteHtml(block))
  return {
    ...block,
    id: String(block.id || createMindNoteId()),
    nodeId: block.nodeId ? String(block.nodeId) : '',
    text: String(block.text || '').trim() || htmlToPlainText(html),
    html,
    format: block.format || 'rich',
    linkUrl: block.linkUrl || '',
    offsetX: Number(block.offsetX) || 0,
    offsetY: Number(block.offsetY) || 0,
    width: Math.max(180, Number(block.width) || NOTE_BLOCK_WIDTH),
    height: block.height !== null && block.height !== undefined && Number.isFinite(Number(block.height)) && Number(block.height) > 80
      ? Number(block.height)
      : null,
    order: Number.isFinite(Number(block.order)) ? Number(block.order) : index,
    layerId: block.layerId || 'layer-notes'
  }
}

export function normalizeMindNoteBlocks(textBlocks = []) {
  return Array.isArray(textBlocks)
    ? textBlocks.map((block, index) => normalizeMindNoteBlock(block, index))
    : []
}

export function updateMindNoteBlockText(block, text) {
  const nextHtml = `<p>${escapeHtml(text || '').replaceAll('\n', '<br />')}</p>`
  return {
    ...block,
    text,
    html: nextHtml,
    format: 'rich'
  }
}

export function updateMindNoteBlockHtml(block, html, text) {
  const nextHtml = String(html || '').trim() || '<p></p>'
  return {
    ...block,
    html: nextHtml,
    text: String(text || '').trim() || htmlToPlainText(nextHtml),
    format: 'rich'
  }
}

export function formatMindNoteBlock(block, format) {
  return {
    ...block,
    html: renderLegacyMindNoteHtml({ ...block, format }),
    format
  }
}

export function getVisibleTextBlocks(
  textBlocks = [],
  nodes = [],
  hiddenNodeIds = [],
  visibleLayers = new Set(),
  pageWidth = 1200,
  options = {}
) {
  const nodeMap = new Map(nodes.map(node => [node.id, node]))
  const hiddenSet = new Set(hiddenNodeIds)
  const groups = new Map()

  textBlocks.forEach((block, index) => {
    const node = nodeMap.get(block.nodeId)
    if (!node) {
      return
    }
    if (hiddenSet.has(block.nodeId) || node.collapsed === true) {
      return
    }
    if (visibleLayers.size && !visibleLayers.has(block.layerId)) {
      return
    }
    const list = groups.get(block.nodeId) || []
    list.push({ block, index })
    groups.set(block.nodeId, list)
  })

  const results = []
  groups.forEach((list, nodeId) => {
    const node = nodeMap.get(nodeId)
    const ordered = [...list].sort((left, right) => (
      (Number(left.block.order) || 0) - (Number(right.block.order) || 0) || left.index - right.index
    ))

    // 按 parentId 建树，实现块嵌套；父块不存在（被删/被隐藏）时回退成顶层块
    const entryById = new Map(ordered.map(entry => [entry.block.id, entry]))
    const childrenOf = new Map()
    ordered.forEach(entry => {
      const parentId = entry.block.parentId && entryById.has(entry.block.parentId) ? entry.block.parentId : ''
      if (!childrenOf.has(parentId)) {
        childrenOf.set(parentId, [])
      }
      childrenOf.get(parentId).push(entry)
    })

    const baseY = Math.max(CANVAS_PADDING, node.y - 4)

    const placeSiblings = (entries, parent, depth) => {
      let cursorY = parent
        ? parent.y + parent.height + NOTE_BLOCK_STACK_GAP
        : baseY

      entries.forEach(({ block, index }, stackIndex) => {
        const width = Math.max(180, Number(block.width) || NOTE_BLOCK_WIDTH)
        const height = block.height !== null && block.height !== undefined && Number.isFinite(Number(block.height)) && Number(block.height) > 80
          ? Number(block.height)
          : estimateMindNoteBlockHeight(block, width)
        const activeExtraHeight = block.id === options.activeBlockId
          ? Math.max(0, Number(options.activeExtraHeight) || 0)
          : 0
        const visualHeight = height + activeExtraHeight
        const offsetX = Number.isFinite(block.offsetX) ? block.offsetX : 0
        const offsetY = Number.isFinite(block.offsetY) ? block.offsetY : 0

        // 顶层块贴在主题右侧（放不下就放左侧）；子块缩进挂在父块右下方
        const preferredX = parent
          ? parent.x + NOTE_BLOCK_NEST_INDENT
          : node.x + node.width + NOTE_BLOCK_GAP
        const fallbackX = parent
          ? parent.x + NOTE_BLOCK_NEST_INDENT
          : node.x - width - NOTE_BLOCK_GAP
        const baseX = parent || preferredX + width <= pageWidth - CANVAS_PADDING
          ? preferredX
          : Math.max(CANVAS_PADDING, fallbackX)
        const y = Math.max(CANVAS_PADDING, cursorY + offsetY)

        const placed = {
          ...block,
          html: renderMindNoteHtml(block),
          x: baseX + offsetX,
          y,
          width,
          height: visualHeight,
          baseHeight: height,
          depth,
          stackIndex,
          order: Number.isFinite(Number(block.order)) ? Number(block.order) : index
        }
        results.push(placed)

        cursorY = Math.max(cursorY, y + visualHeight) + NOTE_BLOCK_STACK_GAP
        placeSiblings(childrenOf.get(block.id) || [], placed, depth + 1)
      })
    }

    placeSiblings(childrenOf.get('') || [], null, 0)
  })

  return results.sort((left, right) => left.order - right.order)
}

export function estimateMindNoteBlockHeight(block = {}, width = NOTE_BLOCK_WIDTH) {
  if (block.height !== null && block.height !== undefined && Number.isFinite(Number(block.height)) && Number(block.height) > 80) {
    return Number(block.height)
  }

  const text = String(block.text || '').trim() || htmlToPlainText(block.html)
  const charsPerLine = Math.max(10, Math.floor((width - 28) / 7))
  let lineCount = 0
  text.split(/\r?\n/).forEach(line => {
    if (!String(line).trim()) {
      return
    }
    lineCount += Math.max(1, Math.ceil(String(line).length / charsPerLine))
  })
  lineCount = Math.max(1, lineCount)

  let extra = 0
  if (typeof DOMParser !== 'undefined' && block.html) {
    const doc = new DOMParser().parseFromString(`<div id="note-measure">${block.html}</div>`, 'text/html')
    const root = doc.getElementById('note-measure')
    extra += (root?.querySelectorAll('h1,h2,h3,h4,h5,h6,pre,table').length || 0) * 10
  }

  return Math.max(MIN_BLOCK_HEIGHT, Math.min(MAX_BLOCK_HEIGHT, 56 + lineCount * 21 + extra))
}

export function renderMindNoteHtml(block = {}) {
  return String(block.html || '').trim() || renderLegacyMindNoteHtml(block)
}

export function hasMindNoteBlockContent(block = {}) {
  if (String(block.text || '').trim()) {
    return true
  }
  return /<(img|table|hr|svg|input)\b/i.test(String(block.html || ''))
}

export function htmlToPlainText(html = '') {
  const source = String(html || '')
  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(`<div id="note-root">${source}</div>`, 'text/html')
    const root = doc.getElementById('note-root')
    if (root) {
      root.querySelectorAll('br').forEach(element => element.replaceWith('\n'))
      root.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li,blockquote,pre,tr').forEach(element => {
        element.append('\n')
      })
      return root.textContent
        .replace(/\u00a0/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
    }
  }

  return source
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|h[1-6]|li|blockquote|pre|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function renderLegacyMindNoteHtml(block = {}) {
  const safeText = escapeHtml(block.text || '')
  if (block.format === 'bold') {
    return `<p><strong>${safeText.replaceAll('\n', '<br />')}</strong></p>`
  }
  if (block.format === 'italic') {
    return `<p><em>${safeText.replaceAll('\n', '<br />')}</em></p>`
  }
  if (block.format === 'list') {
    const items = safeText.split(/\r?\n/).filter(Boolean)
    return `<ul>${items.map(item => `<li>${item}</li>`).join('')}</ul>`
  }
  if (block.format === 'link') {
    return `<p><a href="${escapeAttribute(safeLinkUrl(block.linkUrl))}" target="_blank" rel="noopener noreferrer">${safeText.replaceAll('\n', '<br />')}</a></p>`
  }
  return `<p>${safeText.replaceAll('\n', '<br />')}</p>`
}

function sanitizeMindNoteHtml(html) {
  const source = String(html || '')
  if (!source || typeof DOMPurify === 'undefined' || typeof DOMPurify.sanitize !== 'function') {
    return source
  }
  return DOMPurify.sanitize(source, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['target', 'data-type', 'data-checked'],
    ADD_TAGS: ['label', 'input'],
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'button', 'textarea', 'select', 'option'],
    FORBID_ATTR: ['contenteditable']
  })
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function escapeAttribute(value) {
  return escapeHtml(value)
}

function safeLinkUrl(value) {
  try {
    const url = new URL(String(value || DEFAULT_URL))
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.href : DEFAULT_URL
  } catch {
    return DEFAULT_URL
  }
}
