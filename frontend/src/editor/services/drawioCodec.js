// .drawio (mxGraph) 导入导出
// 除基础几何外，还保留本项目模型里的折点、容器归属、分组、旋转、
// 图层、页面尺寸、网格状态和连线样式。未知的外部样式会降级为普通矩形。

import { inflateRaw } from 'pako'
import { estimateMindNoteBlockHeight, hasMindNoteBlockContent, NOTE_BLOCK_WIDTH } from '../render/textBlockLayer'

const ANCHOR_TO_EXIT = {
  right: { x: 1, y: 0.5 },
  left: { x: 0, y: 0.5 },
  top: { x: 0.5, y: 0 },
  bottom: { x: 0.5, y: 1 }
}

const EXIT_TO_ANCHOR = {
  '1|0.5': 'right',
  '0|0.5': 'left',
  '0.5|0': 'top',
  '0.5|1': 'bottom'
}

const NODE_KINDS = new Set([
  'process', 'terminator', 'decision', 'ellipse', 'parallelogram',
  'document', 'cylinder', 'hexagon', 'card', 'delay', 'note', 'cloud',
  'roundrect', 'triangle', 'arrow', 'cross', 'container', 'swimlane',
  'umlclass', 'actor', 'topic'
])

// 与编辑器画布保持一致的主题色，导出到 draw.io 时不至于全变成白底黑框
const ACCENT_DRAWIO_STYLES = {
  teal: { fill: '#ffffff', stroke: '#0f766e', text: '#134e4a' },
  blue: { fill: '#eff6ff', stroke: '#2563eb', text: '#1e3a8a' },
  amber: { fill: '#fffbeb', stroke: '#b45309', text: '#78350f' },
  rose: { fill: '#fff1f2', stroke: '#be123c', text: '#881337' },
  violet: { fill: '#f5f3ff', stroke: '#6d28d9', text: '#4c1d95' },
  emerald: { fill: '#ecfdf5', stroke: '#047857', text: '#065f46' },
  sky: { fill: '#f0f9ff', stroke: '#0369a1', text: '#0c4a6e' },
  slate: { fill: '#f4f4f5', stroke: '#3f3f46', text: '#18181b' }
}

function escapeXml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function escapeDrawioValue(value) {
  return escapeXml(value).replaceAll('\n', '&#10;')
}

function encodeStyleValue(value) {
  return encodeURIComponent(String(value ?? ''))
}

function decodeStyleValue(value) {
  try {
    return decodeURIComponent(String(value ?? ''))
  } catch {
    return String(value ?? '')
  }
}

function uniqueId(preferred, used) {
  let id = String(preferred || 'cell')
  let suffix = 2
  while (used.has(id)) {
    id = `${preferred}-${suffix}`
    suffix += 1
  }
  used.add(id)
  return id
}

function shapeToDrawioStyle(node) {
  const parts = []
  const kind = NODE_KINDS.has(node.kind) ? node.kind : 'process'

  switch (kind) {
    case 'ellipse':
      parts.push('ellipse')
      break
    case 'decision':
      parts.push('rhombus')
      break
    case 'roundrect':
    case 'terminator':
    case 'topic':
      parts.push('rounded=1', 'arcSize=50')
      break
    case 'parallelogram':
      parts.push('shape=parallelogram', 'perimeter=parallelogramPerimeter')
      break
    case 'hexagon':
      parts.push('shape=hexagon', 'perimeter=hexagonPerimeter2')
      break
    case 'document':
      parts.push('shape=document')
      break
    case 'cylinder':
      parts.push('shape=cylinder3', 'boundedLbl=1', 'backgroundOutline=1')
      break
    case 'cloud':
      parts.push('shape=cloud')
      break
    case 'note':
      parts.push('shape=note', 'size=16')
      break
    case 'card':
      parts.push('shape=card')
      break
    case 'delay':
      parts.push('shape=delay')
      break
    case 'triangle':
      parts.push('triangle')
      break
    case 'arrow':
      parts.push('shape=flexArrow')
      break
    case 'cross':
      parts.push('shape=cross')
      break
    case 'actor':
      parts.push('shape=umlActor', 'verticalLabelPosition=bottom', 'verticalAlign=top')
      break
    case 'umlclass':
      parts.push('swimlane', 'startSize=26', 'container=0', 'collapsible=0')
      break
    case 'container':
      parts.push('swimlane', 'container=1', 'collapsible=0', 'startSize=34', 'horizontal=1')
      break
    case 'swimlane':
      parts.push('swimlane', 'container=1', 'collapsible=0', 'startSize=38', 'horizontal=1')
      break
    default:
      parts.push('rounded=0')
  }

  if (kind === 'container' || kind === 'swimlane' || kind === 'umlclass') {
    parts.push(
      'html=0',
      'whiteSpace=wrap',
      'fillColor=none',
      'strokeColor=#3f3f46',
      'verticalAlign=top',
      'align=left',
      'spacingLeft=8'
    )
  } else {
    const accent = ACCENT_DRAWIO_STYLES[node.style?.accent] || ACCENT_DRAWIO_STYLES.teal
    parts.push(
      'html=0',
      'whiteSpace=wrap',
      'align=center',
      'verticalAlign=middle',
      `fillColor=${accent.fill}`,
      `strokeColor=${accent.stroke}`,
      `fontColor=${accent.text}`,
      'strokeWidth=2'
    )
  }

  parts.push(
    `processKind=${encodeStyleValue(kind)}`,
    `processAccent=${encodeStyleValue(node.style?.accent || 'slate')}`,
    `processTheme=${encodeStyleValue(node.style?.theme || 'aurora')}`,
    `processElevation=${encodeStyleValue(node.style?.elevation || 'soft')}`,
    `processLayerId=${encodeStyleValue(node.layerId || 'layer-nodes')}`
  )

  if (node.containerId) {
    parts.push(`processContainerId=${encodeStyleValue(node.containerId)}`)
  }
  if (node.groupId) {
    parts.push(`processGroupId=${encodeStyleValue(node.groupId)}`)
  }
  if (node.locked) {
    parts.push('processLocked=1', 'locked=1')
  }
  if (node.image) {
    parts.push(`processImage=${encodeStyleValue(node.image)}`)
  }
  if (node.link) {
    parts.push(`processLink=${encodeStyleValue(node.link)}`)
  }
  if (node.tooltip) {
    parts.push(`processTooltip=${encodeStyleValue(node.tooltip)}`)
  }

  return `${parts.join(';')};`
}

function edgeToDrawioStyle(edge) {
  const exit = ANCHOR_TO_EXIT[edge.fromAnchor] || ANCHOR_TO_EXIT.right
  const entry = ANCHOR_TO_EXIT[edge.toAnchor] || ANCHOR_TO_EXIT.left
  const route = edge.style?.route || 'orthogonal'
  const stroke = edge.style?.stroke || 'solid'
  const marker = edge.style?.marker || 'arrow'
  const parts = [
    'html=0',
    'rounded=0',
    `processRoute=${encodeStyleValue(route)}`,
    `processStroke=${encodeStyleValue(stroke)}`,
    `processMarker=${encodeStyleValue(marker)}`,
    `processLayerId=${encodeStyleValue(edge.layerId || 'layer-edges')}`,
    `exitX=${exit.x}`,
    `exitY=${exit.y}`,
    'exitDx=0',
    'exitDy=0',
    `entryX=${entry.x}`,
    `entryY=${entry.y}`,
    'entryDx=0',
    'entryDy=0'
  ]

  if (route === 'straight') {
    parts.push('edgeStyle=none')
  } else {
    parts.push('edgeStyle=orthogonalEdgeStyle')
    if (route === 'curve') {
      parts.push('curved=1')
    }
  }

  if (stroke === 'dashed') {
    parts.push('dashed=1')
  } else if (stroke === 'dotted') {
    parts.push('dashed=1', 'dashPattern=1 4')
  }

  if (marker === 'none') {
    parts.push('endArrow=none')
  } else if (marker === 'double-arrow') {
    parts.push('startArrow=classic', 'endArrow=classic')
  } else {
    parts.push('endArrow=classic')
  }

  return `${parts.join(';')};`
}

function groupBounds(nodes) {
  const left = Math.min(...nodes.map(node => node.x))
  const top = Math.min(...nodes.map(node => node.y))
  const right = Math.max(...nodes.map(node => node.x + node.width))
  const bottom = Math.max(...nodes.map(node => node.y + node.height))
  return { x: left, y: top, width: right - left, height: bottom - top }
}

function formatNumber(value, fallback = 0) {
  const number = Number(value)
  return String(Math.round(Number.isFinite(number) ? number : fallback))
}

export function exportDrawioDocument(document) {
  const content = document?.content || {}
  const pages = Array.isArray(content.pages) && content.pages.length
    ? content.pages
    : [{ id: 'page-1', name: document?.title || 'Page 1', ...content }]

  return [
    '<mxfile host="Process" agent="Process" version="21.0.0">',
    ...pages.map((page, index) => buildDiagramPage(document, page, index)),
    '</mxfile>'
  ].join('\n')
}

function buildDiagramPage(document, page, pageIndex) {
  const content = page || {}
  const nodes = Array.isArray(content.nodes) ? content.nodes : []
  const edges = Array.isArray(content.edges) ? content.edges : []
  const textBlocks = Array.isArray(content.textBlocks) ? content.textBlocks : []
  const rawLayers = Array.isArray(content.layers) && content.layers.length
    ? content.layers
    : [
        { id: 'layer-edges', name: '连线', visible: true, locked: false, order: 0 },
        { id: 'layer-nodes', name: '节点', visible: true, locked: false, order: 1 }
      ]
  const layers = [...rawLayers].sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
  const pageWidth = Math.max(320, Number(content.page?.width) || 1200)
  const pageHeight = Math.max(240, Number(content.page?.height) || 720)
  const showGrid = content.showGrid !== false

  const usedIds = new Set(['0'])
  const layerCellIds = new Map()
  const layerDepth = new Map()
  const layerCells = []

  layers.forEach((layer, index) => {
    const cellId = uniqueId(index === 0 ? '1' : `layer-${index + 1}`, usedIds)
    const layerId = String(layer.id || `layer-${index + 1}`)
    const style = [
      `processLayerId=${encodeStyleValue(layerId)}`,
      layer.locked ? 'locked=1' : '',
      'html=0'
    ].filter(Boolean).join(';')
    layerCellIds.set(layerId, cellId)
    layerDepth.set(cellId, 0)
    layerCells.push(
      `        <mxCell id="${escapeXml(cellId)}" value="${escapeXml(layer.name || `图层 ${index + 1}`)}" ` +
      `style="${escapeXml(style)};" parent="0"${layer.visible === false ? ' visible="0"' : ''}/>`
    )
  })

  const fallbackLayerId = layers[0]?.id || 'layer-nodes'
  const fallbackLayerCellId = layerCellIds.get(fallbackLayerId)

  function resolveLayerCellId(layerId) {
    return layerCellIds.get(layerId) || fallbackLayerCellId
  }

  const nodeById = new Map(nodes.map(node => [node.id, node]))
  const nodeCellIds = new Map()
  nodes.forEach(node => {
    nodeCellIds.set(node.id, uniqueId(node.id || `node-${nodeCellIds.size + 1}`, usedIds))
  })
  const edgeCellIds = new Map()
  edges.forEach(edge => {
    edgeCellIds.set(edge.id, uniqueId(edge.id || `edge-${edgeCellIds.size + 1}`, usedIds))
  })

  const groupMembers = new Map()
  nodes.forEach(node => {
    if (!node.groupId) return
    if (!groupMembers.has(node.groupId)) groupMembers.set(node.groupId, [])
    groupMembers.get(node.groupId).push(node)
  })

  const groups = [...groupMembers.entries()]
    .filter(([, members]) => members.length >= 2)
    .map(([groupId, members]) => {
      const containerIds = new Set(members.map(node => node.containerId || null))
      const commonContainerId = containerIds.size === 1 ? [...containerIds][0] : null
      const container = commonContainerId ? nodeById.get(commonContainerId) : null
      const parentCellId = container && !members.includes(container)
        ? nodeCellIds.get(container.id)
        : resolveLayerCellId(members[0].layerId)
      return {
        groupId,
        members,
        bounds: groupBounds(members),
        parentCellId
      }
    })

  const groupByModelId = new Map(groups.map(group => [group.groupId, group]))
  const groupCellIds = new Map()
  groups.forEach((group, index) => {
    groupCellIds.set(group.groupId, uniqueId(`group-${index + 1}`, usedIds))
  })
  const groupCellIdSet = new Set(groupCellIds.values())
  const containerCellIdSet = new Set(
    nodes.filter(node => node.kind === 'container' || node.kind === 'swimlane')
      .map(node => nodeCellIds.get(node.id))
  )

  function parentOrigin(parentCellId) {
    if (groupCellIdSet.has(parentCellId)) {
      const group = groups.find(item => groupCellIds.get(item.groupId) === parentCellId)
      return group ? { x: group.bounds.x, y: group.bounds.y } : { x: 0, y: 0 }
    }
    if (containerCellIdSet.has(parentCellId)) {
      const container = nodes.find(node => nodeCellIds.get(node.id) === parentCellId)
      return container ? { x: container.x, y: container.y } : { x: 0, y: 0 }
    }
    return { x: 0, y: 0 }
  }

  function nodeParentCellId(node) {
    const group = groupByModelId.get(node.groupId)
    if (group) {
      return groupCellIds.get(group.groupId)
    }
    if (node.containerId && nodeById.has(node.containerId)) {
      return nodeCellIds.get(node.containerId)
    }
    return resolveLayerCellId(node.layerId)
  }

  const cells = []
  const cellParentById = new Map()

  groups.forEach(group => {
    const cellId = groupCellIds.get(group.groupId)
    const origin = parentOrigin(group.parentCellId)
    const style = [
      'group',
      'html=0',
      'pointerEvents=0',
      `processGroupId=${encodeStyleValue(group.groupId)}`,
      `processLayerId=${encodeStyleValue(group.members[0].layerId || fallbackLayerId)}`
    ].join(';')
    cellParentById.set(cellId, group.parentCellId)
    cells.push({
      parentCellId: group.parentCellId,
      xml:
        `        <mxCell id="${escapeXml(cellId)}" value="" style="${escapeXml(style)};" vertex="1" connectable="0" parent="${escapeXml(group.parentCellId)}">\n` +
        `          <mxGeometry x="${formatNumber(group.bounds.x - origin.x)}" y="${formatNumber(group.bounds.y - origin.y)}" ` +
        `width="${formatNumber(group.bounds.width)}" height="${formatNumber(group.bounds.height)}" as="geometry"/>\n` +
        '        </mxCell>'
    })
  })

  nodes.forEach(node => {
    const cellId = nodeCellIds.get(node.id)
    const parentCellId = nodeParentCellId(node)
    const origin = parentOrigin(parentCellId)
    const rotation = ((Number(node.rotation) || 0) % 360 + 360) % 360
    const geometry = [
      `x="${formatNumber(node.x - origin.x)}"`,
      `y="${formatNumber(node.y - origin.y)}"`,
      `width="${formatNumber(node.width, 160)}"`,
      `height="${formatNumber(node.height, 64)}"`,
      rotation ? `rotation="${formatNumber(rotation)}"` : '',
      'as="geometry"'
    ].filter(Boolean).join(' ')
    const optionalAttrs = [
      node.link ? `link="${escapeXml(node.link)}"` : '',
      node.tooltip ? `tooltip="${escapeXml(node.tooltip)}"` : ''
    ].filter(Boolean).join(' ')
    cellParentById.set(cellId, parentCellId)
    cells.push({
      parentCellId,
      xml:
        `        <mxCell id="${escapeXml(cellId)}" value="${escapeDrawioValue(node.text || '')}" ` +
        `style="${escapeXml(shapeToDrawioStyle(node))}" vertex="1" parent="${escapeXml(parentCellId)}"${optionalAttrs ? ` ${optionalAttrs}` : ''}>\n` +
        `          <mxGeometry ${geometry}/>\n` +
        '        </mxCell>'
    })
  })

  const NOTE_BLOCK_WIDTH = 220
  const NOTE_BLOCK_GAP = 28
  const NOTE_BLOCK_PADDING = 24
  const textBlockStackOffsets = new Map()
  textBlocks.forEach(block => {
    const node = nodeById.get(block.nodeId)
    if (!node || !hasMindNoteBlockContent(block)) {
      return
    }
    const width = Math.max(180, Number(block.width) || NOTE_BLOCK_WIDTH)
    const height = estimateMindNoteBlockHeight(block, width)
    const offsetX = Number(block.offsetX) || 0
    const offsetY = Number(block.offsetY) || 0
    const preferredX = node.x + node.width + NOTE_BLOCK_GAP
    const fallbackX = node.x - width - NOTE_BLOCK_GAP
    const baseX = preferredX + width <= pageWidth - NOTE_BLOCK_PADDING
      ? preferredX
      : Math.max(NOTE_BLOCK_PADDING, fallbackX)
    const stackOffset = textBlockStackOffsets.get(block.nodeId) || 0
    const x = baseX + offsetX
    const y = Math.max(NOTE_BLOCK_PADDING, node.y - 4 + stackOffset + offsetY)
    textBlockStackOffsets.set(block.nodeId, stackOffset + height + 12)
    const text = String(block.text || '')
    const layerId = block.layerId || 'layer-notes'
    const parentCellId = resolveLayerCellId(layerId)
    const cellId = uniqueId(block.id || `note-block-${textBlocks.indexOf(block) + 1}`, usedIds)
    const style = [
      'rounded=1',
      'arcSize=8',
      'html=0',
      'whiteSpace=wrap',
      'align=left',
      'verticalAlign=top',
      'fillColor=#ffffff',
      'strokeColor=#cbd5e1',
      'fontColor=#334155',
      'fontSize=12',
      `processTextBlockId=${encodeStyleValue(block.id || cellId)}`,
      `processNodeId=${encodeStyleValue(block.nodeId || '')}`,
      `processFormat=${encodeStyleValue(block.format || 'rich')}`,
      `processLinkUrl=${encodeStyleValue(block.linkUrl || '')}`,
      `processHtml=${encodeStyleValue(block.html || '')}`,
      `processWidth=${formatNumber(width)}`,
      `processHeight=${formatNumber(height)}`,
      `processOffsetX=${formatNumber(offsetX)}`,
      `processOffsetY=${formatNumber(offsetY)}`,
      `processLayerId=${encodeStyleValue(layerId)}`
    ].join(';')
    cellParentById.set(cellId, parentCellId)
    cells.push({
      parentCellId,
      xml:
        `        <mxCell id="${escapeXml(cellId)}" value="${escapeDrawioValue(text)}" style="${escapeXml(style)};" vertex="1" parent="${escapeXml(parentCellId)}">\n` +
        `          <mxGeometry x="${formatNumber(x)}" y="${formatNumber(y)}" width="${formatNumber(width)}" height="${formatNumber(height)}" as="geometry"/>\n` +
        '        </mxCell>'
    })
  })

  edges.forEach(edge => {
    const parentCellId = resolveLayerCellId(edge.layerId)
    const waypoints = Array.isArray(edge.style?.waypoints) ? edge.style.waypoints : []
    const pointsXml = waypoints.length
      ? '\n            <Array as="points">\n' +
        waypoints.map(point =>
          `              <mxPoint x="${formatNumber(point.x)}" y="${formatNumber(point.y)}"/>`
        ).join('\n') +
        '\n            </Array>\n          '
      : ''
    const geometry = waypoints.length
      ? `<mxGeometry relative="1" as="geometry">${pointsXml}</mxGeometry>`
      : '<mxGeometry relative="1" as="geometry"/>'
    cellParentById.set(edgeCellIds.get(edge.id), parentCellId)
    cells.push({
      parentCellId,
      xml:
        `        <mxCell id="${escapeXml(edgeCellIds.get(edge.id))}" value="${escapeDrawioValue(edge.label || '')}" ` +
        `style="${escapeXml(edgeToDrawioStyle(edge))}" edge="1" parent="${escapeXml(parentCellId)}" ` +
        `source="${escapeXml(nodeCellIds.get(edge.fromNodeId) || edge.fromNodeId)}" ` +
        `target="${escapeXml(nodeCellIds.get(edge.toNodeId) || edge.toNodeId)}">\n` +
        `          ${geometry}\n` +
        '        </mxCell>'
    })
  })

  const depthCache = new Map()
  function parentDepth(cellId, seen = new Set()) {
    if (!cellId || cellId === '0') return 0
    if (layerDepth.has(cellId)) return 1
    if (depthCache.has(cellId)) return depthCache.get(cellId)
    if (seen.has(cellId)) return 1
    seen.add(cellId)
    const depth = parentDepth(cellParentById.get(cellId), seen) + 1
    depthCache.set(cellId, depth)
    return depth
  }

  const orderedCells = cells
    .map((cell, index) => ({ ...cell, index, depth: parentDepth(cell.parentCellId) }))
    .sort((left, right) => left.depth - right.depth || left.index - right.index)
    .map(cell => cell.xml)

  const gridSize = 20
  const modelAttrs = [
    'dx="0"',
    'dy="0"',
    `grid="${showGrid ? 1 : 0}"`,
    `gridSize="${gridSize}"`,
    'guides="1"',
    'tooltips="1"',
    'connect="1"',
    'arrows="1"',
    'fold="1"',
    'page="1"',
    'pageScale="1"',
    `pageWidth="${formatNumber(pageWidth)}"`,
    `pageHeight="${formatNumber(pageHeight)}"`,
    `processMode="${escapeXml(document?.mode || 'flowchart')}"`,
    'math="0"',
    'shadow="0"'
  ].join(' ')

  return [
    `  <diagram id="process-${escapeXml(document?.id || 'doc')}-${pageIndex + 1}" name="${escapeXml(page?.name || document?.title || `Page ${pageIndex + 1}`)}">`,
    `    <mxGraphModel ${modelAttrs}>`,
    '      <root>',
    '        <mxCell id="0"/>',
    ...layerCells,
    ...orderedCells,
    '      </root>',
    '    </mxGraphModel>',
    '  </diagram>'
  ].join('\n')
}

function parseAnchor(style, prefix) {
  const custom = style[`process${prefix === 'exit' ? 'From' : 'To'}Anchor`]
  if (custom) {
    const anchor = decodeStyleValue(custom)
    if (ANCHOR_TO_EXIT[anchor]) return anchor
  }

  const x = Number(style[`${prefix}X`])
  const y = Number(style[`${prefix}Y`])
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null
  }
  return EXIT_TO_ANCHOR[`${x}|${y}`] || null
}

function parseStyle(styleText) {
  return String(styleText || '')
    .split(';')
    .filter(Boolean)
    .reduce((acc, pair) => {
      const index = pair.indexOf('=')
      if (index === -1) {
        acc[pair.trim()] = '1'
        return acc
      }
      acc[pair.slice(0, index).trim()] = pair.slice(index + 1).trim()
      return acc
    }, {})
}

function inferKind(style) {
  const customKind = style.processKind ? decodeStyleValue(style.processKind) : ''
  if (NODE_KINDS.has(customKind)) return customKind
  if (style.ellipse !== undefined) return 'ellipse'
  if (style.rhombus !== undefined) return 'decision'
  if (style.shape === 'parallelogram') return 'parallelogram'
  if (style.shape === 'hexagon') return 'hexagon'
  if (style.shape === 'document') return 'document'
  if (style.shape === 'cylinder3') return 'cylinder'
  if (style.shape === 'cloud') return 'cloud'
  if (style.shape === 'note') return 'note'
  if (style.shape === 'card') return 'card'
  if (style.shape === 'delay') return 'delay'
  if (style.shape === 'flexArrow') return 'arrow'
  if (style.shape === 'cross') return 'cross'
  if (style.shape === 'umlActor') return 'actor'
  if (style.container === '1') return 'container'
  if (style.swimlane !== undefined) return 'swimlane'
  if (style.triangle !== undefined) return 'triangle'
  if (style.rounded === '1') return 'roundrect'
  return 'process'
}

function normalizeDrawioLabel(value, style) {
  if (!value) return ''
  if (style.html === '0') return value
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p|li)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{2,}/g, '\n')
    .trim()
}

function numberAttribute(element, name, fallback = 0) {
  const value = Number(element?.getAttribute?.(name))
  return Number.isFinite(value) ? value : fallback
}

function inflateCompressedDiagram(diagram) {
  const encoded = String(diagram?.textContent || '').replace(/\s+/g, '')
  if (!encoded || !/^[A-Za-z0-9+/=]+$/.test(encoded)) {
    return ''
  }

  try {
    const binary = globalThis.atob(encoded)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index)
    }
    const inflated = inflateRaw(bytes, { to: 'string' })
    try {
      return decodeURIComponent(inflated)
    } catch {
      return inflated
    }
  } catch {
    return ''
  }
}

function readGeometry(cell) {
  const geometry = cell.querySelector('mxGeometry')
  if (!geometry) return null
  return {
    x: numberAttribute(geometry, 'x', 0),
    y: numberAttribute(geometry, 'y', 0),
    width: numberAttribute(geometry, 'width', 0),
    height: numberAttribute(geometry, 'height', 0),
    rotation: numberAttribute(geometry, 'rotation', 0),
    points: [...geometry.querySelectorAll('Array[as="points"] mxPoint')].map(point => ({
      x: numberAttribute(point, 'x', 0),
      y: numberAttribute(point, 'y', 0)
    }))
  }
}

function descendantLayerId(cell, cellById, layerIdByCell, fallback = 'layer-nodes') {
  let current = cell
  const seen = new Set()
  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    if (layerIdByCell.has(current.id)) return layerIdByCell.get(current.id)
    const parentId = current.getAttribute('parent')
    if (!parentId || parentId === '0') break
    current = cellById.get(parentId)
  }
  return fallback
}

function ancestorGroupId(cell, cellById) {
  let current = cell
  const seen = new Set()
  while (current) {
    if (seen.has(current.id)) break
    seen.add(current.id)
    const style = parseStyle(current.getAttribute('style'))
    if (style.group !== undefined && style.processGroupId) {
      return decodeStyleValue(style.processGroupId)
    }
    if (style.group !== undefined) {
      return current.id
    }
    const parentId = current.getAttribute('parent')
    current = parentId ? cellById.get(parentId) : null
  }
  return null
}

function ancestorContainerId(cell, cellById) {
  let current = cell
  let parentId = current?.getAttribute?.('parent')
  const seen = new Set()
  while (parentId && parentId !== '0' && !seen.has(parentId)) {
    seen.add(parentId)
    const parent = cellById.get(parentId)
    if (!parent) break
    const style = parseStyle(parent.getAttribute('style'))
    if (parent.getAttribute('vertex') === '1' &&
        (style.container === '1' || style.swimlane !== undefined || style.processKind === 'container' || style.processKind === 'swimlane')) {
      return decodeStyleValue(style.processContainerId || parent.id)
    }
    parentId = parent.getAttribute('parent')
  }
  return null
}

export function importDrawioDocument(xmlText, options = {}) {
  if (typeof DOMParser === 'undefined') {
    throw new Error('当前环境不支持 XML 解析')
  }

  const parser = new DOMParser()
  const xml = parser.parseFromString(String(xmlText || ''), 'text/xml')
  if (xml.querySelector('parsererror')) {
    throw new Error('文件不是有效的 XML')
  }

  const diagramElements = [...xml.querySelectorAll('diagram')]
  if (!options.single && diagramElements.length > 1) {
    const serializer = new XMLSerializer()
    const pages = diagramElements.flatMap((diagramElement, index) => {
      try {
        const singleDiagram = serializer.serializeToString(diagramElement)
        const parsed = importDrawioDocument(`<mxfile>${singleDiagram}</mxfile>`, { single: true, allowEmpty: true })
        return [{
          id: diagramElement.getAttribute('id') || `page-${index + 1}`,
          name: diagramElement.getAttribute('name') || `Page ${index + 1}`,
          ...parsed
        }]
      } catch {
        return []
      }
    })

    if (!pages.length) {
      throw new Error('文件里没有可导入的图形')
    }

    return {
      ...pages[0],
      pages
    }
  }

  let diagram = xml.querySelector('diagram') || xml.documentElement
  let model = diagram.querySelector('mxGraphModel') || xml.querySelector('mxGraphModel')
  let cells = [...diagram.querySelectorAll('mxCell')]

  if (!cells.length) {
    const inflated = inflateCompressedDiagram(diagram)
    if (inflated) {
      const inner = parser.parseFromString(inflated, 'text/xml')
      if (inner.querySelector('parsererror')) {
        throw new Error('压缩的 .drawio 内容不是有效 XML')
      }
      diagram = inner.querySelector('diagram') || inner.documentElement
      model = inner.querySelector('mxGraphModel') || inner.querySelector('root')?.parentElement || null
      cells = [...diagram.querySelectorAll('mxCell')]
    }
  }

  if (!cells.length) {
    throw new Error('没有找到 mxCell，可能不是 .drawio 文件')
  }

  const cellById = new Map(cells.map(cell => [cell.getAttribute('id'), cell]))
  const layers = []
  const layerIdByCell = new Map()
  let fallbackLayerId = 'layer-nodes'

  cells.forEach((cell, index) => {
    const id = cell.getAttribute('id')
    if (!id || id === '0' || cell.getAttribute('vertex') === '1' || cell.getAttribute('edge') === '1') {
      return
    }
    if (cell.getAttribute('parent') !== '0') return

    const style = parseStyle(cell.getAttribute('style'))
    const layerId = decodeStyleValue(style.processLayerId || id)
    if (index === 0 || !layers.length) fallbackLayerId = layerId
    layerIdByCell.set(id, layerId)
    layers.push({
      id: layerId,
      name: normalizeDrawioLabel(cell.getAttribute('value') || `图层 ${layers.length + 1}`, {}),
      visible: cell.getAttribute('visible') !== '0' && style.processVisible !== '0',
      locked: style.locked === '1' || style.processLocked === '1',
      order: layers.length
    })
  })

  const rawNodes = []
  const rawEdges = []
  const rawTextBlocks = []
  const groupCells = new Map()
  let fallbackNodeLayerId = fallbackLayerId

  cells.forEach(cell => {
    const id = cell.getAttribute('id')
    if (!id || id === '0') return
    const style = parseStyle(cell.getAttribute('style'))
    const geometry = readGeometry(cell)
    const parentId = cell.getAttribute('parent')

    if (cell.getAttribute('vertex') === '1' && geometry && style.processTextBlockId) {
      const layerId = style.processLayerId
        ? decodeStyleValue(style.processLayerId)
        : descendantLayerId(cell, cellById, layerIdByCell, fallbackNodeLayerId)
      rawTextBlocks.push({
        id: decodeStyleValue(style.processTextBlockId) || id,
        nodeId: decodeStyleValue(style.processNodeId || ''),
        text: normalizeDrawioLabel(cell.getAttribute('value') || '', style),
        html: decodeStyleValue(style.processHtml || ''),
        format: decodeStyleValue(style.processFormat || 'rich'),
        linkUrl: decodeStyleValue(style.processLinkUrl || ''),
        width: Number(decodeStyleValue(style.processWidth || '0')) || null,
        height: Number(decodeStyleValue(style.processHeight || '0')) || null,
        offsetX: Number(decodeStyleValue(style.processOffsetX || '0')) || 0,
        offsetY: Number(decodeStyleValue(style.processOffsetY || '0')) || 0,
        layerId,
        x: geometry.x,
        y: geometry.y
      })
      return
    }

    if (cell.getAttribute('vertex') === '1' && geometry && style.group !== undefined) {
      const groupId = decodeStyleValue(style.processGroupId || id)
      groupCells.set(id, { id, groupId, geometry, parentId })
      return
    }

    if (cell.getAttribute('vertex') === '1' && geometry) {
      const layerId = style.processLayerId
        ? decodeStyleValue(style.processLayerId)
        : descendantLayerId(cell, cellById, layerIdByCell, fallbackNodeLayerId)
      rawNodes.push({
        id,
        kind: inferKind(style),
        x: geometry.x,
        y: geometry.y,
        width: geometry.width || 160,
        height: geometry.height || 64,
        rotation: geometry.rotation,
        text: normalizeDrawioLabel(cell.getAttribute('value') || '', style),
        layerId,
        containerId: style.processContainerId
          ? decodeStyleValue(style.processContainerId)
          : ancestorContainerId(cell, cellById),
        groupId: style.processGroupId
          ? decodeStyleValue(style.processGroupId)
          : ancestorGroupId(cell, cellById),
        locked: style.processLocked === '1' || style.locked === '1',
        image: style.processImage
          ? decodeStyleValue(style.processImage)
          : (style.image && /^(https?:|data:image\/)/.test(style.image) ? style.image : ''),
        link: style.processLink
          ? decodeStyleValue(style.processLink)
          : (cell.getAttribute('link') || ''),
        tooltip: style.processTooltip
          ? decodeStyleValue(style.processTooltip)
          : (cell.getAttribute('tooltip') || ''),
        style: {
          accent: decodeStyleValue(style.processAccent || 'slate'),
          theme: decodeStyleValue(style.processTheme || 'aurora'),
          elevation: decodeStyleValue(style.processElevation || 'soft')
        }
      })
      return
    }

    const source = cell.getAttribute('source')
    const target = cell.getAttribute('target')
    if (cell.getAttribute('edge') === '1' && source && target) {
      const layerId = style.processLayerId
        ? decodeStyleValue(style.processLayerId)
        : descendantLayerId(cell, cellById, layerIdByCell, fallbackNodeLayerId)
      const route = style.processRoute
        ? decodeStyleValue(style.processRoute)
        : (style.curved === '1' ? 'curve' : (style.edgeStyle === 'none' ? 'straight' : 'orthogonal'))
      const stroke = style.processStroke
        ? decodeStyleValue(style.processStroke)
        : (style.dashed === '1'
            ? (style.dashPattern === '1 4' || style.dashPattern === '1 2' ? 'dotted' : 'dashed')
            : 'solid')
      const marker = style.processMarker
        ? decodeStyleValue(style.processMarker)
        : (style.endArrow === 'none'
            ? 'none'
            : (style.startArrow && style.startArrow !== 'none' ? 'double-arrow' : 'arrow'))
      rawEdges.push({
        id,
        fromNodeId: source,
        toNodeId: target,
        fromAnchor: parseAnchor(style, 'exit') || 'right',
        toAnchor: parseAnchor(style, 'entry') || 'left',
        layerId,
        label: normalizeDrawioLabel(cell.getAttribute('value') || '', style),
        style: {
          route,
          stroke,
          marker,
          waypoints: geometry.points.map(point => ({ ...point }))
        }
      })
    }
  })

  // drawio 的子元素坐标相对父元素；本项目模型使用画布绝对坐标。
  const originCache = new Map()
  function absoluteOrigin(cellId, seen = new Set()) {
    if (!cellId || cellId === '0') return { x: 0, y: 0 }
    if (originCache.has(cellId)) return originCache.get(cellId)
    if (seen.has(cellId)) return { x: 0, y: 0 }
    const cell = cellById.get(cellId)
    if (!cell) return { x: 0, y: 0 }
    const geometry = readGeometry(cell)
    if (!geometry) return { x: 0, y: 0 }
    seen.add(cellId)
    const parentId = cell.getAttribute('parent')
    const parentOrigin = absoluteOrigin(parentId, seen)
    const origin = { x: parentOrigin.x + geometry.x, y: parentOrigin.y + geometry.y }
    originCache.set(cellId, origin)
    return origin
  }

  const nodes = rawNodes.map(node => {
    const cell = cellById.get(node.id)
    const parentId = cell?.getAttribute('parent')
    const origin = absoluteOrigin(parentId)
    return {
      ...node,
      x: node.x + origin.x,
      y: node.y + origin.y
    }
  })

  const pageWidthForText = numberAttribute(model, 'pageWidth', 1200)
  const nodeByIdForText = new Map(nodes.map(node => [node.id, node]))
  const textBlocks = rawTextBlocks
    .filter(block => nodeByIdForText.has(block.nodeId))
    .map((block, index) => {
      const node = nodeByIdForText.get(block.nodeId)
      const origin = absoluteOrigin(cellById.get(block.id)?.getAttribute('parent'))
      const x = block.x + origin.x
      const y = block.y + origin.y
      const width = Math.max(180, Number(block.width) || NOTE_BLOCK_WIDTH)
      const preferredX = node.x + node.width + 28
      const fallbackX = node.x - width - 28
      const baseX = preferredX + width <= pageWidthForText - 24
        ? preferredX
        : Math.max(24, fallbackX)
      return {
        id: block.id || `note-block-${index + 1}`,
        nodeId: block.nodeId,
        text: block.text,
        html: block.html,
        format: block.format,
        linkUrl: block.linkUrl,
        width,
        height: block.height,
        offsetX: block.offsetX || Math.round(x - baseX),
        offsetY: block.offsetY || Math.round(y - Math.max(24, node.y - 4)),
        layerId: block.layerId || 'layer-notes'
      }
    })

  const nodeIds = new Set(nodes.map(node => node.id))
  const edges = rawEdges
    .filter(edge => nodeIds.has(edge.fromNodeId) && nodeIds.has(edge.toNodeId))
    .map(edge => {
      const cell = cellById.get(edge.id)
      const origin = absoluteOrigin(cell?.getAttribute('parent'))
      return {
        ...edge,
        style: {
          ...edge.style,
          waypoints: edge.style.waypoints.map(point => ({
            x: point.x + origin.x,
            y: point.y + origin.y
          }))
        }
      }
    })

  if (!nodes.length && !options.allowEmpty) {
    throw new Error('文件里没有可导入的图形')
  }

  if (!layers.length) {
    const ids = new Set(nodes.map(node => node.layerId).filter(Boolean))
    ids.add('layer-edges')
    ids.forEach((id, index) => {
      layers.push({
        id,
        name: id === 'layer-edges' ? '连线' : '节点',
        visible: true,
        locked: false,
        order: index
      })
    })
  }

  const usedLayerIds = new Set()
  layers.forEach((layer, index) => {
    let id = layer.id
    let suffix = 2
    while (usedLayerIds.has(id)) {
      id = `${layer.id}-${suffix}`
      suffix += 1
    }
    layer.id = id
    layer.order = index
    usedLayerIds.add(id)
  })

  const pageWidth = numberAttribute(model, 'pageWidth', 1200)
  const pageHeight = numberAttribute(model, 'pageHeight', 720)

  const importedMode = model?.getAttribute('processMode') || 'flowchart'
  return {
    nodes,
    edges,
    textBlocks,
    mode: ['flowchart', 'mindmap', 'mind-note'].includes(importedMode) ? importedMode : 'flowchart',
    layers,
    page: {
      width: Math.max(320, pageWidth || 1200),
      height: Math.max(240, pageHeight || 720)
    },
    showGrid: model ? model.getAttribute('grid') !== '0' : true
  }
}
