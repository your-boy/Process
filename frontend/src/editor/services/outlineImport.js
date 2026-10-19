// 大纲类内容的导入：Markdown 列表 / OPML / XMind(.xmind) → Process 思维导图节点
import { normalizeLabels, normalizeNote } from '../model/mindmapMeta'

let idCounter = 0

function nextNodeId() {
  idCounter += 1
  return `topic-${Date.now().toString(36)}-${idCounter}`
}

// Markdown：`# 标题` 作为中心主题，缩进列表（2 空格 / Tab）作为层级
export function parseOutlineItems(text) {
  const items = []
  let rootTitle = ''
  const stack = []

  String(text || '').split(/\r?\n/).forEach(raw => {
    if (!raw.trim()) {
      return
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(raw)
    if (heading) {
      if (!rootTitle && items.length === 0) {
        rootTitle = heading[2].trim()
        return
      }
      items.push({ text: heading[2].trim(), depth: Math.max(0, heading[1].length - 2) })
      return
    }

    const list = /^(\s*)(?:[-*+]|\d+[.)])\s+(.*)$/.exec(raw)
    if (!list) {
      return
    }

    const indent = list[1].replace(/\t/g, '  ').length
    while (stack.length && indent <= stack[stack.length - 1]) {
      stack.pop()
    }
    const depth = stack.length
    stack.push(indent)
    items.push({ text: list[2].trim(), depth })
  })

  return { rootTitle, items }
}

// OPML：<outline text="..."> 递归
export function parseOpmlItems(text) {
  const parser = new DOMParser()
  const xml = parser.parseFromString(String(text || ''), 'text/xml')
  if (xml.querySelector('parsererror')) {
    throw new Error('OPML 解析失败')
  }

  const body = xml.querySelector('body')
  const root = body?.querySelector('outline')
  if (!root) {
    return { rootTitle: '中心主题', items: [] }
  }

  const items = []
  function walk(element, depth) {
    ;[...element.children]
      .filter(child => child.tagName.toLowerCase() === 'outline')
      .forEach(child => {
        items.push({
          text: child.getAttribute('text') || child.getAttribute('title') || '',
          depth
        })
        walk(child, depth + 1)
      })
  }

  walk(root, 0)
  return { rootTitle: root.getAttribute('text') || root.getAttribute('title') || '中心主题', items }
}

function readNote(topic) {
  const note = topic?.notes
  if (!note) {
    return ''
  }
  if (typeof note === 'string') {
    return note
  }
  if (note.plain?.content) {
    return note.plain.content
  }
  if (note.realHTML) {
    return String(note.realHTML).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  }
  return ''
}

// XMind content.json：sheets[].rootTopic.children.attached ...
export function parseXMindContentSheets(content) {
  const sheets = Array.isArray(content)
    ? content
    : (Array.isArray(content?.sheets) ? content.sheets : [content])
  return sheets
    .map((sheet, index) => parseXmindContentSheet(sheet, index))
    .filter(Boolean)
}

export function parseXMindContent(content) {
  const sheets = parseXMindContentSheets(content)
  if (!sheets.length) {
    throw new Error('XMind 内容为空')
  }
  return sheets[0]
}

function parseXmindContentSheet(sheet, index) {
  const root = sheet?.rootTopic || sheet?.topic || sheet
  if (!root || typeof root !== 'object') {
    return null
  }

  const items = []
  function walk(topic, depth) {
    const children = [
      ...(topic.children?.attached || []),
      ...(topic.children?.detached || [])
    ]
    children.forEach(child => {
      items.push({
        text: child.title || '',
        depth,
        note: readNote(child),
        labels: Array.isArray(child.labels) ? child.labels : [],
        markers: Array.isArray(child.markers) ? child.markers : []
      })
      walk(child, depth + 1)
    })
  }

  walk(root, 0)
  return {
    sheetTitle: sheet?.title || root.title || `Sheet ${index + 1}`,
    rootTitle: root.title || '思维导图',
    rootNote: readNote(root),
    rootLabels: Array.isArray(root.labels) ? root.labels : [],
    items
  }
}

// 把「中心主题 + 扁平大纲项」拼成节点数组（parentId 关系）
export function buildMindmapFromItems(rootTitle, items = []) {
  const nodes = []
  const root = {
    id: nextNodeId(),
    text: String(rootTitle || '').trim() || '中心主题'
  }
  nodes.push(root)

  const parents = [root.id]
  items.forEach(item => {
    const depth = Math.max(0, Math.min(Number(item.depth) || 0, parents.length - 1))
    parents.length = depth + 1
    const parentId = parents[depth]
    const node = {
      id: nextNodeId(),
      parentId,
      text: String(item.text || '').trim() || '新主题'
    }
    if (item.note) {
      node.note = normalizeNote(item.note)
    }
    if (Array.isArray(item.labels) && item.labels.length) {
      node.labels = normalizeLabels(item.labels)
    }
    nodes.push(node)
    parents[depth + 1] = node.id
  })

  return nodes
}

// XMind 8（content.xml）：<sheet><topic><title/><marker-refs/><labels/><notes/><children>
const XMIND_MARKER_TO_INTERNAL = {
  'star-red': 'star',
  'star-orange': 'star',
  'flag-red': 'flag',
  'flag-orange': 'flag',
  'symbol-exclam': 'alert',
  'symbol-attention': 'warning',
  'symbol-right': 'check',
  'symbol-wrong': 'cross',
  'symbol-question': 'question',
  'symbol-pin': 'pin',
  'other-clock': 'clock',
  'other-lightbulb': 'idea'
}

function xmlChildren(element, localName) {
  if (!element) {
    return []
  }
  return [...element.children].filter(child => child.localName === localName)
}

function readXmindTopic(element) {
  const sourceId = element.getAttribute('id') || ''
  const title = xmlChildren(element, 'title')[0]?.textContent || ''
  const notesElement = xmlChildren(element, 'notes')[0]
  const note = xmlChildren(notesElement, 'plain')[0]?.textContent || ''
  const labelsElement = xmlChildren(element, 'labels')[0]
  const labels = xmlChildren(labelsElement, 'label')
    .map(label => label.textContent.trim())
    .filter(Boolean)
  const markerRefs = xmlChildren(element, 'marker-refs')[0]
  const markers = xmlChildren(markerRefs, 'marker-ref')
    .map(ref => ref.getAttribute('marker-id'))
    .filter(Boolean)
  const boundariesElement = xmlChildren(element, 'boundaries')[0]
  const boundaryRanges = xmlChildren(boundariesElement, 'boundary')
    .map(boundary => boundary.getAttribute('range'))
    .filter(Boolean)
  return { sourceId, text: title, note, labels, markers, boundaryRanges }
}

export function parseXMindXmlSheets(text) {
  const parser = new DOMParser()
  const xml = parser.parseFromString(String(text || ''), 'text/xml')
  if (xml.querySelector('parsererror')) {
    throw new Error('XMind content.xml 解析失败')
  }

  const sheetElements = [...xml.getElementsByTagName('sheet')]
  const sheets = sheetElements.length ? sheetElements : [null]
  return sheets
    .map((sheet, index) => parseXmindSheet(xml, sheet, index))
    .filter(Boolean)
}

export function parseXMindXml(text) {
  const sheets = parseXMindXmlSheets(text)
  if (!sheets.length) {
    throw new Error('XMind 内容为空')
  }
  return sheets[0]
}

function parseXmindSheet(xml, sheet, index) {
  const root = sheet
    ? xmlChildren(sheet, 'topic')[0]
    : xml.getElementsByTagName('topic')[0]
  if (!root) {
    return null
  }

  const rootInfo = readXmindTopic(root)
  const items = []

  function walk(topicElement, depth) {
    const childrenElement = xmlChildren(topicElement, 'children')[0]
    const topicsElement = xmlChildren(childrenElement, 'topics')[0]
    xmlChildren(topicsElement, 'topic').forEach(child => {
      const info = readXmindTopic(child)
      items.push({ ...info, depth })
      walk(child, depth + 1)
    })
  }

  walk(root, 0)

  const relationshipScope = sheet || xml.documentElement
  const relationshipsElement = xmlChildren(relationshipScope, 'relationships')[0]
  const relationships = xmlChildren(relationshipsElement, 'relationship').map(element => ({
    end1: element.getAttribute('end1') || '',
    end2: element.getAttribute('end2') || '',
    label: xmlChildren(element, 'title')[0]?.textContent || ''
  })).filter(relationship => relationship.end1 && relationship.end2)

  return {
    sheetTitle: sheet ? (xmlChildren(sheet, 'title')[0]?.textContent || rootInfo.text || `Sheet ${index + 1}`) : (rootInfo.text || '思维导图'),
    rootTitle: rootInfo.text || '思维导图',
    rootNote: rootInfo.note,
    rootSourceId: rootInfo.sourceId,
    items,
    relationships,
    boundaryRanges: [
      ...(rootInfo.boundaryRanges || []),
      ...items.flatMap(item => item.boundaryRanges || [])
    ]
  }
}

function applyXmindMarkers(nodes, items) {
  items.forEach((item, index) => {
    const node = nodes[index + 1]
    if (!node || !Array.isArray(item.markers)) {
      return
    }
    item.markers.forEach(markerId => {
      const priorityMatch = /^priority-(\d+)$/.exec(markerId)
      if (priorityMatch) {
        node.priority = Math.max(1, Math.min(9, Number(priorityMatch[1])))
        return
      }
      if (markerId === 'task-done') {
        node.progress = 100
        return
      }
      const mapped = XMIND_MARKER_TO_INTERNAL[markerId]
      if (mapped) {
        node.markers = [...(node.markers || []), mapped]
      }
    })
  })
  return nodes
}

function xmindSheetToNodes(sheetData) {
  const {
    rootTitle,
    rootNote,
    rootSourceId,
    items = [],
    relationships = [],
    boundaryRanges = []
  } = sheetData || {}
  const nodes = applyXmindMarkers(buildMindmapFromItems(rootTitle, items), items)
  if (rootNote && nodes[0]) {
    nodes[0].note = normalizeNote(rootNote)
  }

  // 把 XMind 的 end1/end2 / boundary range 映射到新节点 id
  const sourceToNode = new Map()
  if (rootSourceId && nodes[0]) {
    sourceToNode.set(rootSourceId, nodes[0].id)
  }
  items.forEach((item, index) => {
    if (item.sourceId && nodes[index + 1]) {
      sourceToNode.set(item.sourceId, nodes[index + 1].id)
    }
  })

  const mappedRelationships = relationships
    .map(relationship => ({
      fromNodeId: sourceToNode.get(relationship.end1),
      toNodeId: sourceToNode.get(relationship.end2),
      label: relationship.label
    }))
    .filter(relationship => relationship.fromNodeId && relationship.toNodeId)

  const boundaries = boundaryRanges
    .map((range, index) => sourceToNode.get(range) ? { nodeId: sourceToNode.get(range), id: `boundary-import-${index + 1}` } : null)
    .filter(Boolean)

  return { nodes, title: rootTitle, relationships: mappedRelationships, boundaries }
}

export function xmindXmlToNodes(text) {
  return xmindSheetToNodes(parseXMindXml(text))
}

export function xmindXmlToPages(text) {
  return parseXMindXmlSheets(text)
    .map(sheet => ({ ...xmindSheetToNodes(sheet), sheetTitle: sheet.sheetTitle || sheet.rootTitle }))
}

// 从 Markdown 文本生成节点
export function markdownToNodes(text) {
  const { rootTitle, items } = parseOutlineItems(text)
  return { nodes: buildMindmapFromItems(rootTitle, items), title: rootTitle }
}

export function opmlToNodes(text) {
  const { rootTitle, items } = parseOpmlItems(text)
  return { nodes: buildMindmapFromItems(rootTitle, items), title: rootTitle }
}

function xmindContentSheetToNodes(sheetData) {
  const { rootTitle, items, rootNote, rootLabels } = sheetData || {}
  const nodes = buildMindmapFromItems(rootTitle, items)
  if (rootNote && nodes[0]) {
    nodes[0].note = normalizeNote(rootNote)
  }
  if (Array.isArray(rootLabels) && rootLabels.length && nodes[0]) {
    nodes[0].labels = normalizeLabels(rootLabels)
  }
  return { nodes, title: rootTitle }
}

export function xmindToNodes(content) {
  return xmindContentSheetToNodes(parseXMindContent(content))
}

export function xmindToPages(content) {
  return parseXMindContentSheets(content)
    .map(sheet => ({ ...xmindContentSheetToNodes(sheet), sheetTitle: sheet.sheetTitle || sheet.rootTitle }))
}
