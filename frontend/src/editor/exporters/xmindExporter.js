import JSZip from 'jszip'
import { flattenNodeBlocks } from '../render/noteBlockOps'

export async function buildXMindArchive(document) {
  const { Dumper, Topic, Workbook } = await loadXMindSdk()
  const zip = new JSZip()
  const workbook = buildWorkbook(document, { Topic, Workbook })
  const dumper = new Dumper({ workbook })

  resolveArchiveEntries(dumper.dumping()).forEach(entry => {
    // xmind-sdk 的 Dumper 会写入一个占位 content.xml（内容是多语言“文件无法正常打开”警告），
    // XMind 8 会优先读它，导致导出的文件看起来完全不可用。这里改成真实的内容树。
    if (entry.filename === 'content.xml') {
      zip.file(entry.filename, buildLegacyContentXml(document))
      return
    }
    zip.file(entry.filename, entry.value)
  })

  return zip.generateAsync({ type: 'uint8array' })
}

function resolveDocumentPages(document) {
  const content = document?.content || {}
  const pages = Array.isArray(content.pages) && content.pages.length ? content.pages : []
  if (pages.length) {
    return pages.map((page, index) => ({
      id: page.id || `page-${index + 1}`,
      name: page.name || `页面 ${index + 1}`,
      nodes: Array.isArray(page.nodes) ? page.nodes : [],
      edges: Array.isArray(page.edges) ? page.edges : [],
      textBlocks: Array.isArray(page.textBlocks) ? page.textBlocks : [],
      boundaries: Array.isArray(page.boundaries) ? page.boundaries : [],
      summaries: Array.isArray(page.summaries) ? page.summaries : [],
      layout: page.layout || content.layout || {}
    }))
  }

  return [{
    id: 'page-1',
    name: document?.title || 'Sheet 1',
    nodes: content.nodes || [],
    edges: content.edges || [],
    textBlocks: content.textBlocks || [],
    boundaries: content.boundaries || [],
    summaries: content.summaries || [],
    layout: content.layout || {}
  }]
}

function buildLegacyContentXml(document) {
  const pages = resolveDocumentPages(document)
  const timestamp = Date.now()
  let topicCounter = 0
  const nextTopicId = () => `xmind-topic-${++topicCounter}`

  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="no"?>',
    '<xmap-content xmlns="urn:xmind:xmap:xmlns:content:2.0"',
    ' xmlns:fo="http://www.w3.org/1999/XSL/Format"',
    ' xmlns:svg="http://www.w3.org/2000/svg"',
    ' xmlns:xhtml="http://www.w3.org/1999/xhtml"',
    ' xmlns:xlink="http://www.w3.org/1999/xlink"',
    ' version="2.0">',
    ...pages.map((page, index) => buildLegacySheetXml(page, document, timestamp, index, nextTopicId)),
    '</xmap-content>'
  ].join('')
}

function buildLegacySheetXml(page, document, timestamp, sheetIndex, nextTopicId) {
  const nodes = page.nodes || []
  const noteMap = collectNodeNotes(page.textBlocks || [])
  const childrenMap = new Map()
  nodes.forEach(node => {
    if (!node.parentId) {
      return
    }
    const children = childrenMap.get(node.parentId) || []
    children.push(node)
    childrenMap.set(node.parentId, children)
  })

  const root = nodes.find(node => !node.parentId) || nodes[0] || {
    id: `page-${sheetIndex + 1}-root`,
    text: page.name || document?.title || '中心主题'
  }
  const topicIds = new Map()
  nodes.forEach(node => topicIds.set(node.id, nextTopicId()))
  const rootId = topicIds.get(root.id) || nextTopicId()
  const structureClass = resolveStructureClass(page.layout?.direction)
  const boundaryByNode = new Map((page.boundaries || []).map(boundary => [boundary.nodeId, boundary]))

  function boundariesXml(node) {
    const boundary = boundaryByNode.get(node?.id)
    if (!boundary) {
      return ''
    }
    return `<boundaries><boundary id="${escapeXml(boundary.id)}" range="${escapeXml(topicIds.get(node.id) || '')}"/></boundaries>`
  }

  function noteXml(node) {
    const parts = [String(node.note || '').trim(), ...(noteMap.get(node.id) || [])].filter(Boolean)
    if (!parts.length) {
      return ''
    }
    return `<notes><plain>${escapeXml(parts.join('\n\n'))}</plain></notes>`
  }

  function topicXml(node) {
    const children = childrenMap.get(node.id) || []
    const childrenXml = children.length
      ? `<children><topics type="attached">${children.map(topicXml).join('')}</topics></children>`
      : ''
    return [
      `<topic id="${escapeXml(topicIds.get(node.id) || nextTopicId())}" timestamp="${timestamp}">`,
      `<title>${escapeXml(node.text || '未命名主题')}</title>`,
      markerRefsXml(node),
      labelsXml(node),
      boundariesXml(node),
      noteXml(node),
      childrenXml,
      '</topic>'
    ].join('')
  }

  return [
    `<sheet id="xmind-sheet-${sheetIndex + 1}" timestamp="${timestamp}">`,
    `<topic id="${escapeXml(rootId)}" structure-class="${structureClass}" timestamp="${timestamp}">`,
    `<title>${escapeXml(root.text || '中心主题')}</title>`,
    markerRefsXml(root),
    labelsXml(root),
    boundariesXml(root),
    noteXml(root),
    (childrenMap.get(root.id) || []).length
      ? `<children><topics type="attached">${(childrenMap.get(root.id) || []).map(topicXml).join('')}</topics></children>`
      : '',
    '</topic>',
    relationshipsXml(page, topicIds),
    `<title>${escapeXml(page.name || document?.title || '思维导图')}</title>`,
    '</sheet>'
  ].join('')
}

// 我们的标记 id → XMind marker id
const XMIND_MARKER_IDS = {
  star: 'star-red',
  flag: 'flag-red',
  alert: 'symbol-exclam',
  check: 'symbol-right',
  cross: 'symbol-wrong',
  question: 'symbol-question',
  pin: 'symbol-pin',
  warning: 'symbol-attention',
  clock: 'other-clock',
  idea: 'other-lightbulb'
}

function resolveMarkerIds(node = {}) {
  const ids = []
  if (node.priority) {
    ids.push(`priority-${node.priority}`)
  }
  ;(node.markers || []).forEach(markerId => {
    const mapped = XMIND_MARKER_IDS[markerId]
    if (mapped) {
      ids.push(mapped)
    }
  })
  if (Number(node.progress) >= 100) {
    ids.push('task-done')
  }
  return ids
}

function markerRefsXml(node) {
  const ids = resolveMarkerIds(node)
  if (!ids.length) {
    return ''
  }
  return `<marker-refs>${ids.map(id => `<marker-ref marker-id="${escapeXml(id)}"/>`).join('')}</marker-refs>`
}

function labelsXml(node) {
  const labels = (node.labels || [])
    .map(label => String(label || '').trim())
    .filter(Boolean)
    .slice(0, 5)
  if (!labels.length) {
    return ''
  }
  return `<labels>${labels.map(label => `<label>${escapeXml(label)}</label>`).join('')}</labels>`
}

function resolveStructureClass(direction) {
  if (direction === 'left') {
    return 'org.xmind.ui.logic.left'
  }
  if (direction === 'down') {
    return 'org.xmind.ui.org-chart.down'
  }
  return 'org.xmind.ui.logic.right'
}

function escapeXml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

// 联系线（关系线）：XMind 8 的 <relationships> 节点
function relationshipsXml(page, topicIds) {
  const edges = (page.edges || []).filter(edge => edge.kind === 'relationship')
  if (!edges.length) {
    return ''
  }

  const items = edges.map((edge, index) => {
    const end1 = topicIds.get(edge.fromNodeId)
    const end2 = topicIds.get(edge.toNodeId)
    if (!end1 || !end2) {
      return ''
    }
    const title = edge.label ? `<title>${escapeXml(edge.label)}</title>` : ''
    return `<relationship id="${escapeXml(edge.id || `relationship-${index + 1}`)}" end1="${escapeXml(end1)}" end2="${escapeXml(end2)}">${title}</relationship>`
  }).filter(Boolean)

  return items.length ? `<relationships>${items.join('')}</relationships>` : ''
}

export async function exportXMindDocument(document, fileName = 'diagram.xmind') {
  const archive = await buildXMindArchive(document)
  return {
    blob: new Blob([archive], { type: 'application/vnd.xmind.workbook' }),
    fileName
  }
}

function buildWorkbook(document, sdk) {
  const { Topic, Workbook } = sdk
  const pages = resolveDocumentPages(document)
  const workbook = new Workbook()
  const models = pages.map((page, index) => createPageModel(page, document, index))

  const usedSheetNames = new Set()
  const sheetOptions = models.map((model, index) => ({
    s: uniqueSheetName(model.page.name || document.title || `页面 ${index + 1}`, usedSheetNames),
    t: model.root.text || '中心主题'
  }))
  const sheetInfos = workbook.createSheets(sheetOptions)

  models.forEach((model, index) => {
    const sheet = workbook.getSheet(sheetInfos[index].id)
    const topic = new Topic({ sheet })
    const rootTopicId = topic.rootTopicId
    workbook.sheet = sheet
    workbook.theme(sheetOptions[index].s, 'snowbrush')
    attachNote(topic, rootTopicId, model.notePartsFor(model.root))
    appendPageChildren(topic, model, model.root.id, rootTopicId)
  })

  return workbook
}

function createPageModel(page, document, index) {
  const nodes = page.nodes || []
  const noteMap = collectNodeNotes(page.textBlocks || [])
  const childrenMap = new Map()
  nodes.forEach(node => {
    if (!node.parentId) {
      return
    }
    const children = childrenMap.get(node.parentId) || []
    children.push(node)
    childrenMap.set(node.parentId, children)
  })

  const root = nodes.find(node => !node.parentId) || nodes[0] || {
    id: `page-${index + 1}-root`,
    text: page.name || document?.title || '中心主题'
  }

  function notePartsFor(node) {
    if (!node) {
      return []
    }
    const note = String(node.note || '').trim()
    return [note, ...(noteMap.get(node.id) || [])].filter(Boolean)
  }

  return { page, nodes, childrenMap, root, notePartsFor }
}

function appendPageChildren(topic, model, parentNodeId, parentTopicId) {
  const children = model.childrenMap.get(parentNodeId) || []
  children.forEach(child => {
    topic.on(parentTopicId).add({
      title: child.text || '未命名主题',
      customId: child.id
    })

    const childTopicId = topic.cid()
    attachNote(topic, childTopicId, model.notePartsFor(child))
    appendPageChildren(topic, model, child.id, childTopicId)
  })
}

function uniqueSheetName(name, used) {
  const base = String(name || 'Sheet').trim() || 'Sheet'
  let candidate = base
  let suffix = 2
  while (used.has(candidate)) {
    candidate = `${base} (${suffix})`
    suffix += 1
  }
  used.add(candidate)
  return candidate
}

function collectNodeNotes(textBlocks = []) {
  const map = new Map()
  const nodeIds = new Set((textBlocks || []).map(block => block.nodeId).filter(Boolean))
  nodeIds.forEach(nodeId => {
    const notes = flattenNodeBlocks(textBlocks, nodeId)
      .map(block => {
        const text = String(block.text || '').trim()
        if (!text) {
          return ''
        }
        return text
          .split(/\r?\n/)
          .map(line => `${'  '.repeat(block.depth || 0)}${line}`)
          .join('\n')
      })
      .filter(Boolean)
    if (notes.length) {
      map.set(nodeId, notes)
    }
  })
  return map
}

function attachNote(topic, topicId, noteParts = []) {
  if (!topicId || !noteParts?.length) {
    return
  }

  topic.on(topicId).note(noteParts.join('\n\n'))
}

async function loadXMindSdk() {
  const moduleErrors = []

  try {
    const sdkModule = await import('xmind/dist/browser')
    const resolved = resolveXMindExports(sdkModule)
    if (resolved) {
      return resolved
    }
  } catch (error) {
    moduleErrors.push(error)
  }

  try {
    const sdkBundle = await import('xmind/dist/xmind-sdk.bundle.js')
    const resolved = resolveXMindExports(sdkBundle) || resolveXMindExports(globalThis)
    if (resolved) {
      return resolved
    }
  } catch (error) {
    moduleErrors.push(error)
  }

  const reason = moduleErrors
    .map(error => error?.message)
    .filter(Boolean)
    .join('；')

  throw new Error(reason ? `XMind SDK 加载失败：${reason}` : 'XMind SDK 加载失败')
}

function resolveArchiveEntries(entries) {
  const normalizedEntries = Array.isArray(entries) ? [...entries] : []
  const fileEntries = normalizedEntries.reduce((manifestEntries, entry) => {
    if (!entry?.filename || entry.filename === 'manifest.json') {
      return manifestEntries
    }

    manifestEntries[entry.filename] = {}
    return manifestEntries
  }, {})

  const manifestIndex = normalizedEntries.findIndex(entry => entry?.filename === 'manifest.json')
  const manifestEntry = {
    filename: 'manifest.json',
    value: JSON.stringify({ 'file-entries': fileEntries })
  }

  if (manifestIndex >= 0) {
    normalizedEntries[manifestIndex] = manifestEntry
    return normalizedEntries
  }

  return [...normalizedEntries, manifestEntry]
}

function resolveXMindExports(source) {
  if (!source) {
    return null
  }

  const candidates = [source, source.default].filter(Boolean)

  for (const candidate of candidates) {
    const Workbook = candidate.Workbook
    const Topic = candidate.Topic
    const Dumper = candidate.Dumper

    if (typeof Workbook === 'function' && typeof Topic === 'function' && typeof Dumper === 'function') {
      return { Workbook, Topic, Dumper }
    }
  }

  return null
}