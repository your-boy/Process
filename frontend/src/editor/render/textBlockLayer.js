const DEFAULT_URL = 'https://example.com'
const NOTE_BLOCK_WIDTH = 220
const NOTE_BLOCK_GAP = 28
const CANVAS_WIDTH = 1200
const CANVAS_PADDING = 24

export function createMindNoteTextBlock({ nodeId, index, text = '记录要点', layerId = 'layer-notes' } = {}) {
  const block = {
    id: `note-${index}`,
    nodeId,
    text,
    format: 'paragraph',
    linkUrl: DEFAULT_URL,
    offsetX: 0,
    offsetY: 0,
    layerId
  }

  return {
    ...block,
    html: renderMindNoteHtml(block)
  }
}

export function formatMindNoteBlock(block, format) {
  const nextBlock = {
    ...block,
    format
  }
  return {
    ...nextBlock,
    html: renderMindNoteHtml(nextBlock)
  }
}

export function updateMindNoteBlockText(block, text) {
  const nextBlock = {
    ...block,
    text
  }
  return {
    ...nextBlock,
    html: renderMindNoteHtml(nextBlock)
  }
}

export function getVisibleTextBlocks(textBlocks = [], nodes = [], hiddenNodeIds = [], visibleLayers = new Set()) {
  const nodeMap = new Map(nodes.map(node => [node.id, node]))
  const hiddenSet = new Set(hiddenNodeIds)

  return textBlocks
    .filter(block => nodeMap.has(block.nodeId))
    .filter(block => !hiddenSet.has(block.nodeId))
    .filter(block => nodeMap.get(block.nodeId)?.collapsed !== true)
    .filter(block => !visibleLayers.size || visibleLayers.has(block.layerId))
    .map(block => {
      const node = nodeMap.get(block.nodeId)
      const preferredX = node.x + node.width + NOTE_BLOCK_GAP
      const fallbackX = node.x - NOTE_BLOCK_WIDTH - NOTE_BLOCK_GAP
      const offsetX = Number.isFinite(block.offsetX) ? block.offsetX : 0
      const offsetY = Number.isFinite(block.offsetY) ? block.offsetY : 0

      return {
        ...block,
        x: preferredX + NOTE_BLOCK_WIDTH <= CANVAS_WIDTH - CANVAS_PADDING
          ? preferredX + offsetX
          : Math.max(CANVAS_PADDING, fallbackX + offsetX),
        y: Math.max(CANVAS_PADDING, node.y - 4 + offsetY)
      }
    })
}

function renderMindNoteHtml(block) {
  const safeText = escapeHtml(block.text || '')
  if (block.format === 'bold') {
    return `<p><strong>${safeText}</strong></p>`
  }
  if (block.format === 'italic') {
    return `<p><em>${safeText}</em></p>`
  }
  if (block.format === 'list') {
    const items = safeText.split(/\r?\n/).filter(Boolean)
    return `<ul>${items.map(item => `<li>${item}</li>`).join('')}</ul>`
  }
  if (block.format === 'link') {
    return `<p><a href="${escapeAttribute(block.linkUrl || DEFAULT_URL)}" target="_blank" rel="noreferrer">${safeText}</a></p>`
  }
  return `<p>${safeText.replaceAll('\n', '<br />')}</p>`
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