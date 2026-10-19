import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Editor } from '@tiptap/vue-3'
import { TextSelection } from '@tiptap/pm/state'
import { Table } from '@tiptap/extension-table'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TableRow from '@tiptap/extension-table-row'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { convertHtmlToMarkdown, renderMarkdownToHtml } from '../modes/markdown'
import {
  CODE_BLOCK_DEFAULTS,
  StyledCodeBlock,
  normalizeCodeBlockAttrs
} from './markdownCodeBlock'

export function useMarkdownPanel(documentRef, onSourceChange) {
  const syncingFromDocument = ref(false)
  const sourceText = computed(() => documentRef.value.content.sourceText || '')
  const html = computed(() => renderMarkdownToHtml(sourceText.value))
  const linkHref = ref('')
  const editorRevision = ref(0)
  let savedSelection = null
  let preserveSelection = false
  const editor = ref(new Editor({
    editable: documentRef.value.mode === 'markdown',
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
        // StarterKit 已内置 link / underline，避免重复注册导致的告警
        link: { openOnClick: false, autolink: true }
      }),
      StyledCodeBlock,
      Table.configure({
        resizable: true,
        lastColumnResizable: true,
        allowTableNodeSelection: true
      }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({
        nested: true
      }),
      Placeholder.configure({
        placeholder: '在这里开始撰写文档，或在右侧直接调整 Markdown 原文。'
      })
    ],
    editorProps: {
      attributes: {
        class: 'markdown-wysiwyg-surface'
      }
    },
    content: html.value,
    onCreate: () => {
      editorRevision.value += 1
      syncLinkHref()
    },
    onUpdate: ({ editor: tiptapEditor }) => {
      editorRevision.value += 1
      if (syncingFromDocument.value || documentRef.value.mode !== 'markdown') {
        return
      }

      const nextSource = convertHtmlToMarkdown(tiptapEditor.getHTML())
      if (nextSource !== sourceText.value) {
        onSourceChange(nextSource)
      }
    },
    onSelectionUpdate: () => {
      editorRevision.value += 1
      if (!preserveSelection) {
        savedSelection = null
      }
      syncLinkHref()
    }
  }))

  watch(() => documentRef.value.mode, mode => {
    editor.value?.setEditable(mode === 'markdown')
  }, { immediate: true })

  watch(sourceText, nextSource => {
    if (!editor.value || documentRef.value.mode !== 'markdown') {
      return
    }

    const currentSource = convertHtmlToMarkdown(editor.value.getHTML())
    if (normalizeMarkdownSource(currentSource) === normalizeMarkdownSource(nextSource)) {
      return
    }

    const nextHtml = renderMarkdownToHtml(nextSource)
    if (normalizeHtml(editor.value.getHTML()) === normalizeHtml(nextHtml)) {
      return
    }

    syncingFromDocument.value = true
    editor.value.commands.setContent(nextHtml, false)
    syncingFromDocument.value = false
    syncLinkHref()
  }, { immediate: true })

  onBeforeUnmount(() => {
    editor.value?.destroy()
  })

  function rememberSelection() {
    savedSelection = editor.value?.state.selection || null
    preserveSelection = Boolean(savedSelection)
  }

  function run(command) {
    if (!editor.value) {
      return
    }
    const chain = editor.value.chain().focus()
    if (savedSelection) {
      chain.setTextSelection(savedSelection)
    }
    savedSelection = null
    preserveSelection = false
    command(chain)
    chain.run()
  }

  function toggleHeading(level) {
    run(chain => chain.toggleHeading({ level }))
  }

  function toggleBold() {
    run(chain => chain.toggleBold())
  }

  function toggleItalic() {
    run(chain => chain.toggleItalic())
  }

  function toggleUnderline() {
    run(chain => chain.toggleUnderline())
  }

  function toggleStrike() {
    run(chain => chain.toggleStrike())
  }

  function toggleOrderedList() {
    run(chain => chain.toggleOrderedList())
  }

  function toggleTaskList() {
    run(chain => chain.toggleTaskList())
  }

  function toggleInlineCode() {
    run(chain => chain.toggleCode())
  }

  function toggleBulletList() {
    run(chain => chain.toggleBulletList())
  }

  function toggleBlockquote() {
    run(chain => chain.toggleBlockquote())
  }

  function toggleCodeBlock() {
    run(chain => chain.toggleCodeBlock())
  }

  function applyCodeBlockAttributes(attributes = {}) {
    if (!editor.value) {
      return false
    }
    const current = normalizeCodeBlockAttrs(editor.value.getAttributes('codeBlock'))
    const next = normalizeCodeBlockAttrs({ ...current, ...attributes })
    const chain = editor.value.chain().focus()
    if (savedSelection) {
      chain.setTextSelection(savedSelection)
    }
    chain.updateAttributes('codeBlock', next).run()
    return true
  }

  function resetCodeBlockAttributes() {
    return applyCodeBlockAttributes(CODE_BLOCK_DEFAULTS)
  }

  function insertHorizontalRule() {
    run(chain => chain.setHorizontalRule())
  }

  function insertTable({ rows = 2, cols = 2 } = {}) {
    const nextRows = Math.max(1, Math.min(20, Number(rows) || 2))
    const nextCols = Math.max(1, Math.min(12, Number(cols) || 2))
    run(chain => chain.insertTable({ rows: nextRows, cols: nextCols, withHeaderRow: true }))
  }

  function addTableRow() {
    run(chain => chain.addRowAfter())
  }

  function removeTableRow() {
    run(chain => chain.deleteRow())
  }

  function addTableColumn() {
    run(chain => chain.addColumnAfter())
  }

  function removeTableColumn() {
    run(chain => chain.deleteColumn())
  }

  function deleteTable() {
    run(chain => chain.deleteTable())
  }

  function resolveActiveTablePosition() {
    if (!editor.value) {
      return null
    }
    const { $from } = editor.value.state.selection
    for (let depth = $from.depth; depth > 0; depth -= 1) {
      if ($from.node(depth).type.name === 'table') {
        return { depth, pos: $from.before(depth), node: $from.node(depth) }
      }
    }
    return null
  }

  function getActiveTableElement() {
    const info = resolveActiveTablePosition()
    if (!info || !editor.value) {
      return null
    }
    const dom = editor.value.view.nodeDOM(info.pos)
    if (!dom) {
      return null
    }
    if (dom.tagName === 'TABLE') {
      return dom
    }
    return dom.querySelector?.('table') || null
  }

  function setTableWidth(width) {
    const table = getActiveTableElement()
    if (!table) {
      return false
    }
    const value = Math.max(240, Math.min(Number(width) || 320, editor.value?.view.dom.clientWidth || 1200))
    table.style.width = `${Math.round(value)}px`
    table.style.maxWidth = '100%'
    return true
  }

  function setTableRowHeight(height) {
    const table = getActiveTableElement()
    if (!table) {
      return false
    }
    const value = Math.round(Math.max(28, Math.min(Number(height) || 32, 240)))
    const verticalPadding = Math.max(2, Math.round((value - 18) / 2))
    table.querySelectorAll('tr').forEach(row => {
      row.style.height = `${value}px`
      row.querySelectorAll('th, td').forEach(cell => {
        cell.style.height = `${value}px`
        cell.style.minHeight = `${value}px`
        cell.style.paddingTop = `${verticalPadding}px`
        cell.style.paddingBottom = `${verticalPadding}px`
      })
    })
    return true
  }

  function setTableAlignment(alignment) {
    const table = getActiveTableElement()
    if (!table) {
      return false
    }
    if (alignment === 'center') {
      table.style.marginLeft = 'auto'
      table.style.marginRight = 'auto'
    } else if (alignment === 'right') {
      table.style.marginLeft = 'auto'
      table.style.marginRight = '0'
    } else {
      table.style.marginLeft = '0'
      table.style.marginRight = 'auto'
    }
    return true
  }

  function canMoveActiveTable(direction) {
    const info = resolveActiveTablePosition()
    if (!info || !editor.value || info.depth < 1) {
      return false
    }
    const { $from } = editor.value.state.selection
    const parent = $from.node(info.depth - 1)
    const index = $from.index(info.depth - 1)
    return direction === 'up' ? index > 0 : index < parent.childCount - 1
  }

  function moveActiveTable(direction) {
    const info = resolveActiveTablePosition()
    if (!info || !editor.value || info.depth < 1) {
      return false
    }
    const { state, view } = editor.value
    const { $from } = state.selection
    const parent = $from.node(info.depth - 1)
    const index = $from.index(info.depth - 1)
    let tr = state.tr

    if (direction === 'up' && index > 0) {
      const previous = parent.child(index - 1)
      const start = info.pos - previous.nodeSize
      tr = tr.replaceWith(start, info.pos + info.node.nodeSize, [info.node, previous])
      tr.setSelection(TextSelection.near(tr.doc.resolve(start + 4), 1))
    } else if (direction === 'down' && index < parent.childCount - 1) {
      const next = parent.child(index + 1)
      const end = info.pos + info.node.nodeSize + next.nodeSize
      tr = tr.replaceWith(info.pos, end, [next, info.node])
      tr.setSelection(TextSelection.near(tr.doc.resolve(info.pos + next.nodeSize + 4), 1))
    } else {
      return false
    }

    view.dispatch(tr.scrollIntoView())
    return true
  }

  function setLinkHref(value) {
    linkHref.value = String(value || '')
  }

  function applyLinkHref() {
    if (!editor.value) {
      return
    }

    const href = normalizeLinkHref(linkHref.value)
    const chain = editor.value.chain().focus()

    if (editor.value.isActive('link')) {
      chain.extendMarkRange('link')
    }

    if (!href) {
      chain.unsetLink().run()
      syncLinkHref()
      return
    }

    chain.setLink({ href, target: '_blank', rel: 'noopener noreferrer' }).run()
    syncLinkHref()
  }

  function clearLinkHref() {
    linkHref.value = ''
    applyLinkHref()
  }

  function syncLinkHref() {
    linkHref.value = String(editor.value?.getAttributes('link').href || '')
  }

  const codeBlockAttrs = computed(() => {
    editorRevision.value
    return normalizeCodeBlockAttrs(editor.value?.getAttributes('codeBlock') || CODE_BLOCK_DEFAULTS)
  })
  const formatting = computed(() => {
    editorRevision.value
    return {
      heading1: Boolean(editor.value?.isActive('heading', { level: 1 })),
      heading2: Boolean(editor.value?.isActive('heading', { level: 2 })),
      heading3: Boolean(editor.value?.isActive('heading', { level: 3 })),
      bold: Boolean(editor.value?.isActive('bold')),
      italic: Boolean(editor.value?.isActive('italic')),
      underline: Boolean(editor.value?.isActive('underline')),
      strike: Boolean(editor.value?.isActive('strike')),
      orderedList: Boolean(editor.value?.isActive('orderedList')),
      taskList: Boolean(editor.value?.isActive('taskList')),
      table: Boolean(editor.value?.isActive('table')),
      code: Boolean(editor.value?.isActive('code')),
      bulletList: Boolean(editor.value?.isActive('bulletList')),
      blockquote: Boolean(editor.value?.isActive('blockquote')),
      codeBlock: Boolean(editor.value?.isActive('codeBlock')),
      link: Boolean(editor.value?.isActive('link'))
    }
  })
  const stats = computed(() => ({
    words: countWords(sourceText.value),
    characters: sourceText.value.length
  }))

  return {
    sourceText,
    html,
    editor,
    formatting,
    codeBlockAttrs,
    stats,
    linkHref,
    rememberSelection,
    toggleHeading,
    toggleBold,
    toggleItalic,
    toggleUnderline,
    toggleStrike,
    toggleOrderedList,
    toggleTaskList,
    toggleInlineCode,
    toggleBulletList,
    toggleBlockquote,
    toggleCodeBlock,
    applyCodeBlockAttributes,
    resetCodeBlockAttributes,
    insertHorizontalRule,
    insertTable,
    addTableRow,
    removeTableRow,
    addTableColumn,
    removeTableColumn,
    deleteTable,
    getActiveTableElement,
    setTableWidth,
    setTableRowHeight,
    setTableAlignment,
    canMoveActiveTable,
    moveActiveTable,
    setLinkHref,
    applyLinkHref,
    clearLinkHref
  }
}

function normalizeHtml(html = '') {
  return String(html || '').replace(/\s+/g, ' ').trim()
}

function countWords(sourceText = '') {
  return String(sourceText || '').split(/\s+/).filter(Boolean).length
}

function normalizeMarkdownSource(sourceText = '') {
  return String(sourceText || '')
    .replace(/\r\n/g, '\n')
    .replace(/\s+$/g, '')
}

function normalizeLinkHref(value) {
  const raw = String(value || '').trim()
  if (!raw) {
    return ''
  }
  try {
    const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`
    const url = new URL(candidate)
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.href : ''
  } catch {
    return ''
  }
}