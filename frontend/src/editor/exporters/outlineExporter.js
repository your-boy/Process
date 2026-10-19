import { buildMindmapTree } from '../modes/mindmap'
import { flattenNodeBlocks } from '../render/noteBlockOps'

function collectTree(document) {
  const content = document?.content || {}
  const nodes = content.nodes || []
  const tree = buildMindmapTree(nodes)
  const byId = new Map(nodes.map(node => [node.id, node]))
  const root = nodes.find(node => !node.parentId && node.floating !== true) || nodes.find(node => !node.parentId)
  const noteMap = new Map()
  const noteNodeIds = new Set((content.textBlocks || []).map(block => block.nodeId).filter(Boolean))
  noteNodeIds.forEach(nodeId => {
    noteMap.set(nodeId, flattenNodeBlocks(content.textBlocks || [], nodeId))
  })
  return { content, nodes, tree, byId, root, noteMap }
}

// Markdown / 大纲文本：缩进列表，附带标签和思维笔记文本块
export function buildOutlineText(document) {
  const { nodes, tree, byId, root, noteMap } = collectTree(document)
  const lines = [`# ${document?.title || '思维导图'}`, '']

  function walk(node, depth) {
    if (!node) {
      return
    }
    const labels = (node.labels || []).map(label => `#${label}`).join(' ')
    const text = `${node.text || ''}${labels ? `  ${labels}` : ''}`
    lines.push(`${'  '.repeat(depth)}- ${text}`)
    ;(noteMap.get(node.id) || []).forEach(block => {
      String(block.text || '').split(/\r?\n/).filter(line => line.trim()).forEach(line => {
        lines.push(`${'  '.repeat(depth + 1 + (block.depth || 0))}- 📝 ${line}`)
      })
    })
    ;(tree.get(node.id) || []).forEach(childId => walk(byId.get(childId), depth + 1))
  }

  if (root) {
    walk(root, 0)
  }
  nodes.filter(node => node.floating === true).forEach(node => walk(node, 0))

  return lines.join('\n')
}

export function buildOpmlText(document) {
  const { nodes, tree, byId, root, noteMap } = collectTree(document)
  const escape = value => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

  function render(node) {
    if (!node) {
      return ''
    }
    const children = (tree.get(node.id) || []).map(childId => render(byId.get(childId))).join('')
    const note = (noteMap.get(node.id) || [])
      .map(block => `${'  '.repeat(block.depth || 0)}${block.text || ''}`)
      .join('\n\n')
    const noteAttr = note ? ` _note="${escape(note).replaceAll('\n', '&#10;')}"` : ''
    return `<outline text="${escape(node.text)}"${noteAttr}>${children}</outline>`
  }

  const body = root ? render(root) : ''
  const floating = nodes.filter(node => node.floating === true).map(node => render(node)).join('')
  return `<?xml version="1.0" encoding="UTF-8"?><opml version="2.0"><head><title>${escape(document?.title || 'diagram')}</title></head><body>${body}${floating}</body></opml>`
}
