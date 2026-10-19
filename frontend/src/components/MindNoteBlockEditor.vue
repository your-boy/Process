<template>
  <div class="mind-note-editor">
    <div class="mind-note-editor-toolbar" @pointerdown="rememberSelection" @mousedown.prevent>
      <button
        type="button"
        :class="{ active: editor?.isActive('bold') }"
        :title="t('editor.formatBold')"
        @click="run(chain => chain.toggleBold())"
      ><strong>B</strong></button>
      <button
        type="button"
        :class="{ active: editor?.isActive('italic') }"
        :title="t('editor.formatItalic')"
        @click="run(chain => chain.toggleItalic())"
      ><em>I</em></button>
      <button
        type="button"
        :class="{ active: editor?.isActive('underline') }"
        :title="t('editor.formatUnderline')"
        @click="run(chain => chain.toggleUnderline())"
      ><span class="underline-icon">U</span></button>
      <button
        type="button"
        :class="{ active: editor?.isActive('strike') }"
        :title="t('editor.formatStrike')"
        @click="run(chain => chain.toggleStrike())"
      ><span class="strike-icon">S</span></button>
      <button
        type="button"
        :class="{ active: editor?.isActive('code') }"
        :title="t('editor.formatCode')"
        @click="run(chain => chain.toggleCode())"
      >&lt;/&gt;</button>
      <span class="mind-note-toolbar-divider"></span>
      <button
        type="button"
        :class="{ active: editor?.isActive('bulletList') }"
        :title="t('editor.formatList')"
        @click="run(chain => chain.toggleBulletList())"
      >•</button>
      <button
        type="button"
        :class="{ active: editor?.isActive('orderedList') }"
        :title="t('editor.formatOrderedList')"
        @click="run(chain => chain.toggleOrderedList())"
      >1.</button>
      <button
        type="button"
        :class="{ active: editor?.isActive('taskList') }"
        :title="t('editor.formatTaskList')"
        @click="run(chain => chain.toggleTaskList())"
      >☑</button>
      <button
        type="button"
        :class="{ active: editor?.isActive('blockquote') }"
        :title="t('editor.formatQuote')"
        @click="run(chain => chain.toggleBlockquote())"
      >❝</button>
      <button
        type="button"
        :class="{ active: editor?.isActive('codeBlock') }"
        :title="t('editor.formatCodeBlock')"
        @click="run(chain => chain.toggleCodeBlock())"
      >{ }</button>
      <button
        type="button"
        :title="t('editor.formatTable')"
        @click="insertTable"
      >▦</button>
      <button
        type="button"
        :class="{ active: editor?.isActive('link') }"
        :title="t('editor.formatLink')"
        @click="setLink"
      >🔗</button>
      <button
        type="button"
        :title="t('editor.formatClear')"
        @click="clearFormatting"
      >⌫</button>
    </div>
    <EditorContent :editor="editor" class="mind-note-editor-content" />
  </div>
</template>

<script setup>
import { onBeforeUnmount, watch } from 'vue'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { Table } from '@tiptap/extension-table'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TableRow from '@tiptap/extension-table-row'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import Placeholder from '@tiptap/extension-placeholder'
import { t } from '../i18n'
import { looksLikeMarkdown, markdownToHtml } from '../editor/render/markdownPaste'

const props = defineProps({
  html: {
    type: String,
    default: '<p></p>'
  }
})

const emit = defineEmits(['update', 'focus', 'blur'])
let savedSelection = null

const editor = useEditor({
  content: props.html || '<p></p>',
  extensions: [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: { openOnClick: false, autolink: true }
    }),
    Table.configure({ resizable: true, lastColumnResizable: true, allowTableNodeSelection: true }),
    TableRow,
    TableHeader,
    TableCell,
    TaskList,
    TaskItem.configure({ nested: true }),
    Placeholder.configure({ placeholder: t('editor.mindNotePlaceholder') })
  ],
  editorProps: {
    attributes: {
      class: 'mind-note-editor-prosemirror',
      spellcheck: 'false'
    },
    // 粘贴 Markdown 时自动转成结构化内容（标题 / 列表 / 引用 / 待办 / 表格）
    handlePaste: (_view, event) => {
      const text = event.clipboardData?.getData('text/plain') || ''
      if (!looksLikeMarkdown(text)) {
        return false
      }
      const html = markdownToHtml(text)
      if (!html) {
        return false
      }
      event.preventDefault()
      const instance = editor.value
      if (!instance) {
        return true
      }
      instance.chain().focus().insertContent(html).run()
      return true
    }
  },
  onUpdate: ({ editor: currentEditor }) => {
    savedSelection = currentEditor.state.selection
    emit('update', {
      html: currentEditor.getHTML(),
      text: currentEditor.getText({ blockSeparator: '\n' })
    })
  },
  onSelectionUpdate: ({ editor: currentEditor }) => {
    savedSelection = currentEditor.state.selection
  },
  onFocus: () => emit('focus'),
  onBlur: () => emit('blur')
})

function normalize(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

watch(() => props.html, nextHtml => {
  if (!editor.value) {
    return
  }
  if (normalize(nextHtml) === normalize(editor.value.getHTML())) {
    return
  }
  editor.value.commands.setContent(nextHtml || '<p></p>', false)
})

onBeforeUnmount(() => {
  editor.value?.destroy()
})

function rememberSelection() {
  if (editor.value) {
    savedSelection = editor.value.state.selection
  }
}

function restoreSelection() {
  if (!editor.value || !savedSelection) {
    return
  }
  const size = editor.value.state.doc.content.size
  const from = Math.max(0, Math.min(Number(savedSelection.from) || 0, size))
  const to = Math.max(from, Math.min(Number(savedSelection.to) || from, size))
  editor.value.commands.setTextSelection({ from, to })
}

function run(command) {
  if (!editor.value) {
    return
  }
  restoreSelection()
  command(editor.value.chain().focus()).run()
  savedSelection = editor.value.state.selection
}

function insertTable() {
  if (!editor.value) {
    return
  }
  restoreSelection()
  editor.value.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  savedSelection = editor.value.state.selection
}

function setLink() {
  if (!editor.value || typeof window === 'undefined') {
    return
  }
  const previous = editor.value.getAttributes('link').href || ''
  const href = window.prompt(t('editor.formatLink'), previous || 'https://')
  if (href === null) {
    return
  }
  const value = href.trim()
  restoreSelection()
  if (!value) {
    editor.value.chain().focus().extendMarkRange('link').unsetLink().run()
    savedSelection = editor.value.state.selection
    return
  }
  editor.value.chain()
    .focus()
    .extendMarkRange('link')
    .setLink({ href: value, target: '_blank', rel: 'noopener noreferrer' })
    .run()
  savedSelection = editor.value.state.selection
}

function clearFormatting() {
  if (!editor.value) {
    return
  }
  restoreSelection()
  editor.value.chain().focus().unsetAllMarks().clearNodes().run()
  savedSelection = editor.value.state.selection
}
</script>

<style scoped>
.mind-note-editor {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.mind-note-editor-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  padding: 3px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--muted) 72%, transparent);
}

.mind-note-editor-toolbar button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 5px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--muted-foreground);
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
}

.mind-note-editor-toolbar button:hover {
  background: var(--card);
  color: var(--foreground);
}

.mind-note-editor-toolbar button.active {
  background: var(--card);
  color: var(--ring);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ring) 36%, transparent);
}

.mind-note-toolbar-divider {
  width: 1px;
  height: 16px;
  margin: 4px 3px;
  background: var(--border);
}

.mind-note-editor-content {
  min-height: 64px;
}

.mind-note-editor-content :deep(.mind-note-editor-prosemirror) {
  min-height: 64px;
  outline: none;
  font-family: var(--font-sans);
  font-size: 13px;
  line-height: 1.6;
  color: var(--foreground);
}

.mind-note-editor-content :deep(.mind-note-editor-prosemirror p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  float: left;
  height: 0;
  color: var(--muted-foreground);
  pointer-events: none;
}

.mind-note-editor-content :deep(.mind-note-editor-prosemirror p) {
  margin: 0 0 0.45em;
}

.mind-note-editor-content :deep(.mind-note-editor-prosemirror p:last-child) {
  margin-bottom: 0;
}

.mind-note-editor-content :deep(.mind-note-editor-prosemirror h1) {
  margin: 0.2em 0 0.45em;
  font-size: 1.55em;
  line-height: 1.25;
}

.mind-note-editor-content :deep(.mind-note-editor-prosemirror h2) {
  margin: 0.2em 0 0.4em;
  font-size: 1.3em;
  line-height: 1.3;
}

.mind-note-editor-content :deep(.mind-note-editor-prosemirror h3) {
  margin: 0.2em 0 0.35em;
  font-size: 1.12em;
  line-height: 1.35;
}

.mind-note-editor-content :deep(.mind-note-editor-prosemirror ul),
.mind-note-editor-content :deep(.mind-note-editor-prosemirror ol) {
  margin: 0.35em 0;
  padding-left: 1.35em;
}

.mind-note-editor-content :deep(.mind-note-editor-prosemirror blockquote) {
  margin: 0.45em 0;
  padding-left: 0.7em;
  border-left: 3px solid var(--ring);
  color: var(--muted-foreground);
}

.mind-note-editor-content :deep(.mind-note-editor-prosemirror pre) {
  margin: 0.45em 0;
  padding: 8px 10px;
  overflow: auto;
  border-radius: 8px;
  background: var(--muted);
  font-family: var(--font-mono, Consolas, Monaco, monospace);
  font-size: 12px;
}

.mind-note-editor-content :deep(.mind-note-editor-prosemirror code) {
  padding: 0.1em 0.28em;
  border-radius: 4px;
  background: var(--muted);
  font-family: var(--font-mono, Consolas, Monaco, monospace);
  font-size: 0.92em;
}

.mind-note-editor-content :deep(.mind-note-editor-prosemirror pre code) {
  padding: 0;
  background: transparent;
}

.mind-note-editor-content :deep(.mind-note-editor-prosemirror table) {
  width: 100%;
  margin: 0.45em 0;
  border-collapse: collapse;
  font-size: 12px;
}

.mind-note-editor-content :deep(.mind-note-editor-prosemirror th),
.mind-note-editor-content :deep(.mind-note-editor-prosemirror td) {
  position: relative;
  padding: 4px 6px;
  border: 1px solid var(--border);
  text-align: left;
}

.mind-note-editor-content :deep(.mind-note-editor-prosemirror .column-resize-handle) {
  position: absolute;
  top: 0;
  right: -2px;
  bottom: -1px;
  z-index: 5;
  width: 4px;
  background: var(--accent);
  pointer-events: none;
}

.mind-note-editor-content :deep(.mind-note-editor-prosemirror.resize-cursor) {
  cursor: col-resize;
}

.mind-note-editor-content :deep(.mind-note-editor-prosemirror th) {
  background: var(--muted);
}

.mind-note-editor-content :deep(.mind-note-editor-prosemirror ul[data-type="taskList"]) {
  padding-left: 0;
  list-style: none;
}

.mind-note-editor-content :deep(.mind-note-editor-prosemirror ul[data-type="taskList"] li) {
  display: flex;
  gap: 6px;
  align-items: flex-start;
}

.mind-note-editor-content :deep(.mind-note-editor-prosemirror ul[data-type="taskList"] li > label) {
  flex: 0 0 auto;
  margin-top: 2px;
}

.underline-icon {
  text-decoration: underline;
}

.strike-icon {
  text-decoration: line-through;
}
</style>
