import TurndownService from 'turndown'
import { marked } from 'marked'
import { gfm } from 'turndown-plugin-gfm'
import { createDocument } from '../model/document'

const DEFAULT_SOURCE = '# 新文档\n\n开始编写 Markdown 内容。'
const turndownService = new TurndownService({
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  headingStyle: 'atx'
})

turndownService.use(gfm)

turndownService.addRule('underline', {
  filter(node) {
    if (node.nodeName === 'U') {
      return true
    }

    if (node.nodeName !== 'SPAN') {
      return false
    }

    const style = String(node.getAttribute('style') || '').toLowerCase()
    return style.includes('text-decoration') && style.includes('underline')
  },
  replacement(content) {
    return `<u>${content}</u>`
  }
})

turndownService.addRule('table', {
  filter(node) {
    return node.nodeName === 'TABLE'
  },
  replacement(content, node) {
    const markdown = convertTableNodeToMarkdown(node)
    return markdown ? `\n\n${markdown}\n\n` : ''
  }
})

turndownService.addRule('taskItem', {
  filter(node) {
    return node.nodeName === 'LI' && Boolean(resolveTaskCheckbox(node))
  },
  replacement(content, node) {
    const checkbox = resolveTaskCheckbox(node)
    const marker = checkbox?.checked ? '[x]' : '[ ]'
    const text = String(content || '')
      .replace(/^\s+|\s+$/g, '')
      .replace(/^\[(?:x|X|\s)\]\s+/, '')
      .replace(/\n{3,}/g, '\n\n')
    const body = text ? ` ${text.replace(/\n/g, '\n    ')}` : ''
    return `- ${marker}${body}${node.nextSibling ? '\n' : ''}`
  }
})

marked.setOptions({
  gfm: true,
  breaks: true
})

export function parseMarkdownToBlocks(sourceText = '') {
  return marked.lexer(String(sourceText || '')).flatMap(token => {
    switch (token.type) {
      case 'heading':
        return [{ type: 'heading', level: token.depth, text: token.text }]
      case 'list':
        return [{
          type: 'list',
          ordered: token.ordered,
          items: token.items.map(item => item.task
            ? `[${item.checked ? 'x' : ' '}] ${item.text}`
            : item.text)
        }]
      case 'code':
        return [{ type: 'code', language: token.lang || '', text: token.text }]
      case 'blockquote':
        return [{ type: 'quote', text: collectTokenText(token.tokens || []) }]
      case 'table':
        return [{
          type: 'table',
          header: token.header.map(item => item.text),
          rows: token.rows.map(row => row.map(item => item.text))
        }]
      case 'paragraph':
        return [{ type: 'paragraph', text: token.text }]
      default:
        return []
    }
  })
}

export function renderMarkdownToHtml(sourceText = '') {
  return String(marked.parse(String(sourceText || '')) || '')
}

export function convertHtmlToMarkdown(html = '') {
  return turndownService.turndown(String(html || '')).trim()
}

export function createMarkdownDocument(sourceText = DEFAULT_SOURCE) {
  const document = createDocument({
    mode: 'markdown',
    title: '未命名 Markdown 文档'
  })

  document.content.sourceText = sourceText
  document.content.textBlocks = parseMarkdownToBlocks(sourceText)
  return document
}

function collectTokenText(tokens = []) {
  return tokens.flatMap(token => {
    if (token.type === 'text' || token.type === 'paragraph') {
      return token.text || ''
    }
    if (Array.isArray(token.tokens)) {
      return collectTokenText(token.tokens)
    }
    return ''
  }).join(' ').trim()
}

function resolveTaskCheckbox(node) {
  if (!node || typeof node.querySelector !== 'function') {
    return null
  }

  const checkbox = node.querySelector('input[type="checkbox"]')
  if (checkbox) {
    return checkbox
  }

  if (String(node.getAttribute('data-type') || '') !== 'taskItem') {
    return null
  }

  return {
    checked: String(node.getAttribute('data-checked') || '').toLowerCase() === 'true'
  }
}

function convertTableNodeToMarkdown(node) {
  if (!node || typeof node.querySelectorAll !== 'function') {
    return ''
  }

  const rows = Array.from(node.querySelectorAll('tr')).map(row => Array.from(row.children)
    .filter(cell => cell.nodeName === 'TH' || cell.nodeName === 'TD')
    .map(cell => normalizeTableCellText(cell)))
    .filter(row => row.length)

  if (!rows.length) {
    return ''
  }

  const header = rows[0].map(cell => cell || ' ')
  const body = rows.slice(1).map(row => padTableRow(row, header.length))

  return [
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...body.map(row => `| ${row.join(' | ')} |`)
  ].join('\n')
}

function normalizeTableCellText(cell) {
  return String(cell?.textContent || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\|/g, '\\|')
}

function padTableRow(row, width) {
  const nextRow = Array.from({ length: width }, (_, index) => row[index] || ' ')
  return nextRow
}