import { nextTick, ref, watch } from 'vue'
import { CODE_BLOCK_LANGUAGES } from './markdownCodeBlock'
import { useMarkdownPanel } from './useMarkdownPanel'

/**
 * Owns Markdown-specific popovers and table/code-block formatting controls.
 * Keeping this out of Editor.vue prevents the canvas component from growing a
 * second, unrelated formatting editor implementation.
 */
export function useMarkdownFormatTools({ document, updateMarkdownSource }) {
  const markdownPanel = useMarkdownPanel(document, updateMarkdownSource)
  const markdownView = ref('edit')
  const markdownSourceRef = ref(null)
  const markdownLinkEditorOpen = ref(false)
  const markdownLinkInputRef = ref(null)
  const markdownCodeBlockControlsOpen = ref(false)
  const codeBlockLanguages = CODE_BLOCK_LANGUAGES
  const markdownTableControlsOpen = ref(false)
  const markdownTableRows = ref(2)
  const markdownTableCols = ref(2)
  const markdownTableRowHeight = ref(32)
  const markdownTableAlignment = ref('left')

  watch(() => markdownPanel.formatting.value.codeBlock, active => {
    if (!active) {
      markdownCodeBlockControlsOpen.value = false
    }
  })

  function setMarkdownView(view) {
    markdownView.value = view === 'source' ? 'source' : 'edit'
    if (markdownView.value === 'source') {
      markdownLinkEditorOpen.value = false
      markdownTableControlsOpen.value = false
      markdownCodeBlockControlsOpen.value = false
      nextTick(() => markdownSourceRef.value?.focus())
    }
  }

  function toggleMarkdownLinkEditor() {
    markdownTableControlsOpen.value = false
    markdownCodeBlockControlsOpen.value = false
    markdownLinkEditorOpen.value = !markdownLinkEditorOpen.value
    if (markdownLinkEditorOpen.value) {
      nextTick(() => markdownLinkInputRef.value?.focus())
    }
  }

  function toggleMarkdownCodeBlock() {
    markdownTableControlsOpen.value = false
    markdownLinkEditorOpen.value = false
    markdownPanel.toggleCodeBlock()
    nextTick(() => {
      markdownCodeBlockControlsOpen.value = Boolean(markdownPanel.formatting.value.codeBlock)
      if (markdownCodeBlockControlsOpen.value) {
        markdownPanel.rememberSelection()
      }
    })
  }

  function toggleMarkdownCodeBlockControls() {
    markdownTableControlsOpen.value = false
    markdownLinkEditorOpen.value = false
    markdownCodeBlockControlsOpen.value = !markdownCodeBlockControlsOpen.value
    if (markdownCodeBlockControlsOpen.value) {
      markdownPanel.rememberSelection()
    }
  }

  function updateMarkdownCodeBlockAttribute(name, event) {
    const target = event?.target
    const value = target?.type === 'checkbox' ? Boolean(target.checked) : target?.value
    markdownPanel.applyCodeBlockAttributes({ [name]: value })
  }

  function resetMarkdownCodeBlockAttributes() {
    markdownPanel.resetCodeBlockAttributes()
  }

  function getMarkdownTableElement() {
    return window.document.querySelector('#markdown-editor .ProseMirror table')
  }

  function syncMarkdownTableDimensions() {
    const table = getMarkdownTableElement()
    if (!table) {
      return
    }
    const firstRow = table.querySelector('tr')
    markdownTableRowHeight.value = Math.round(firstRow?.getBoundingClientRect().height || markdownTableRowHeight.value)
  }

  function toggleMarkdownTableControls() {
    markdownLinkEditorOpen.value = false
    markdownCodeBlockControlsOpen.value = false
    markdownTableControlsOpen.value = !markdownTableControlsOpen.value
    if (markdownTableControlsOpen.value) {
      nextTick(syncMarkdownTableDimensions)
    }
  }

  function insertConfiguredMarkdownTable() {
    markdownPanel.insertTable({
      rows: markdownTableRows.value,
      cols: markdownTableCols.value
    })
    nextTick(() => {
      applyMarkdownTableRowHeight()
      applyMarkdownTableAlignment(markdownTableAlignment.value)
    })
    markdownTableControlsOpen.value = false
  }

  function updateMarkdownTableRowHeight(event) {
    markdownTableRowHeight.value = Number(event.target.value) || 0
    applyMarkdownTableRowHeight()
  }

  function applyMarkdownTableRowHeight() {
    const table = getMarkdownTableElement()
    if (!table) {
      return
    }
    const height = Math.round(Math.max(28, Math.min(Number(markdownTableRowHeight.value) || 32, 240)))
    const verticalPadding = Math.max(2, Math.round((height - 18) / 2))
    const wrapper = table.closest('.tableWrapper')
    if (!wrapper) {
      return
    }
    wrapper.style.setProperty('--markdown-table-row-height', `${height}px`)
    wrapper.style.setProperty('--markdown-table-row-padding', `${verticalPadding}px`)
  }

  function applyMarkdownTableAlignment(alignment) {
    const table = getMarkdownTableElement()
    if (!table) {
      return
    }
    markdownTableAlignment.value = alignment
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
  }

  function canMoveMarkdownTable(direction) {
    return markdownPanel.canMoveActiveTable(direction)
  }

  function moveMarkdownTable(direction) {
    markdownPanel.moveActiveTable(direction)
  }

  function applyMarkdownLink() {
    markdownPanel.applyLinkHref()
    markdownLinkEditorOpen.value = false
  }

  function removeMarkdownLink() {
    markdownPanel.clearLinkHref()
    markdownLinkEditorOpen.value = false
  }

  function closeMarkdownPopovers() {
    markdownLinkEditorOpen.value = false
    markdownTableControlsOpen.value = false
    markdownCodeBlockControlsOpen.value = false
  }

  return {
    markdownPanel,
    markdownView,
    markdownSourceRef,
    markdownLinkEditorOpen,
    markdownLinkInputRef,
    markdownCodeBlockControlsOpen,
    codeBlockLanguages,
    markdownTableControlsOpen,
    markdownTableRows,
    markdownTableCols,
    markdownTableRowHeight,
    markdownTableAlignment,
    setMarkdownView,
    toggleMarkdownLinkEditor,
    toggleMarkdownCodeBlock,
    toggleMarkdownCodeBlockControls,
    updateMarkdownCodeBlockAttribute,
    resetMarkdownCodeBlockAttributes,
    toggleMarkdownTableControls,
    insertConfiguredMarkdownTable,
    updateMarkdownTableRowHeight,
    applyMarkdownTableRowHeight,
    applyMarkdownTableAlignment,
    canMoveMarkdownTable,
    moveMarkdownTable,
    applyMarkdownLink,
    removeMarkdownLink,
    closeMarkdownPopovers
  }
}
