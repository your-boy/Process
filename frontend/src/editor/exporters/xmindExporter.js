import JSZip from 'jszip'

export async function buildXMindArchive(document) {
  const { Dumper, Topic, Workbook } = await loadXMindSdk()
  const zip = new JSZip()
  const workbook = buildWorkbook(document, { Topic, Workbook })
  const dumper = new Dumper({ workbook })

  resolveArchiveEntries(dumper.dumping()).forEach(entry => {
    zip.file(entry.filename, entry.value)
  })

  return zip.generateAsync({ type: 'uint8array' })
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
  const nodes = document.content.nodes || []
  const workbook = new Workbook()
  const childrenMap = new Map()
  const noteMap = collectNodeNotes(document.content.textBlocks || [])

  nodes.forEach(node => {
    if (!node.parentId) {
      return
    }
    const children = childrenMap.get(node.parentId) || []
    children.push(node)
    childrenMap.set(node.parentId, children)
  })

  const root = nodes.find(node => !node.parentId) || nodes[0] || { id: 'root', text: document.title }
  const sheet = workbook.createSheet(document.title || '思维导图', root.text || '中心主题')
  const topic = new Topic({ sheet })
  const rootTopicId = topic.rootTopicId

  workbook.theme(document.title || '思维导图', 'snowbrush')

  attachNote(topic, rootTopicId, noteMap.get(root.id))
  appendChildren(root.id, rootTopicId)

  return workbook

  function appendChildren(parentNodeId, parentTopicId) {
    const children = childrenMap.get(parentNodeId) || []
    children.forEach(child => {
      topic.on(parentTopicId).add({
        title: child.text || '未命名主题',
        customId: child.id
      })

      const childTopicId = topic.cid()
      attachNote(topic, childTopicId, noteMap.get(child.id))
      appendChildren(child.id, childTopicId)
    })
  }
}

function collectNodeNotes(textBlocks = []) {
  return textBlocks.reduce((map, block) => {
    const text = String(block.text || '').trim()
    if (!text) {
      return map
    }

    const existing = map.get(block.nodeId) || []
    existing.push(text)
    map.set(block.nodeId, existing)
    return map
  }, new Map())
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