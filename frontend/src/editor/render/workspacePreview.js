import { t } from '../../i18n'
import { getVisibleTextBlocks, hasMindNoteBlockContent } from './textBlockLayer'

export function describeWorkspaceDocument(item) {
  const content = resolveActivePreviewContent(item.snapshot)
  if (item.mode === 'markdown') {
    const lines = buildMarkdownPreviewLines({ content })
    return lines.slice(0, 2).join(' / ') || t('workspace.emptySummary')
  }

  const labels = extractDiagramPreviewLabels(content)
  return labels.join(' / ') || t('workspace.emptySummary')
}

function resolveActivePreviewContent(snapshot) {
  const content = snapshot?.content || {}
  if (Array.isArray(content.pages) && content.pages.length) {
    return content.pages.find(page => page.id === content.activePageId) || content.pages[0]
  }
  return content
}

export function buildWorkspacePreview(item) {
  const content = item.snapshot?.content || {}
  const activePageId = content.activePageId || ''
  const rawPages = Array.isArray(content.pages) && content.pages.length
    ? content.pages
    : [{ id: activePageId || 'page-1', name: '1', ...content }]

  const pages = rawPages.map((page, index) => {
    if (item.mode === 'markdown') {
      const lines = buildMarkdownPreviewLines({ content: page })
      return {
        id: page.id || `page-${index + 1}`,
        name: page.name || String(index + 1),
        kind: 'markdown',
        lines,
        empty: lines.length === 0
      }
    }
    const preview = buildDiagramPreview({ content: page }, item.mode)
    return {
      ...preview,
      id: page.id || `page-${index + 1}`,
      name: page.name || String(index + 1),
      empty: preview.nodes.length === 0 && preview.textBlocks.length === 0
    }
  })

  const current = pages.find(page => page.id === activePageId) || pages[0]
  return {
    ...current,
    pages,
    pageCount: Math.max(pages.length, Number(content.pageCount) || 0),
    activePageId: current.id
  }
}

function buildMarkdownPreviewLines(snapshot) {
  return String(snapshot?.content?.sourceText || '')
    .split(/\r?\n/)
    .map(line => line.replace(/^#+\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 4)
}

function extractDiagramPreviewLabels(content) {
  const nodes = Array.isArray(content.nodes) ? content.nodes : []
  const textBlocks = Array.isArray(content.textBlocks) ? content.textBlocks : []
  const labels = [
    ...nodes.map(node => formatPreviewLabel(node.text || '', 10)),
    ...textBlocks.map(block => formatPreviewLabel(block.text || '', 10))
  ].filter(Boolean)

  return [...new Set(labels)].slice(0, 3)
}

function formatPreviewLabel(rawText, maxLength = 9) {
  const text = String(rawText || '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!text) {
    return ''
  }

  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text
}

function buildDiagramPreview(snapshot, mode) {
  const content = snapshot?.content || {}
  const allNodes = Array.isArray(content.nodes) ? content.nodes : []
  const nodes = allNodes.slice(0, 8)
  const edges = Array.isArray(content.edges) ? content.edges.slice(0, 12) : []
  const visibleLayers = new Set((content.layers || [])
    .filter(layer => layer.visible !== false)
    .map(layer => layer.id))
  const textBlocks = getVisibleTextBlocks(
    Array.isArray(content.textBlocks) ? content.textBlocks : [],
    allNodes,
    [],
    visibleLayers,
    Math.max(320, Number(content.page?.width) || 1200)
  ).filter(hasMindNoteBlockContent).slice(0, 4)

  if (!nodes.length && !textBlocks.length) {
    return { kind: 'diagram', nodes: [], edges: [], textBlocks: [] }
  }

  const bounds = [...nodes, ...textBlocks].reduce((result, item) => ({
    minX: Math.min(result.minX, Number(item.x) || 0),
    minY: Math.min(result.minY, Number(item.y) || 0),
    maxX: Math.max(result.maxX, (Number(item.x) || 0) + (Number(item.width) || 0)),
    maxY: Math.max(result.maxY, (Number(item.y) || 0) + (Number(item.height) || 0))
  }), {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY
  })

  const sourceWidth = Math.max(1, bounds.maxX - bounds.minX)
  const sourceHeight = Math.max(1, bounds.maxY - bounds.minY)
  const scale = Math.min(180 / sourceWidth, 104 / sourceHeight)
  const offsetX = 20
  const offsetY = 22
  const nodeMap = new Map()
  const previewNodes = nodes.map(node => {
    const width = Math.max(16, (Number(node.width) || 160) * scale)
    const height = Math.max(10, (Number(node.height) || 64) * scale)
    const x = offsetX + ((Number(node.x) || 0) - bounds.minX) * scale
    const y = offsetY + ((Number(node.y) || 0) - bounds.minY) * scale
    const label = formatPreviewLabel(node.text || '', mode === 'flowchart' ? 10 : 8)
    const previewNode = {
      key: node.id,
      x,
      y,
      width,
      height,
      radius: mode === 'flowchart' ? 8 : 14,
      shape: mode === 'flowchart' && node.kind === 'decision' ? 'diamond' : 'rect',
      path: `M ${x + width / 2} ${y} L ${x + width} ${y + height / 2} L ${x + width / 2} ${y + height} L ${x} ${y + height / 2} Z`,
      label,
      textX: x + width / 2,
      textY: y + height / 2,
      fontSize: Math.max(8, Math.min(12.5, width / Math.max(label.length + 2, 5), height * 0.48))
    }
    nodeMap.set(node.id, previewNode)
    return previewNode
  })

  const previewEdges = edges.flatMap(edge => {
    const fromNode = nodeMap.get(edge.fromNodeId)
    const toNode = nodeMap.get(edge.toNodeId)
    if (!fromNode || !toNode) {
      return []
    }
    return [{
      key: edge.id,
      x1: fromNode.x + fromNode.width / 2,
      y1: fromNode.y + fromNode.height / 2,
      x2: toNode.x + toNode.width / 2,
      y2: toNode.y + toNode.height / 2
    }]
  })

  const previewTextBlocks = textBlocks.map(block => {
    const x = offsetX + ((Number(block.x) || 0) - bounds.minX) * scale
    const y = offsetY + ((Number(block.y) || 0) - bounds.minY) * scale
    const width = Math.max(12, (Number(block.width) || 260) * scale)
    const height = Math.max(9, (Number(block.height) || 96) * scale)
    const fontSize = Math.max(3.8, Math.min(6.4, width / 18))
    const lineHeight = fontSize + 2
    const maxChars = Math.max(4, Math.floor((width - 6) / Math.max(2.4, fontSize * 0.58)))
    const lines = String(block.text || '')
      .split(/\r?\n/)
      .map(line => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .slice(0, Math.max(1, Math.floor((height - 4) / lineHeight)))
      .map(line => formatPreviewLabel(line, maxChars))
    return {
      key: block.id,
      x,
      y,
      width,
      height,
      lines,
      fontSize,
      lineHeight,
      textX: x + 3,
      textY: y + 5
    }
  })

  return {
    kind: 'diagram',
    nodes: previewNodes,
    edges: previewEdges,
    textBlocks: previewTextBlocks
  }
}
