import { t } from '../../i18n'
import {
  normalizeAssignee,
  normalizeAttachments,
  normalizeFontSize,
  normalizeIsoDate,
  normalizeLabels,
  normalizeMarkers,
  normalizeMindmapLayout,
  normalizeNote,
  normalizePriority,
  normalizeProgress,
  normalizeTextColor,
  normalizeTopicShape
} from './mindmapMeta'
import { normalizeMindNoteBlocks } from '../render/textBlockLayer'

const DEFAULT_LAYER_ID = 'layer-nodes'
const PAGE_ID_PATTERN = /^page-(\d+)$/

export const DOCUMENT_MODES = ['flowchart', 'mindmap', 'markdown', 'mind-note']
export const DEFAULT_NODE_STYLE = Object.freeze({
  theme: 'aurora',
  accent: 'teal',
  elevation: 'soft'
})
export const DEFAULT_EDGE_STYLE = Object.freeze({
  route: 'orthogonal',
  stroke: 'solid',
  marker: 'arrow'
})

export function normalizeNodeStyle(style = {}) {
  const merged = {
    ...DEFAULT_NODE_STYLE,
    ...(style || {})
  }
  return {
    ...merged,
    shape: normalizeTopicShape(merged.shape),
    fontSize: normalizeFontSize(merged.fontSize),
    bold: merged.bold === true,
    italic: merged.italic === true,
    textColor: normalizeTextColor(merged.textColor)
  }
}

export function normalizeEdgeStyle(style = {}) {
  return {
    ...DEFAULT_EDGE_STYLE,
    ...(style || {})
  }
}

export function createDefaultLayer() {
  return createDefaultLayers('flowchart')[1]
}

export function createDefaultLayers(mode = 'flowchart') {
  if (mode === 'flowchart') {
    return [
      { id: 'layer-edges', name: t('editor.edgeLayer'), visible: true, locked: false, order: 0 },
      { id: 'layer-nodes', name: t('editor.nodeLayer'), visible: true, locked: false, order: 1 },
      { id: 'layer-notes', name: t('editor.noteLayer'), visible: true, locked: false, order: 2 }
    ]
  }

  if (mode === 'mindmap') {
    return [
      { id: 'layer-edges', name: t('editor.relationLayer'), visible: true, locked: false, order: 0 },
      { id: 'layer-nodes', name: t('editor.topicLayer'), visible: true, locked: false, order: 1 },
      { id: 'layer-notes', name: t('editor.textBlockLayer'), visible: true, locked: false, order: 2 }
    ]
  }

  if (mode === 'mind-note') {
    return [
      { id: 'layer-edges', name: t('editor.relationLayer'), visible: true, locked: false, order: 0 },
      { id: 'layer-nodes', name: t('editor.topicLayer'), visible: true, locked: false, order: 1 },
      { id: 'layer-notes', name: t('editor.textBlockLayer'), visible: true, locked: false, order: 2 }
    ]
  }

  return [{ id: DEFAULT_LAYER_ID, name: t('editor.defaultLayer'), visible: true, locked: false, order: 0 }]
}

export const DEFAULT_PAGE = Object.freeze({ width: 1200, height: 720 })

function normalizeViewport(viewport = {}) {
  return {
    x: Number(viewport.x) || 0,
    y: Number(viewport.y) || 0,
    zoom: Math.max(0.2, Math.min(2.5, Number(viewport.zoom) || 1))
  }
}

function normalizePageSize(page = {}) {
  return {
    width: Math.max(320, Number(page.width) || DEFAULT_PAGE.width),
    height: Math.max(240, Number(page.height) || DEFAULT_PAGE.height)
  }
}

function normalizeLayers(layers, mode = 'flowchart', includeDefaultLayers = true) {
  if (!Array.isArray(layers) || !layers.length) {
    return includeDefaultLayers ? createDefaultLayers(mode) : []
  }

  const normalizedLayers = layers.map((layer, index) => ({
    id: layer.id || `layer-${index + 1}`,
    name: layer.name || `${t('editor.layers')} ${index + 1}`,
    visible: layer.visible !== false,
    locked: Boolean(layer.locked),
    order: Number.isFinite(layer.order) ? layer.order : index
  }))

  const existingLayerIds = new Set(normalizedLayers.map(layer => layer.id))
  const missingDefaultLayers = includeDefaultLayers
    ? createDefaultLayers(mode)
        .filter(layer => !existingLayerIds.has(layer.id))
        .map(layer => ({ ...layer }))
    : []

  return [...normalizedLayers, ...missingDefaultLayers]
    .sort((left, right) => left.order - right.order)
    .map((layer, index) => ({ ...layer, order: index }))
}

function normalizeNodes(nodes) {
  return Array.isArray(nodes)
    ? nodes.map(node => ({
        width: 160,
        height: 64,
        layerId: DEFAULT_LAYER_ID,
        ...node,
        rotation: ((Number(node.rotation) || 0) % 360 + 360) % 360,
        image: typeof node.image === 'string' ? node.image : '',
        link: typeof node.link === 'string' ? node.link : '',
        tooltip: typeof node.tooltip === 'string' ? node.tooltip : '',
        markers: normalizeMarkers(node.markers),
        note: normalizeNote(node.note),
        labels: normalizeLabels(node.labels),
        priority: normalizePriority(node.priority),
        progress: normalizeProgress(node.progress),
        taskStart: normalizeIsoDate(node.taskStart),
        taskDue: normalizeIsoDate(node.taskDue),
        assignee: normalizeAssignee(node.assignee),
        attachments: normalizeAttachments(node.attachments),
        style: normalizeNodeStyle(node.style)
      }))
    : []
}

function normalizeEdges(edges) {
  return Array.isArray(edges)
    ? edges.map(edge => {
        const isRelationship = edge.kind === 'relationship'
        const normalized = {
          layerId: 'layer-edges',
          ...edge,
          style: normalizeEdgeStyle(isRelationship
            ? { route: 'curve', stroke: 'dashed', marker: 'arrow', ...(edge.style || {}) }
            : edge.style)
        }
        if (isRelationship) {
          normalized.kind = 'relationship'
        } else {
          delete normalized.kind
        }
        return normalized
      })
    : []
}

function normalizeBoundaries(boundaries) {
  return Array.isArray(boundaries)
    ? boundaries
        .filter(boundary => boundary && boundary.nodeId)
        .map((boundary, index) => ({
          id: String(boundary.id || `boundary-${index + 1}`),
          nodeId: String(boundary.nodeId),
          accent: typeof boundary.accent === 'string' ? boundary.accent : 'rose'
        }))
    : []
}

function normalizeSummaries(summaries) {
  return Array.isArray(summaries)
    ? summaries
        .filter(summary => summary && Array.isArray(summary.nodeIds) && summary.nodeIds.length)
        .map((summary, index) => ({
          id: String(summary.id || `summary-${index + 1}`),
          nodeIds: summary.nodeIds.map(String),
          text: typeof summary.text === 'string' ? summary.text.slice(0, 120) : '',
          accent: typeof summary.accent === 'string' ? summary.accent : 'amber'
        }))
    : []
}

function normalizeTextBlocks(textBlocks) {
  return normalizeMindNoteBlocks(textBlocks)
}

function normalizeGuides(guides) {
  return Array.isArray(guides)
    ? guides
        .filter(guide => guide && (guide.axis === 'vertical' || guide.axis === 'horizontal') && Number.isFinite(Number(guide.pos)))
        .map(guide => ({ axis: guide.axis, pos: Math.round(Number(guide.pos)) }))
    : []
}

function normalizePageData(partial = {}, mode = 'flowchart', includeDefaultLayers = true) {
  return {
    viewport: normalizeViewport(partial.viewport),
    page: normalizePageSize(partial.page),
    layers: normalizeLayers(partial.layers, mode, includeDefaultLayers),
    nodes: normalizeNodes(partial.nodes),
    edges: normalizeEdges(partial.edges),
    boundaries: normalizeBoundaries(partial.boundaries),
    summaries: normalizeSummaries(partial.summaries),
    layout: normalizeMindmapLayout(partial.layout),
    textBlocks: normalizeTextBlocks(partial.textBlocks),
    guides: normalizeGuides(partial.guides),
    showGrid: partial.showGrid !== false,
    sourceText: typeof partial.sourceText === 'string' ? partial.sourceText : ''
  }
}

function hasPagePayload(content = {}) {
  return ['viewport', 'page', 'layers', 'nodes', 'edges', 'boundaries', 'summaries', 'layout', 'textBlocks', 'guides', 'showGrid', 'sourceText']
    .some(key => Object.prototype.hasOwnProperty.call(content, key))
}

export function createPageSnapshot(partial = {}, mode = 'flowchart') {
  const data = normalizePageData(partial, mode)
  return {
    id: partial.id || 'page-1',
    name: String(partial.name || t('editor.pageDefault', { n: 1 })).trim() || t('editor.pageDefault', { n: 1 }),
    ...data
  }
}

export function createEmptyPage({ id = null, name = '页面', mode = 'flowchart' } = {}) {
  return createPageSnapshot({
    id: id || `page-${Date.now().toString(36)}`,
    name,
    showGrid: true
  }, mode)
}

export function clonePageData(content = {}, mode = 'flowchart') {
  return normalizePageData(content, mode, false)
}

export function applyPageDataToContent(content, page) {
  if (!content || !page) {
    return
  }
  Object.assign(content, clonePageData(page))
}

export function getPageById(content, pageId) {
  return (content?.pages || []).find(page => page.id === pageId) || null
}

export function getPageCounter(pages = []) {
  return pages.reduce((maxValue, page) => {
    const match = PAGE_ID_PATTERN.exec(String(page.id || ''))
    return match ? Math.max(maxValue, Number(match[1])) : maxValue
  }, 0)
}

function normalizePages(content, mode = 'flowchart') {
  const rawPages = Array.isArray(content.pages) ? content.pages : []
  const normalized = rawPages.map((page, index) => ({
    ...createPageSnapshot(page, mode),
    id: String(page.id || `page-${index + 1}`),
    name: String(page.name || t('editor.pageDefault', { n: index + 1 })).trim() || t('editor.pageDefault', { n: index + 1 })
  }))

  if (!normalized.length) {
    normalized.push(createPageSnapshot({
      id: 'page-1',
      name: t('editor.pageDefault', { n: 1 }),
      ...clonePageData(content)
    }, mode))
  }

  const usedIds = new Set()
  normalized.forEach((page, index) => {
    let id = page.id
    let suffix = 2
    while (usedIds.has(id)) {
      id = `${page.id}-${suffix}`
      suffix += 1
    }
    page.id = id
    usedIds.add(id)
    if (!page.name) {
      page.name = t('editor.pageDefault', { n: index + 1 })
    }
  })

  let activePageId = String(content.activePageId || '')
  if (!usedIds.has(activePageId)) {
    activePageId = normalized[0].id
  }

  if (hasPagePayload(content)) {
    const activeIndex = normalized.findIndex(page => page.id === activePageId)
    if (activeIndex >= 0) {
      normalized[activeIndex] = {
        ...normalized[activeIndex],
        ...clonePageData(content, mode)
      }
    }
  }

  return { pages: normalized, activePageId }
}

export function createDocumentContent(partial = {}) {
  const mode = partial.mode || 'flowchart'
  const base = normalizePageData(partial, mode)
  const { pages, activePageId } = normalizePages({ ...partial, ...base }, mode)

  return {
    ...base,
    pages,
    activePageId,
    meta: {
      revision: 0,
      exportReady: true,
      autosavedAt: null,
      ...(partial.meta || {})
    }
  }
}

export function createDocument({
  id = null,
  sequenceNo = null,
  title = '',
  mode = 'flowchart',
  content = {},
  createdAt = null,
  updatedAt = null
} = {}) {
  return {
    id,
    sequenceNo,
    title: title || defaultTitleForMode(mode),
    mode,
    content: createDocumentContent({ ...content, mode }),
    createdAt,
    updatedAt
  }
}

export function normalizeDocument(input = {}) {
  const mode = DOCUMENT_MODES.includes(input.mode) ? input.mode : 'flowchart'
  const sequenceNo = Number(input.sequenceNo)
  return createDocument({
    id: input.id ?? null,
    sequenceNo: Number.isFinite(sequenceNo) && sequenceNo > 0 ? Math.round(sequenceNo) : null,
    title: typeof input.title === 'string' ? input.title.trim() : '',
    mode,
    content: input.content || {},
    createdAt: input.createdAt ?? null,
    updatedAt: input.updatedAt ?? null
  })
}

export function validateDocument(input) {
  const errors = []
  if (!input || typeof input !== 'object') {
    return { valid: false, errors: ['文档不能为空'] }
  }

  if (typeof input.title !== 'string' || !input.title.trim()) {
    errors.push('文档标题不能为空')
  }
  if (!DOCUMENT_MODES.includes(input.mode)) {
    errors.push('文档模式无效')
  }
  if (!input.content || typeof input.content !== 'object') {
    errors.push('文档内容不能为空')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

export function createNode({
  id,
  kind = 'process',
  x = 120,
  y = 120,
  width = 160,
  height = 64,
  text = '新节点',
  layerId = DEFAULT_LAYER_ID,
  style = {},
  image = '',
  link = '',
  tooltip = ''
} = {}) {
  return {
    id: id || `node-${Date.now()}`,
    kind,
    x,
    y,
    width,
    height,
    text,
    layerId,
    image,
    link,
    tooltip,
    style: normalizeNodeStyle(style)
  }
}

export function defaultTitleForMode(mode) {
  const labelMap = {
    flowchart: t('title.flowchart'),
    mindmap: t('title.mindmap'),
    markdown: t('title.markdown'),
    'mind-note': t('title.mindNote')
  }
  return labelMap[mode] || labelMap.flowchart
}

export { DEFAULT_LAYER_ID, nextPageId }

function nextPageId(existingIds) {
  let index = 1
  while (existingIds.has(`page-${index}`)) {
    index += 1
  }
  return `page-${index}`
}
