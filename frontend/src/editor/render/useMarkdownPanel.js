import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Editor } from '@tiptap/vue-3'
import { Table } from '@tiptap/extension-table'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TableRow from '@tiptap/extension-table-row'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import Underline from '@tiptap/extension-underline'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { convertHtmlToMarkdown, renderMarkdownToHtml } from '../modes/markdown'

export function useMarkdownPanel(documentRef, onSourceChange) {
  const syncingFromDocument = ref(false)
  const sourceText = computed(() => documentRef.value.content.sourceText || '')
  const html = computed(() => renderMarkdownToHtml(sourceText.value))
  const linkHref = ref('')
  const editor = ref(new Editor({
    editable: documentRef.value.mode === 'markdown',
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] }
      }),
      Table.configure({
        resizable: false
      }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({
        nested: true
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true
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
    onCreate: syncLinkHref,
    onUpdate: ({ editor: tiptapEditor }) => {
      if (syncingFromDocument.value || documentRef.value.mode !== 'markdown') {
        return
      }

      const nextSource = convertHtmlToMarkdown(tiptapEditor.getHTML())
      if (nextSource !== sourceText.value) {
        onSourceChange(nextSource)
      }
    },
    onSelectionUpdate: syncLinkHref
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

  function run(command) {
    if (!editor.value) {
      return
    }
    command(editor.value.chain().focus()).run()
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

  function insertHorizontalRule() {
    run(chain => chain.setHorizontalRule())
  }

  function insertTable() {
    run(chain => chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }))
  }

  function addTableRow() {
    run(chain => chain.addRowAfter())
  }

  function addTableColumn() {
    run(chain => chain.addColumnAfter())
  }

  function deleteTable() {
    run(chain => chain.deleteTable())
  }

  function setLinkHref(value) {
    linkHref.value = String(value || '')
  }

  function applyLinkHref() {
    if (!editor.value) {
      return
    }

    const href = String(linkHref.value || '').trim()
    const chain = editor.value.chain().focus()

    if (editor.value.isActive('link')) {
      chain.extendMarkRange('link')
    }

    if (!href) {
      chain.unsetLink().run()
      syncLinkHref()
      return
    }

    chain.setLink({ href, target: '_blank' }).run()
    syncLinkHref()
  }

  function clearLinkHref() {
    linkHref.value = ''
    applyLinkHref()
  }

  function syncLinkHref() {
    linkHref.value = String(editor.value?.getAttributes('link').href || '')
  }

  const formatting = computed(() => ({
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
  }))
  const stats = computed(() => ({
    words: countWords(sourceText.value),
    characters: sourceText.value.length
  }))

  return {
    sourceText,
    html,
    editor,
    formatting,
    stats,
    linkHref,
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
    insertHorizontalRule,
    insertTable,
    addTableRow,
    addTableColumn,
    deleteTable,
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