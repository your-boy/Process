<template>
  <section class="editor-shell">
    <div v-show="isTreeMode || isMindNote" class="editor-toolbar">
      <div class="toolbar-group">
        <div class="toolbar-group compact toolbar-actions">
          <div class="toolbar-menu-shell">
            <button
              type="button"
              class="toolbar-button"
              :class="{ open: toolbarMenu === 'export' }"
              data-testid="export-menu"
              @click.stop="toggleToolbarMenu('export')"
            >
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.5v8m0 0 3-3m-3 3-3-3M3 12.5v1h10v-1" /></svg>
              {{ t('editor.export') }}
              <span class="toolbar-caret">▾</span>
            </button>
            <div v-if="toolbarMenu === 'export'" class="toolbar-menu" data-testid="export-menu-panel" @click.stop>
              <button type="button" data-testid="export-png" @click="runExport('png')">{{ t('editor.exportPng') }}</button>
              <button type="button" data-testid="export-jpg" @click="runExport('jpg')">{{ t('editor.exportJpg') }}</button>
              <button v-if="document.mode !== 'markdown'" type="button" data-testid="export-svg" @click="runExport('svg')">{{ t('editor.exportSvg') }}</button>
              <button type="button" data-testid="export-pdf" @click="runExport('pdf')">{{ t('editor.exportPdf') }}</button>
              <button v-if="isTreeMode" type="button" data-testid="export-markdown" @click="runExport('markdown')">{{ t('editor.exportMarkdown') }}</button>
              <button v-if="isTreeMode" type="button" data-testid="export-opml" @click="runExport('opml')">{{ t('editor.exportOpml') }}</button>
              <button type="button" :disabled="!canExportXMind" data-testid="export-xmind" @click="runExport('xmind')">{{ t('editor.exportXmind') }}</button>
              <div class="toolbar-menu-divider"></div>
              <button type="button" data-testid="export-drawio" @click="runExport('drawio')">{{ t('editor.exportDrawio') }}</button>
              <div v-if="document.content.pages.length > 1" class="toolbar-menu-note">{{ t('editor.exportPageHint') }}</div>
            </div>
          </div>

          <div class="toolbar-menu-shell">
            <button
              type="button"
              class="toolbar-button"
              :class="{ open: toolbarMenu === 'import' }"
              data-testid="import-menu"
              @click.stop="toggleToolbarMenu('import')"
            >
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 12.5v-8m0 0 3 3m-3-3-3 3M3 13.5v1h10v-1" /></svg>
              {{ t('editor.import') }}
              <span class="toolbar-caret">▾</span>
            </button>
            <div v-if="toolbarMenu === 'import'" class="toolbar-menu" data-testid="import-menu-panel" @click.stop>
              <button type="button" data-testid="import-drawio" @click="runImport('drawio')">{{ t('editor.importDrawio') }}</button>
              <div class="toolbar-menu-divider"></div>
              <button type="button" data-testid="import-markdown" @click="runImport('markdown')">{{ t('editor.importMarkdown') }}</button>
              <button type="button" data-testid="import-opml" @click="runImport('opml')">{{ t('editor.importOpml') }}</button>
              <button type="button" data-testid="import-xmind" @click="runImport('xmind')">{{ t('editor.importXmind') }}</button>
            </div>
          </div>

          <input ref="drawioInputRef" type="file" accept=".drawio,.xml" class="hidden-file-input" @change="onDrawioFileChange" />
          <input
            ref="mindmapInputRef"
            type="file"
            class="hidden-file-input"
            :accept="importAccept"
            data-testid="mindmap-import-input"
            @change="onMindmapFileChange"
          />

          <button
            v-if="editorState.syncState.value === 'offline'"
            type="button"
            class="sync-badge"
            data-testid="sync-badge"
            :title="t('editor.offlineSyncHint')"
            @click="editorState.retryAutoSaveNow()"
          >
            <span class="sync-badge-dot"></span>
            {{ t('editor.offlineSync') }}
          </button>

          <button
            type="button"
            class="save-button toolbar-button primary"
            data-testid="save-document"
            :disabled="editorState.isSaving.value"
            @click="editorState.saveDocument()"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5 6.4 12 13 4.5" /></svg>
            {{ editorState.isSaving.value ? t('editor.saving') : t('editor.save') }}
          </button>

          <div v-if="document.id" class="toolbar-group compact">
            <button
              type="button"
              class="toolbar-button"
              data-testid="revision-open"
              @click="openRevisionPanel"
            >{{ t('editor.revisionOpen') }}</button>
          </div>
        </div>
      </div>

      <div v-if="isTreeMode" class="toolbar-group compact mindmap-search-group">
        <input
          ref="searchInputRef"
          v-model="nodeSearch"
          type="search"
          class="mindmap-search-input"
          :placeholder="t('mindmap.searchPlaceholder')"
          data-testid="mindmap-search"
          @keydown.esc="nodeSearch = ''"
        />
        <select v-model="nodeFilter" class="mindmap-filter-select" data-testid="mindmap-filter" :title="t('mindmap.filterHint')">
          <option value="">{{ t('mindmap.filterAll') }}</option>
          <option value="note">{{ t('mindmap.filterNote') }}</option>
          <option value="label">{{ t('mindmap.filterLabel') }}</option>
          <option value="marker">{{ t('mindmap.filterMarker') }}</option>
          <option value="priority">{{ t('mindmap.filterPriority') }}</option>
          <option value="task">{{ t('mindmap.filterTask') }}</option>
          <option value="attachment">{{ t('mindmap.filterAttachment') }}</option>
          <option value="done">{{ t('mindmap.filterDone') }}</option>
        </select>
        <span v-if="hasSearchFilter" class="mindmap-search-count" data-testid="mindmap-search-count">{{ searchHitIds.size }}</span>
        <button
          type="button"
          class="mindmap-search-reset"
          data-testid="mindmap-search-reset"
          :disabled="!hasSearchFilter"
          @click="resetNodeSearch"
        >{{ t('mindmap.searchReset') }}</button>
      </div>

      <div v-if="isMindNote" class="toolbar-group compact">
        <button
          type="button"
          class="toolbar-button"
          data-testid="note-view-toggle"
          :class="{ open: noteView }"
          @click="noteView = !noteView"
        >{{ noteView ? t('editor.canvasView') : t('editor.noteView') }}</button>
      </div>

    </div>

    <div v-if="selectedNodeIds.length > 1" class="selection-toolbar-shell">
      <div class="toolbar-group compact align-toolbar">
        <span class="edge-style-caption">{{ t('editor.align') }}</span>
        <button type="button" @click="alignNodes('left')">{{ t('editor.left') }}</button>
        <button type="button" @click="alignNodes('center')">{{ t('editor.center') }}</button>
        <button type="button" @click="alignNodes('right')">{{ t('editor.right') }}</button>
        <button type="button" @click="alignNodes('top')">{{ t('editor.top') }}</button>
        <button type="button" @click="alignNodes('middle')">{{ t('editor.middle') }}</button>
        <button type="button" @click="alignNodes('bottom')">{{ t('editor.bottom') }}</button>
        <span class="edge-style-caption">{{ t('editor.distribute') }}</span>
        <button type="button" @click="distributeNodes('horizontal')">{{ t('editor.horizontal') }}</button>
        <button type="button" @click="distributeNodes('vertical')">{{ t('editor.vertical') }}</button>
        <button type="button" data-testid="group-nodes" @click="groupSelection">{{ t('editor.group') }}</button>
        <button type="button" data-testid="ungroup-nodes" @click="ungroupSelection">{{ t('editor.ungroup') }}</button>
      </div>
    </div>

    <div class="page-strip" data-testid="page-strip">
      <div class="page-tabs" role="tablist" :aria-label="t('editor.pages')">
        <div
          v-for="page in document.content.pages"
          :key="page.id"
          role="tab"
          tabindex="0"
          :aria-selected="page.id === document.content.activePageId"
          :class="['page-tab', { active: page.id === document.content.activePageId }]"
          :data-testid="`page-tab-${page.id}`"
          @click="editorState.selectPage(page.id)"
          @keydown.enter.prevent="editorState.selectPage(page.id)"
          @dblclick="startPageRename(page)"
        >
          <input
            v-if="renamingPageId === page.id"
            ref="pageRenameInput"
            v-model="pageRenameDraft"
            class="page-rename-input"
            type="text"
            maxlength="40"
            @click.stop
            @keydown.enter.prevent="commitPageRename"
            @keydown.esc.prevent="cancelPageRename"
            @blur="commitPageRename"
          />
          <span v-else class="page-tab-name">{{ page.name }}</span>
          <button
            v-if="document.content.pages.length > 1"
            type="button"
            class="page-tab-remove"
            :aria-label="t('editor.deletePage')"
            @click.stop="editorState.deletePage(page.id)"
          >×</button>
        </div>
        <button type="button" class="page-add" data-testid="page-add" @click="editorState.addPage()">
          + {{ t('editor.addPage') }}
        </button>
      </div>
      <span class="page-counter">{{ document.content.pages.findIndex(page => page.id === document.content.activePageId) + 1 }} / {{ document.content.pages.length }}</span>
    </div>

    <div v-if="document.mode === 'markdown'" class="markdown-workspace">
      <transition name="canvas-toast">
        <div
          v-if="editorToast.visible"
          :class="['editor-toast', editorToast.tone]"
          :role="editorToast.tone === 'error' ? 'alert' : 'status'"
          aria-live="polite"
          data-testid="save-toast"
        >
          {{ editorToast.message }}
        </div>
      </transition>

      <div class="markdown-panel editor-pane markdown-editor-pane">
        <div class="markdown-pane-header">
          <div class="markdown-view-switch" role="tablist" :aria-label="t('editor.edit')">
            <button
              type="button"
              role="tab"
              :aria-selected="markdownView === 'edit'"
              :class="{ active: markdownView === 'edit' }"
              data-testid="markdown-view-edit"
              @click="setMarkdownView('edit')"
            >{{ t('editor.edit') }}</button>
            <button
              type="button"
              role="tab"
              :aria-selected="markdownView === 'source'"
              :class="{ active: markdownView === 'source' }"
              data-testid="markdown-view-source"
              @click="setMarkdownView('source')"
            >{{ t('editor.source') }}</button>
          </div>
          <div class="markdown-header-actions">
            <span class="markdown-stats">{{ t('editor.words', { words: markdownPanel.stats.value.words, characters: markdownPanel.stats.value.characters }) }}</span>
          </div>
        </div>
        <div v-show="markdownView === 'edit'" class="markdown-edit-stack">
        <div class="markdown-toolbar">
          <button
            type="button"
            :class="['style-toggle', { active: markdownPanel.formatting.value.heading1 }]"
            @click="markdownPanel.toggleHeading(1)"
          >{{ t('editor.heading1') }}</button>
          <button
            type="button"
            :class="['style-toggle', { active: markdownPanel.formatting.value.heading2 }]"
            @click="markdownPanel.toggleHeading(2)"
          >{{ t('editor.heading2') }}</button>
          <button
            type="button"
            :class="['style-toggle', { active: markdownPanel.formatting.value.heading3 }]"
            @click="markdownPanel.toggleHeading(3)"
          >{{ t('editor.heading3') }}</button>
          <button
            type="button"
            :class="['style-toggle', { active: markdownPanel.formatting.value.bold }]"
            @click="markdownPanel.toggleBold()"
          >{{ t('editor.formatBold') }}</button>
          <button
            type="button"
            :class="['style-toggle', { active: markdownPanel.formatting.value.italic }]"
            @click="markdownPanel.toggleItalic()"
          >{{ t('editor.formatItalic') }}</button>
          <button
            type="button"
            :class="['style-toggle', { active: markdownPanel.formatting.value.underline }]"
            @click="markdownPanel.toggleUnderline()"
          >{{ t('editor.underline') }}</button>
          <button
            type="button"
            :class="['style-toggle', { active: markdownPanel.formatting.value.strike }]"
            @click="markdownPanel.toggleStrike()"
          >{{ t('editor.strike') }}</button>
          <button
            type="button"
            :class="['style-toggle', { active: markdownPanel.formatting.value.bulletList }]"
            @click="markdownPanel.toggleBulletList()"
          >{{ t('editor.formatList') }}</button>
          <button
            type="button"
            :class="['style-toggle', { active: markdownPanel.formatting.value.orderedList }]"
            @click="markdownPanel.toggleOrderedList()"
          >{{ t('editor.orderedList') }}</button>
          <button
            type="button"
            :class="['style-toggle', { active: markdownPanel.formatting.value.taskList }]"
            @click="markdownPanel.toggleTaskList()"
          >{{ t('editor.taskList') }}</button>
          <button
            type="button"
            :class="['style-toggle', { active: markdownPanel.formatting.value.blockquote }]"
            @click="markdownPanel.toggleBlockquote()"
          >{{ t('editor.blockquote') }}</button>
          <button
            type="button"
            :class="['style-toggle', { active: markdownPanel.formatting.value.code }]"
            @click="markdownPanel.toggleInlineCode()"
          >{{ t('editor.inlineCode') }}</button>
          <div class="markdown-code-control">
            <button
              type="button"
              :class="['style-toggle', { active: markdownPanel.formatting.value.codeBlock }]"
              data-testid="markdown-code-toggle"
              @pointerdown.prevent="markdownPanel.rememberSelection()"
              @click="toggleMarkdownCodeBlock"
            >{{ t('editor.codeBlock') }}</button>
            <button
              v-if="markdownPanel.formatting.value.codeBlock"
              type="button"
              class="style-toggle markdown-code-properties-toggle"
              data-testid="markdown-code-properties-toggle"
              :title="t('editor.codeBlockProperties')"
              @pointerdown.prevent="markdownPanel.rememberSelection()"
              @click.stop="toggleMarkdownCodeBlockControls"
            >{{ t('editor.properties') }}</button>
            <div
              v-if="markdownCodeBlockControlsOpen"
              class="markdown-code-popover"
              data-testid="markdown-code-popover"
              @click.stop
              @keydown.esc.stop="markdownCodeBlockControlsOpen = false"
            >
              <label>
                <span>{{ t('editor.codeLanguage') }}</span>
                <select
                  :value="markdownPanel.codeBlockAttrs.value.language"
                  data-testid="markdown-code-language"
                  @change="updateMarkdownCodeBlockAttribute('language', $event)"
                >
                  <option
                    v-if="!codeBlockLanguages.includes(markdownPanel.codeBlockAttrs.value.language)"
                    :value="markdownPanel.codeBlockAttrs.value.language"
                  >{{ markdownPanel.codeBlockAttrs.value.language }}</option>
                  <option v-for="language in codeBlockLanguages" :key="language" :value="language">{{ language }}</option>
                </select>
              </label>
              <label>
                <span>{{ t('editor.backgroundColor') }}</span>
                <input
                  type="color"
                  :value="markdownPanel.codeBlockAttrs.value.backgroundColor"
                  data-testid="markdown-code-background"
                  @input="updateMarkdownCodeBlockAttribute('backgroundColor', $event)"
                />
              </label>
              <label>
                <span>{{ t('editor.textColor') }}</span>
                <input
                  type="color"
                  :value="markdownPanel.codeBlockAttrs.value.textColor"
                  data-testid="markdown-code-text-color"
                  @input="updateMarkdownCodeBlockAttribute('textColor', $event)"
                />
              </label>
              <label>
                <span>{{ t('editor.borderColor') }}</span>
                <input
                  type="color"
                  :value="markdownPanel.codeBlockAttrs.value.borderColor"
                  data-testid="markdown-code-border-color"
                  @input="updateMarkdownCodeBlockAttribute('borderColor', $event)"
                />
              </label>
              <label>
                <span>{{ t('editor.borderWidth') }}</span>
                <select
                  :value="String(markdownPanel.codeBlockAttrs.value.borderWidth)"
                  data-testid="markdown-code-border-width"
                  @change="updateMarkdownCodeBlockAttribute('borderWidth', $event)"
                >
                  <option v-for="width in [0, 1, 2, 3, 4]" :key="width" :value="width">{{ width }} px</option>
                </select>
              </label>
              <label>
                <span>{{ t('editor.cornerRadius') }}</span>
                <select
                  :value="String(markdownPanel.codeBlockAttrs.value.borderRadius)"
                  data-testid="markdown-code-radius"
                  @change="updateMarkdownCodeBlockAttribute('borderRadius', $event)"
                >
                  <option v-for="radius in [0, 4, 8, 12, 18, 24]" :key="radius" :value="radius">{{ radius }} px</option>
                </select>
              </label>
              <label>
                <span>{{ t('editor.padding') }}</span>
                <select
                  :value="String(markdownPanel.codeBlockAttrs.value.padding)"
                  data-testid="markdown-code-padding"
                  @change="updateMarkdownCodeBlockAttribute('padding', $event)"
                >
                  <option v-for="padding in [8, 12, 16, 20, 24]" :key="padding" :value="padding">{{ padding }} px</option>
                </select>
              </label>
              <label>
                <span>{{ t('editor.codeWidth') }}</span>
                <input
                  type="number"
                  min="0"
                  max="2400"
                  placeholder="auto"
                  :value="markdownPanel.codeBlockAttrs.value.blockWidth || ''"
                  data-testid="markdown-code-width"
                  @change="updateMarkdownCodeBlockAttribute('blockWidth', $event)"
                />
              </label>
              <label>
                <span>{{ t('editor.codeHeight') }}</span>
                <input
                  type="number"
                  min="0"
                  max="1200"
                  placeholder="auto"
                  :value="markdownPanel.codeBlockAttrs.value.blockHeight || ''"
                  data-testid="markdown-code-height"
                  @change="updateMarkdownCodeBlockAttribute('blockHeight', $event)"
                />
              </label>
              <label class="markdown-code-checkbox">
                <input
                  type="checkbox"
                  :checked="markdownPanel.codeBlockAttrs.value.wrap"
                  data-testid="markdown-code-wrap"
                  @change="updateMarkdownCodeBlockAttribute('wrap', $event)"
                />
                <span>{{ t('editor.wrapLines') }}</span>
              </label>
              <button
                type="button"
                class="markdown-code-reset"
                data-testid="markdown-code-reset"
                @click="resetMarkdownCodeBlockAttributes"
              >{{ t('editor.resetStyle') }}</button>
            </div>
          </div>
          <div class="markdown-table-control">
            <button
              type="button"
              :class="['style-toggle', { active: markdownPanel.formatting.value.table || markdownTableControlsOpen }]"
              data-testid="markdown-table-toggle"
              @click.stop="toggleMarkdownTableControls"
            >{{ t('editor.table') }}</button>
            <div
              v-if="markdownTableControlsOpen"
              class="markdown-table-popover"
              data-testid="markdown-table-popover"
              @click.stop
              @keydown.esc.stop="markdownTableControlsOpen = false"
            >
              <label>
                <span>{{ t('editor.tableRows') }}</span>
                <input v-model.number="markdownTableRows" type="number" min="1" max="20" data-testid="markdown-table-rows" />
              </label>
              <label>
                <span>{{ t('editor.tableColumns') }}</span>
                <input v-model.number="markdownTableCols" type="number" min="1" max="12" data-testid="markdown-table-cols" />
              </label>
              <label>
                <span>{{ t('editor.tableRowHeight') }}</span>
                <input :value="markdownTableRowHeight" type="number" min="28" max="240" data-testid="markdown-table-row-height" @input="updateMarkdownTableRowHeight" />
              </label>
              <button type="button" class="style-toggle" data-testid="markdown-table-insert" @click="insertConfiguredMarkdownTable">{{ t('editor.insertTable') }}</button>
              <template v-if="markdownPanel.formatting.value.table">
                <div class="markdown-table-divider"></div>
                <div class="markdown-table-edit-grid">
                  <button type="button" class="style-toggle" data-testid="markdown-table-remove-row" @click="markdownPanel.removeTableRow()">− {{ t('editor.removeRow') }}</button>
                  <button type="button" class="style-toggle" data-testid="markdown-table-add-row" @click="markdownPanel.addTableRow()">+ {{ t('editor.addRow') }}</button>
                  <button type="button" class="style-toggle" data-testid="markdown-table-remove-col" @click="markdownPanel.removeTableColumn()">− {{ t('editor.removeColumn') }}</button>
                  <button type="button" class="style-toggle" data-testid="markdown-table-add-col" @click="markdownPanel.addTableColumn()">+ {{ t('editor.addColumn') }}</button>
                  <button type="button" class="style-toggle" :class="{ active: markdownTableAlignment === 'left' }" data-testid="markdown-table-align-left" @click="applyMarkdownTableAlignment('left')">{{ t('editor.left') }}</button>
                  <button type="button" class="style-toggle" :class="{ active: markdownTableAlignment === 'center' }" data-testid="markdown-table-align-center" @click="applyMarkdownTableAlignment('center')">{{ t('editor.center') }}</button>
                  <button type="button" class="style-toggle" :class="{ active: markdownTableAlignment === 'right' }" data-testid="markdown-table-align-right" @click="applyMarkdownTableAlignment('right')">{{ t('editor.right') }}</button>
                  <button type="button" class="style-toggle" :disabled="!canMoveMarkdownTable('up')" data-testid="markdown-table-move-up" @click="moveMarkdownTable('up')">{{ t('editor.moveTableUp') }}</button>
                  <button type="button" class="style-toggle" :disabled="!canMoveMarkdownTable('down')" data-testid="markdown-table-move-down" @click="moveMarkdownTable('down')">{{ t('editor.moveTableDown') }}</button>
                  <button type="button" class="style-toggle danger" data-testid="markdown-table-delete" @click="markdownPanel.deleteTable()">{{ t('editor.deleteTable') }}</button>
                </div>
              </template>
            </div>
          </div>
          <button
            v-if="markdownPanel.formatting.value.table"
            type="button"
            class="style-toggle markdown-table-quick-move"
            data-testid="markdown-table-quick-up"
            :disabled="!canMoveMarkdownTable('up')"
            :title="t('editor.moveTableUp')"
            :aria-label="t('editor.moveTableUp')"
            @click="moveMarkdownTable('up')"
          >↑</button>
          <button
            v-if="markdownPanel.formatting.value.table"
            type="button"
            class="style-toggle markdown-table-quick-move"
            data-testid="markdown-table-quick-down"
            :disabled="!canMoveMarkdownTable('down')"
            :title="t('editor.moveTableDown')"
            :aria-label="t('editor.moveTableDown')"
            @click="moveMarkdownTable('down')"
          >↓</button>
          <button
            type="button"
            class="style-toggle"
            @click="markdownPanel.insertHorizontalRule()"
          >{{ t('editor.horizontalRule') }}</button>
          <button
            type="button"
            class="style-toggle"
            data-testid="markdown-link-toggle"
            :class="{ active: markdownLinkEditorOpen || markdownPanel.formatting.value.link }"
            @click="toggleMarkdownLinkEditor"
          >{{ t('editor.link') }}</button>
        </div>
        <div
          v-if="markdownLinkEditorOpen"
          class="markdown-link-popover"
          @keydown.esc.stop="markdownLinkEditorOpen = false"
        >
          <input
            ref="markdownLinkInputRef"
            :value="markdownPanel.linkHref.value"
            data-testid="markdown-link-input"
            class="markdown-link-input"
            type="url"
            :placeholder="t('editor.linkPlaceholder')"
            @input="markdownPanel.setLinkHref($event.target.value)"
            @keydown.enter.prevent="applyMarkdownLink"
          />
          <button
            type="button"
            class="style-toggle"
            @click="applyMarkdownLink"
          >{{ t('editor.applyLink') }}</button>
          <button
            type="button"
            class="style-toggle"
            :disabled="!markdownPanel.formatting.value.link && !markdownPanel.linkHref.value"
            @click="removeMarkdownLink"
          >{{ t('editor.removeLink') }}</button>
        </div>
        <div
          id="markdown-editor"
          data-testid="markdown-editor"
          class="markdown-editor-shell"
          @pointerdown.capture="handleMarkdownPointerDownCapture"
          @contextmenu.prevent.stop="openMarkdownContextMenu($event)"
        >
          <EditorContent v-if="markdownPanel.editor.value" :editor="markdownPanel.editor.value" />
        </div>
        </div>
        <textarea
          v-show="markdownView === 'source'"
          ref="markdownSourceRef"
          id="markdown-source"
          :value="document.content.sourceText"
          data-testid="markdown-source"
          class="markdown-source markdown-source-inline"
          @input="editorState.updateMarkdownSource($event.target.value)"
        ></textarea>
      </div>

      <div
        ref="previewRef"
        class="markdown-export-preview"
        data-testid="markdown-preview"
        aria-hidden="true"
        v-html="markdownPanel.html.value"
      ></div>

      <div
        v-if="contextMenu && contextMenu.kind === 'markdown'"
        class="context-menu context-menu-fixed markdown-context-menu"
        :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
        role="menu"
        data-testid="markdown-context-menu"
        @pointerdown.stop
        @mousedown.prevent
        @contextmenu.prevent.stop
      >
        <p class="context-menu-caption">{{ t('editor.textStyle') }}</p>
        <button type="button" role="menuitem" data-testid="ctx-md-bold" @click="runContextAction('mdBold')">{{ t('editor.formatBold') }}</button>
        <button type="button" role="menuitem" data-testid="ctx-md-italic" @click="runContextAction('mdItalic')">{{ t('editor.formatItalic') }}</button>
        <button type="button" role="menuitem" data-testid="ctx-md-underline" @click="runContextAction('mdUnderline')">{{ t('editor.underline') }}</button>
        <button type="button" role="menuitem" data-testid="ctx-md-strike" @click="runContextAction('mdStrike')">{{ t('editor.strike') }}</button>
        <button type="button" role="menuitem" data-testid="ctx-md-code" @click="runContextAction('mdInlineCode')">{{ t('editor.inlineCode') }}</button>
        <div class="context-menu-divider"></div>
        <p class="context-menu-caption">{{ t('editor.sectionBlocks') }}</p>
        <button type="button" role="menuitem" data-testid="ctx-md-h1" @click="runContextAction('mdH1')">{{ t('editor.heading1') }}</button>
        <button type="button" role="menuitem" data-testid="ctx-md-h2" @click="runContextAction('mdH2')">{{ t('editor.heading2') }}</button>
        <button type="button" role="menuitem" data-testid="ctx-md-h3" @click="runContextAction('mdH3')">{{ t('editor.heading3') }}</button>
        <button type="button" role="menuitem" data-testid="ctx-md-bullet" @click="runContextAction('mdBulletList')">{{ t('editor.formatList') }}</button>
        <button type="button" role="menuitem" data-testid="ctx-md-ordered" @click="runContextAction('mdOrderedList')">{{ t('editor.orderedList') }}</button>
        <button type="button" role="menuitem" data-testid="ctx-md-task" @click="runContextAction('mdTaskList')">{{ t('editor.taskList') }}</button>
        <button type="button" role="menuitem" data-testid="ctx-md-quote" @click="runContextAction('mdBlockquote')">{{ t('editor.blockquote') }}</button>
        <button type="button" role="menuitem" data-testid="ctx-md-code-block" @click="runContextAction('mdCodeBlock')">{{ t('editor.codeBlock') }}</button>
        <div class="context-menu-divider"></div>
        <p class="context-menu-caption">{{ t('editor.insertStyle') }}</p>
        <button type="button" role="menuitem" data-testid="ctx-md-table" @click="runContextAction('mdTable')">{{ t('editor.table') }}</button>
        <button type="button" role="menuitem" data-testid="ctx-md-hr" @click="runContextAction('mdHr')">{{ t('editor.horizontalRule') }}</button>
        <button type="button" role="menuitem" data-testid="ctx-md-link" @click="runContextAction('mdLink')">{{ t('editor.link') }}</button>
        <div class="context-menu-divider"></div>
        <button type="button" role="menuitem" data-testid="ctx-md-save" @click="runContextAction('save')">{{ t('editor.save') }}</button>
        <button type="button" role="menuitem" data-testid="ctx-md-history" @click="runContextAction('history')">{{ t('editor.revisionOpen') }}</button>
        <button type="button" role="menuitem" data-testid="ctx-md-export" @click="runContextAction('exportMenu')">{{ t('editor.export') }}</button>
        <button type="button" role="menuitem" data-testid="ctx-md-import" @click="runContextAction('importMenu')">{{ t('editor.import') }}</button>
        <div class="context-menu-divider"></div>
        <button type="button" role="menuitem" data-testid="ctx-md-shortcuts" @click="runContextAction('shortcuts')">{{ t('shortcuts.menuLabel') }}</button>
      </div>
    </div>

    <div v-else class="workspace-grid">
      <div class="canvas-frame">
        <div class="ruler-spacer"></div>
        <div ref="rulerHRef" class="ruler ruler-h" @pointerdown="startGuideFromRuler('horizontal', $event)">
          <span v-for="tick in rulerTicks.x" :key="`rx-${tick.pos}`" class="ruler-tick" :style="{ left: `${tick.pos}px` }">{{ tick.label }}</span>
        </div>
        <div ref="rulerVRef" class="ruler ruler-v" @pointerdown="startGuideFromRuler('vertical', $event)">
          <span v-for="tick in rulerTicks.y" :key="`ry-${tick.pos}`" class="ruler-tick" :style="{ top: `${tick.pos}px` }">{{ tick.label }}</span>
        </div>

      <div
        v-if="isMindNote && noteView"
        class="note-dual-pane"
        data-testid="note-dual-pane"
      >
        <aside class="note-outline-pane" data-testid="note-outline-pane">
          <h4>{{ t('mindmap.sectionOutline') }}</h4>
          <button
            v-for="row in outlineRows"
            :key="`note-outline-${row.id}`"
            type="button"
            :class="['note-outline-row', { active: row.id === editorState.activeNodeId.value }]"
            :style="{ paddingLeft: `${10 + row.depth * 14}px` }"
            :data-testid="`note-outline-${row.id}`"
            @click="editorState.selectNode(row.id)"
          >{{ row.text }}</button>
        </aside>

        <main class="note-notes-pane" data-testid="note-notes-pane">
          <p v-if="!activeNodeBlocks.length" class="note-notes-empty">{{ t('editor.noteEmpty') }}</p>
          <article
            v-for="block in activeNodeBlocks"
            :key="`note-card-${block.id}`"
            class="note-block-card"
            :style="{ marginLeft: `${block.depth * 20}px` }"
            :data-testid="`note-block-card-${block.id}`"
          >
            <div class="note-block-card-head">
              <span class="note-block-card-dot" :style="{ opacity: block.depth ? 0.45 : 1 }"></span>
              <button type="button" :title="t('editor.indentTextBlock')" @click="editorState.indentMindNoteTextBlock(block.id)">⇥</button>
              <button type="button" :title="t('editor.outdentTextBlock')" @click="editorState.outdentMindNoteTextBlock(block.id)">⇤</button>
              <button type="button" class="danger" :title="t('editor.deleteTextBlock')" @click="editorState.removeMindNoteTextBlock(block.id)">×</button>
            </div>
            <MindNoteBlockEditor
              :html="block.html"
              @update="payload => editorState.applyMindNoteBlockContent(block.id, payload)"
              @focus="editorState.beginMindNoteBlockEdit(block.id)"
              @blur="editorState.commitMindNoteBlockEdit(block.id)"
            />
          </article>
          <button
            type="button"
            class="note-add-block"
            data-testid="note-add-block"
            @click="editorState.addMindNoteTextBlock()"
          >+ {{ t('editor.addTextBlock') }}</button>
        </main>
      </div>

      <div
        v-show="!(isMindNote && noteView)"
        ref="canvasCardRef"
        :class="['canvas-card', { panning: Boolean(panState) || spacePressed }]"
      >
        <transition name="canvas-toast">
          <div
            v-if="editorToast.visible"
            :class="['editor-toast', editorToast.tone]"
            :role="editorToast.tone === 'error' ? 'alert' : 'status'"
            aria-live="polite"
            data-testid="save-toast"
          >
            {{ editorToast.message }}
          </div>
        </transition>

        <div
          v-if="contextMenu"
          ref="contextMenuRef"
          class="context-menu"
          :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
          role="menu"
          data-testid="context-menu"
          @pointerdown.stop
          @contextmenu.prevent.stop
        >
          <template v-if="contextMenu.kind === 'node'">
            <button type="button" role="menuitem" data-testid="ctx-copy" @click="runContextAction('copy')">{{ t('editor.menuCopy') }}</button>
            <button type="button" role="menuitem" data-testid="ctx-cut" @click="runContextAction('cut')">{{ t('editor.menuCut') }}</button>
            <button type="button" role="menuitem" data-testid="ctx-paste" @click="runContextAction('paste')">{{ t('editor.menuPaste') }}</button>
            <button type="button" role="menuitem" data-testid="ctx-duplicate" @click="runContextAction('duplicate')">{{ t('editor.menuDuplicate') }}</button>
            <div class="context-menu-divider"></div>
            <button type="button" role="menuitem" class="danger" data-testid="ctx-delete" @click="runContextAction('delete')">{{ t('editor.menuDelete') }}</button>
            <div class="context-menu-divider"></div>
            <button type="button" role="menuitem" :disabled="selectedNodeIds.length < 2" data-testid="ctx-group" @click="runContextAction('group')">{{ t('editor.menuGroup') }}</button>
            <button type="button" role="menuitem" data-testid="ctx-ungroup" @click="runContextAction('ungroup')">{{ t('editor.menuUngroup') }}</button>
            <button type="button" role="menuitem" data-testid="ctx-lock" @click="runContextAction('lock')">{{ selectedNodesAllLocked ? t('editor.menuUnlock') : t('editor.menuLock') }}</button>
            <button v-if="!isTreeMode && selectedNodeIds.length <= 1" type="button" role="menuitem" data-testid="ctx-reset-size" @click="runContextAction('resetSize')">{{ t('editor.resetSize') }}</button>
            <div class="context-menu-divider"></div>
            <button type="button" role="menuitem" data-testid="ctx-front" @click="runContextAction('front')">{{ t('editor.menuFront') }}</button>
            <button type="button" role="menuitem" data-testid="ctx-back" @click="runContextAction('back')">{{ t('editor.menuBack') }}</button>
            <div class="context-menu-divider"></div>
            <button type="button" role="menuitem" data-testid="ctx-edit-text" @click="runContextAction('editText')">{{ t('editor.menuEditText') }}</button>
          </template>

          <template v-else-if="contextMenu.kind === 'edge'">
            <button type="button" role="menuitem" data-testid="ctx-edit-label" @click="runContextAction('editEdgeLabel')">{{ t('editor.menuEditLabel') }}</button>
            <div class="context-menu-divider"></div>
            <button type="button" role="menuitem" data-testid="ctx-route-orthogonal" @click="runContextAction('routeOrthogonal')">{{ t('editor.menuRouteOrthogonal') }}</button>
            <button type="button" role="menuitem" data-testid="ctx-route-straight" @click="runContextAction('routeStraight')">{{ t('editor.menuRouteStraight') }}</button>
            <button type="button" role="menuitem" data-testid="ctx-route-curve" @click="runContextAction('routeCurve')">{{ t('editor.menuRouteCurve') }}</button>
            <div class="context-menu-divider"></div>
            <button type="button" role="menuitem" data-testid="ctx-marker-arrow" @click="runContextAction('markerArrow')">{{ t('editor.menuMarkerArrow') }}</button>
            <button type="button" role="menuitem" data-testid="ctx-marker-double" @click="runContextAction('markerDouble')">{{ t('editor.menuMarkerDouble') }}</button>
            <button type="button" role="menuitem" data-testid="ctx-marker-none" @click="runContextAction('markerNone')">{{ t('editor.menuMarkerNone') }}</button>
            <div class="context-menu-divider"></div>
            <button type="button" role="menuitem" class="danger" data-testid="ctx-delete-edge" @click="runContextAction('delete')">{{ t('editor.menuDelete') }}</button>
          </template>

          <template v-else>
            <p class="context-menu-caption">{{ t('editor.fileActions') }}</p>
            <button type="button" role="menuitem" data-testid="ctx-canvas-save" @click="runContextAction('save')">{{ t('editor.save') }}</button>
            <button type="button" role="menuitem" data-testid="ctx-canvas-history" @click="runContextAction('history')">{{ t('editor.revisionOpen') }}</button>
            <button type="button" role="menuitem" data-testid="ctx-canvas-print" @click="runContextAction('print')">{{ t('editor.print') }}</button>
            <button type="button" role="menuitem" data-testid="ctx-canvas-export" @click="runContextAction('exportMenu')">{{ t('editor.export') }}</button>
            <button type="button" role="menuitem" data-testid="ctx-canvas-import" @click="runContextAction('importMenu')">{{ t('editor.import') }}</button>
            <div class="context-menu-divider"></div>
            <p class="context-menu-caption">{{ t('editor.insertStyle') }}</p>
            <button v-if="document.mode === 'flowchart'" type="button" role="menuitem" data-testid="ctx-canvas-insert-process" @click="runContextAction('insertProcess')">{{ t('editor.insertProcess') }}</button>
            <button v-if="document.mode === 'flowchart'" type="button" role="menuitem" data-testid="ctx-canvas-insert-decision" @click="runContextAction('insertDecision')">{{ t('editor.insertDecision') }}</button>
            <button v-if="isTreeMode" type="button" role="menuitem" data-testid="ctx-canvas-insert-text" @click="runContextAction('insertTextBlock')">{{ t('editor.insertTextBlock') }}</button>
            <button v-if="isTreeMode" type="button" role="menuitem" data-testid="ctx-canvas-insert-child" @click="runContextAction('insertChildTopic')">{{ t('editor.insertChildTopic') }}</button>
            <button v-if="isTreeMode" type="button" role="menuitem" data-testid="ctx-canvas-insert-sibling" @click="runContextAction('insertSiblingTopic')">{{ t('editor.insertSiblingTopic') }}</button>
            <div class="context-menu-divider"></div>
            <button type="button" role="menuitem" data-testid="ctx-canvas-paste" @click="runContextAction('paste')">{{ t('editor.menuPaste') }}</button>
            <button type="button" role="menuitem" data-testid="ctx-canvas-new" @click="runContextAction('newNode')">{{ t('editor.menuNewNode') }}</button>
            <button type="button" role="menuitem" data-testid="ctx-canvas-select-all" @click="runContextAction('selectAll')">{{ t('editor.menuSelectAll') }}</button>
            <div class="context-menu-divider"></div>
            <button type="button" role="menuitem" data-testid="ctx-canvas-fit" @click="runContextAction('fit')">{{ t('editor.menuFit') }}</button>
            <button type="button" role="menuitem" data-testid="ctx-canvas-grid" @click="runContextAction('grid')">{{ showGrid ? t('editor.menuHideGrid') : t('editor.menuShowGrid') }}</button>
            <button type="button" role="menuitem" :disabled="!guides.length" data-testid="ctx-canvas-clear-guides" @click="runContextAction('clearGuides')">{{ t('editor.menuClearGuides') }}</button>
            <div class="context-menu-divider"></div>
            <button type="button" role="menuitem" data-testid="ctx-canvas-shortcuts" @click="runContextAction('shortcuts')">{{ t('shortcuts.menuLabel') }}</button>
          </template>
        </div>


        <Teleport to="body">
          <div v-if="revisionPanelOpen" class="revision-panel" data-testid="revision-panel">
            <header class="revision-panel-head">
              <h4>{{ t('editor.revisionTitle') }}</h4>
              <button type="button" data-testid="revision-close" @click="revisionPanelOpen = false">×</button>
            </header>
            <p v-if="revisionBusy" class="revision-hint">{{ t('editor.revisionLoading') }}</p>
            <p v-else-if="!revisionItems.length" class="revision-hint">{{ t('editor.revisionEmpty') }}</p>
            <ul v-else class="revision-list">
              <li v-for="item in revisionItems" :key="item.id" :data-testid="`revision-item-${item.id}`">
                <div class="revision-meta">
                  <strong>#{{ item.revisionNo }} {{ item.title }}</strong>
                  <span>{{ formatRevisionTime(item) }} · {{ Math.max(1, Math.round((item.sizeBytes || 0) / 1024)) }} KB · {{ item.source }}</span>
                </div>
                <button type="button" :disabled="revisionBusy" @click="restoreRevision(item)">{{ t('editor.revisionRestore') }}</button>
              </li>
            </ul>
          </div>
        </Teleport>

        <div class="canvas-hud">
          <div class="canvas-hud-chip">
            <span class="canvas-hud-label">{{ t('editor.zoom') }}</span>
            <span data-testid="zoom-indicator">{{ Math.round(document.content.viewport.zoom * 100) }}%</span>
            <button type="button" class="hud-mini" data-testid="zoom-fit" :title="t('editor.fit')" @click="fitToWindow">{{ t('editor.fit') }}</button>
          </div>
          <div class="canvas-hud-chip metric">
            <span class="canvas-hud-dot"></span>
            <span data-testid="node-count">{{ visibleNodes.length }}</span>
          </div>
          <div class="canvas-hud-chip metric">
            <span class="canvas-hud-line"></span>
            <span data-testid="edge-count">{{ visibleEdges.length }}</span>
          </div>
        </div>

        <span
          v-if="!visibleNodes.length"
          class="canvas-empty-status"
          data-testid="canvas-empty-status"
          role="status"
        >{{ t('editor.canvasEmpty') }}</span>

        <svg
          ref="svgRef"
          class="diagram-canvas"
          role="img"
          :aria-label="document.title"
          :viewBox="`0 0 ${canvasWidth} ${canvasHeight}`"
          preserveAspectRatio="xMidYMid meet"
          @wheel.prevent="handleCanvasWheel"
          @pointerup="handleCanvasPointerUpOnSvg"
          @dragenter.prevent="handleCanvasDragEnter"
          @dragover.prevent="handleCanvasDragOver"
          @dragleave="handleCanvasDragLeave"
          @drop.prevent="handleCanvasDrop"
          @pointerleave="endDrag"
        >
          <defs>
            <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(71, 85, 105, 0.16)" stroke-width="1" />
            </pattern>
            <marker id="edge-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="12" markerHeight="12" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" stroke="context-stroke" />
            </marker>
            <marker id="edge-dot" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="10" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
              <circle cx="5" cy="5" r="4" fill="context-stroke" stroke="none" />
            </marker>
            <marker id="edge-diamond" viewBox="0 0 12 12" refX="6" refY="6" markerWidth="12" markerHeight="12" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
              <path d="M 6 0 L 12 6 L 6 12 L 0 6 Z" fill="context-stroke" stroke="none" />
            </marker>
            <marker id="edge-square" viewBox="0 0 12 12" refX="6" refY="6" markerWidth="12" markerHeight="12" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
              <rect x="1.5" y="1.5" width="9" height="9" fill="context-stroke" stroke="none" />
            </marker>
            <linearGradient
              v-for="(palette, accent) in ACCENT_PALETTES"
              :id="`node-grad-${accent}`"
              :key="`grad-${accent}`"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" :stop-color="palette.fill" />
              <stop offset="100%" :stop-color="palette.fillActive" />
            </linearGradient>
          </defs>

          <rect
            :width="canvasWidth"
            :height="canvasHeight"
            :fill="showGrid ? 'url(#grid)' : 'transparent'"
            data-testid="canvas-surface"
            @click="handleCanvasClick"
            @pointerdown="handleCanvasPointerDown"
            @pointerup="handleCanvasPointerUp"
            @contextmenu.prevent.stop="openContextMenu($event, { kind: 'canvas' })"
            @dragenter.prevent="handleCanvasDragEnter"
            @dragover.prevent="handleCanvasDragOver"
            @dragleave="handleCanvasDragLeave"
            @drop.prevent="handleCanvasDrop"
          />

          <g class="canvas-transform" :transform="canvasTransform">
            <g v-if="guides.length" class="guide-layer">
              <line
                v-for="(guide, index) in guides"
                :key="`guide-${index}`"
                :x1="guide.axis === 'vertical' ? guide.pos : 0"
                :y1="guide.axis === 'horizontal' ? guide.pos : 0"
                :x2="guide.axis === 'vertical' ? guide.pos : canvasWidth"
                :y2="guide.axis === 'horizontal' ? guide.pos : canvasHeight"
                class="guide-line"
              />
              <line
                v-for="(guide, index) in guides"
                :key="`guide-hit-${index}`"
                :x1="guide.axis === 'vertical' ? guide.pos : 0"
                :y1="guide.axis === 'horizontal' ? guide.pos : 0"
                :x2="guide.axis === 'vertical' ? guide.pos : canvasWidth"
                :y2="guide.axis === 'horizontal' ? guide.pos : canvasHeight"
                class="guide-hit"
                @pointerdown.stop="startGuideMove(index, $event)"
                @dblclick.stop="removeGuide(index)"
              />
            </g>

            <g v-if="groupOutlines.length" class="group-outlines" pointer-events="none">
              <rect
                v-for="outline in groupOutlines"
                :key="outline.id"
                :x="outline.x"
                :y="outline.y"
                :width="outline.width"
                :height="outline.height"
                class="group-outline"
              />
            </g>


            <g v-if="visibleBoundaries.length" class="boundary-layer" pointer-events="none">
              <rect
                v-for="boundary in visibleBoundaries"
                :key="boundary.id"
                :x="boundary.x"
                :y="boundary.y"
                :width="boundary.width"
                :height="boundary.height"
                rx="18"
                class="mindmap-boundary"
                :style="{ stroke: resolveBoundaryColor(boundary.accent), strokeWidth: 1.6, strokeDasharray: '6 5', opacity: 0.75, fill: 'none' }"
                :data-testid="`boundary-${boundary.id}`"
              />
            </g>

            <g v-if="connectPreview" class="connect-preview" pointer-events="none">
              <path :d="connectPreview.path" class="connect-preview-path" />
              <circle :cx="connectPreview.to.x" :cy="connectPreview.to.y" r="4.5" class="connect-preview-dot" />
            </g>

            <g v-if="linkPreview" class="link-preview-layer" pointer-events="none">
              <path :d="linkPreview.path" class="link-preview-path" />
              <circle
                v-for="anchor in linkPreview.anchors"
                :key="anchor.key"
                :cx="anchor.x"
                :cy="anchor.y"
                r="7"
                class="link-preview-anchor"
              />
            </g>
            <rect
              v-if="selectionBounds"
              class="selection-marquee"
              :x="selectionBounds.x"
              :y="selectionBounds.y"
              :width="selectionBounds.width"
              :height="selectionBounds.height"
              pointer-events="none"
            />

            <g v-if="timelineAxis" class="timeline-axis" pointer-events="none">
              <line
                :x1="timelineAxis.x1"
                :y1="timelineAxis.axisY"
                :x2="timelineAxis.x2"
                :y2="timelineAxis.axisY"
                :class="['timeline-axis-line', timelineAxis.kind]"
              />
              <circle
                v-for="dot in timelineAxis.dots"
                :key="dot.id"
                :cx="dot.x"
                :cy="timelineAxis.axisY"
                r="4.5"
                class="timeline-axis-dot"
              />
            </g>

            <g
              v-for="edge in visibleEdges"
              :key="edge.id"
              @pointerenter="handleEdgeHover(edge.id)"
              @pointerleave="handleEdgeHover(null)"
              @contextmenu.prevent.stop="openContextMenu($event, { kind: 'edge', edgeId: edge.id })"
            >
              <path
                :d="edge.path"
                class="edge-hit-area"
                fill="none"
                @click.stop="handleEdgeClick(edge)"
                @dblclick.stop="openEdgeLabelEditor(edge)"
              />
              <path
                :d="edge.path"
                :data-testid="`edge-path-${edge.id}`"
                :class="['edge-path', {
                  active: edge.id === editorState.activeEdgeId.value,
                  hovered: edge.id === hoveredEdgeId,
                  subtle: !edge.label,
                  relation: edge.kind === 'relationship'
                }]"
                fill="none"
                :stroke="resolveEdgeStroke(edge)"
                :stroke-width="resolveEdgeWidth(edge)"
                :stroke-dasharray="resolveEdgeDasharray(edge)"
                :marker-start="resolveEdgeMarkerStart(edge)"
                :marker-end="resolveEdgeMarkerEnd(edge)"
                stroke-linecap="round"
                stroke-linejoin="round"
                @click.stop="handleEdgeClick(edge)"
                @dblclick.stop="openEdgeLabelEditor(edge)"
              />
              <g
                v-if="edge.label && edge.id !== edgeLabelEditor?.edgeId"
                class="edge-label-chip"
                :transform="`translate(${edge.labelPosition.x} ${edge.labelPosition.y})`"
                @click.stop="handleEdgeClick(edge)"
                @dblclick.stop="openEdgeLabelEditor(edge)"
              >
                <rect
                  x="-52"
                  y="-14"
                  width="104"
                  height="28"
                  rx="14"
                  :class="['edge-label-bg', { active: edge.id === editorState.activeEdgeId.value }]"
                  :style="resolveEdgeLabelStyle(edge)"
                />
                <text class="edge-label-text" text-anchor="middle" dy="5">{{ edge.labelText }}</text>
              </g>
            </g>

            <g
              v-for="node in visibleNodes"
              :key="node.id"
              :transform="node.rotation ? `rotate(${node.rotation} ${node.x + node.width / 2} ${node.y + node.height / 2})` : undefined"
              @pointerenter="handleNodeHover(node.id)"
              @pointerleave="handleNodeHover(null)"
              @contextmenu.prevent.stop="openContextMenu($event, { kind: 'node', nodeId: node.id })"
            >
              <path
                v-if="isTreeMode"
                :data-testid="`node-shape-${node.id}`"
                :d="topicShapePath(node)"
                :class="nodeShapeClass(node)"
                :style="resolveNodeShapeStyle(node)"
                @pointerdown="startDrag(node, $event)"
                @click.stop="handleNodeClick(node, $event)"
                @dblclick.stop.prevent="openTextOverlay(node.id)"
              />
              <rect
                v-else-if="node.kind === 'process'"
                :data-testid="`node-shape-${node.id}`"
                :x="node.x"
                :y="node.y"
                :width="node.width"
                :height="node.height"
                rx="8"
                :class="nodeShapeClass(node)"
                :style="resolveNodeShapeStyle(node)"
                @pointerdown="startDrag(node, $event)"
                @click.stop="handleNodeClick(node, $event)"
                @dblclick.stop.prevent="openTextOverlay(node.id)"
              />
              <path
                v-else
                :data-testid="`node-shape-${node.id}`"
                :d="getNodePath(node)"
                :class="nodeShapeClass(node)"
                :style="resolveNodeShapeStyle(node)"
                @pointerdown="startDrag(node, $event)"
                @click.stop="handleNodeClick(node, $event)"
                @dblclick.stop.prevent="openTextOverlay(node.id)"
              />
              <g v-if="isTreeMode && nodeMarkerBadges(node).length" class="node-marker-row">
                <g
                  v-for="badge in nodeMarkerBadges(node)"
                  :key="badge.key"
                  :class="['node-marker-badge', { removable: Boolean(badge.markerId) }]"
                  :transform="`translate(${badge.x} ${badge.y})`"
                  :data-testid="badge.markerId ? `node-badge-${node.id}-${badge.markerId}` : undefined"
                  @pointerdown.stop
                  @click.stop="removeBadge(badge, node)"
                >
                  <title>{{ badge.title }}</title>
                  <template v-if="badge.priority">
                    <rect :width="badge.size" :height="badge.size" rx="5" :fill="badge.color" />
                    <text
                      class="node-priority-text"
                      :x="badge.size / 2"
                      :y="badge.size / 2 + 3.8"
                      text-anchor="middle"
                      :style="{ fill: '#ffffff', fontSize: 10, fontWeight: 700 }"
                    >{{ badge.label }}</text>
                  </template>
                  <text
                    v-else
                    class="node-marker-glyph"
                    :x="badge.size / 2"
                    :y="badge.size / 2 + 4.8"
                    text-anchor="middle"
                    :style="{ fontSize: 14 }"
                  >{{ badge.label }}</text>
                </g>
              </g>
              <g v-if="isTreeMode && node.progress !== null && node.progress !== undefined" class="node-progress" pointer-events="none">
                <rect
                  :x="node.x + 14"
                  :y="node.y + node.height - 9"
                  :width="Math.max(node.width - 28, 20)"
                  height="4"
                  rx="2"
                  class="node-progress-track"
                  :style="{ fill: 'rgba(24, 24, 27, 0.16)' }"
                />
                <rect
                  :x="node.x + 14"
                  :y="node.y + node.height - 9"
                  :width="Math.max((Math.max(node.width - 28, 20)) * (Number(node.progress) || 0) / 100, 0)"
                  height="4"
                  rx="2"
                  class="node-progress-fill"
                  :style="{ fill: resolveAccentPalette(node.style?.accent).stroke, opacity: 0.85 }"
                />
              </g>
              <g v-if="isTreeMode && nodeLabelChips(node).length" class="node-labels" pointer-events="none">
                <g
                  v-for="chip in nodeLabelChips(node)"
                  :key="chip.key"
                  :transform="`translate(${chip.x} ${chip.y})`"
                >
                  <rect :width="chip.width" height="20" rx="10" class="node-label-chip" :style="{ fill: '#ffffff', stroke: '#e4e4e7', strokeWidth: 1 }" />
                  <text
                    class="node-label-text"
                    :x="chip.width / 2"
                    y="14"
                    text-anchor="middle"
                    :style="{ fontSize: 11, fill: '#71717a' }"
                  >{{ chip.label }}</text>
                </g>
              </g>
              <title v-if="node.tooltip">{{ node.tooltip }}</title>
              <image
                v-if="node.image"
                :href="resolveNodeImageSrc(node.image)"
                :x="resolveNodeImageRect(node).x"
                :y="resolveNodeImageRect(node).y"
                :width="resolveNodeImageRect(node).width"
                :height="resolveNodeImageRect(node).height"
                preserveAspectRatio="xMidYMid meet"
                class="node-image"
                pointer-events="none"
              />
              <g
                v-if="node.link"
                class="node-link-badge"
                :transform="`translate(${resolveNodeLinkBadge(node).x} ${resolveNodeLinkBadge(node).y})`"
                @pointerdown.stop
                @click.stop="openNodeLink(node)"
              >
                <circle r="8" />
                <path d="M -3.5 -1.5 L 1 -6 M 0 -6 L 4 -6 L 4 -2 M 2.5 2.5 L -2 7 M -4 2 L -4 6 L 0 6" />
              </g>
              <rect
                v-if="node.kind === 'container' || node.kind === 'swimlane'"
                class="node-header-hit"
                :x="node.x"
                :y="node.y"
                :width="node.width"
                :height="node.kind === 'swimlane' ? 38 : 34"
                @pointerdown="startDrag(node, $event)"
                @click.stop="handleNodeClick(node, $event)"
              />
              <text
                v-show="node.id !== textOverlay.editingNodeId.value"
                :x="node.kind === 'swimlane' ? node.x + 14 : node.x + node.width / 2"
                :text-anchor="node.kind === 'swimlane' ? 'start' : 'middle'"
                :y="resolveNodeLabelY(node)"
                text-anchor="middle"
                class="node-label"
                :data-testid="`node-label-${node.id}`"
                :style="resolveNodeLabelStyle(node)"
                @pointerdown="startDrag(node, $event)"
                @click.stop="handleNodeClick(node, $event)"
                @dblclick.stop.prevent="openTextOverlay(node.id)"
              >
                <template v-if="isTreeMode">
                  <tspan
                    v-for="(line, lineIndex) in nodeDisplayLines(node)"
                    :key="lineIndex"
                    :x="node.x + node.width / 2"
                    :dy="lineIndex === 0 ? 0 : nodeLineHeight(node)"
                  >{{ line }}</tspan>
                </template>
                <template v-else>{{ node.text }}</template>
              </text>
              <g v-if="showAnchorHints(node)" class="node-anchor-hints">
                <circle
                  v-for="anchor in resolveNodeAnchors(node)"
                  :key="anchor.key"
                  :cx="resolveNodeAnchorDisplayPoint(anchor).x"
                  :cy="resolveNodeAnchorDisplayPoint(anchor).y"
                  r="6.5"
                  :class="['node-anchor-dot', {
                    active: connectState?.fromNodeId === node.id && connectState?.fromAnchor === anchor.name,
                    target: connectTarget?.nodeId === node.id && connectTarget?.anchor === anchor.name
                  }]"
                  @pointerdown="startConnectFromAnchor(node, anchor, $event)"
                  @click.stop.prevent
                />
              </g>
            </g>

            <g v-if="visibleSummaries.length" class="summary-layer">
              <g
                v-for="summary in visibleSummaries"
                :key="summary.id"
                class="mindmap-summary"
                :class="{ active: summary.active }"
                :data-testid="`summary-${summary.id}`"
                @click.stop="editorState.selectSummary(summary.id)"
              >
                <path :d="summary.path" class="mindmap-summary-bracket" :style="{ stroke: resolveBoundaryColor(summary.accent), strokeWidth: 2, fill: 'none' }" />
                <path :d="summary.path" class="mindmap-summary-hit" :style="{ stroke: 'transparent', strokeWidth: 14, fill: 'none' }" @click.stop="editorState.selectSummary(summary.id)" />
                <g v-if="summary.text" :transform="`translate(${summary.labelX} ${summary.labelY})`">
                  <rect
                    :x="-summary.labelWidth / 2"
                    y="-11"
                    :width="summary.labelWidth"
                    height="22"
                    rx="11"
                    class="mindmap-summary-chip"
                    :style="{ fill: '#ffffff', stroke: resolveBoundaryColor(summary.accent), strokeWidth: summary.active ? 2.2 : 1.4 }"
                  />
                  <text class="mindmap-summary-text" text-anchor="middle" dy="4" :style="{ fontSize: 11.5, fill: '#18181b' }">{{ summary.text }}</text>
                </g>
                <circle
                  v-else
                  :cx="summary.labelX"
                  :cy="summary.labelY"
                  r="7"
                  class="mindmap-summary-dot"
                  :style="{ fill: '#ffffff', stroke: resolveBoundaryColor(summary.accent), strokeWidth: 1.6 }"
                  @click.stop="editorState.selectSummary(summary.id)"
                />
              </g>
            </g>

            <foreignObject
              v-if="edgeLabelEditor"
              :x="edgeLabelEditor.x - 82"
              :y="edgeLabelEditor.y - 18"
              width="164"
              height="36"
              class="inline-edge-editor"
            >
              <div xmlns="http://www.w3.org/1999/xhtml" class="inline-edge-editor-shell">
                <input
                  v-model="edgeLabelEditor.text"
                  data-testid="edge-label-input"
                  class="inline-edge-input"
                  type="text"
                  maxlength="60"
                  autofocus
                  @keydown.enter.prevent="submitEdgeLabelEditor"
                  @keydown.esc.prevent="closeEdgeLabelEditor"
                />
              </div>
            </foreignObject>

            <g v-if="edgeDragPreview" class="edge-drag-preview" pointer-events="none">
              <path :d="edgeDragPreview" class="connect-preview-path" />
            </g>

            <g v-if="resizeHandles.length" class="resize-handles">
              <rect
                v-for="handle in resizeHandles"
                :key="handle.dir"
                :x="handle.x - 4"
                :y="handle.y - 4"
                width="8"
                height="8"
                :class="['resize-handle', `dir-${handle.dir}`]"
                :style="{ cursor: handle.cursor }"
                :transform="handle.rotation ? `rotate(${handle.rotation} ${handle.x} ${handle.y})` : undefined"
                @pointerdown="startResize(selectedNode, handle.dir, $event)"
              />
            </g>

            <g v-if="rotationHandle" class="rotation-handle-group">
              <line
                :x1="rotationHandle.anchorX"
                :y1="rotationHandle.anchorY"
                :x2="rotationHandle.x"
                :y2="rotationHandle.y"
                class="rotation-handle-line"
              />
              <g
                class="rotation-handle-knob"
                @pointerdown="startRotate(selectedNode, $event)"
              >
                <title>{{ t('editor.dragToRotate') }}</title>
                <circle
                  :cx="rotationHandle.x"
                  :cy="rotationHandle.y"
                  r="9"
                  class="rotation-handle"
                  data-testid="rotation-handle"
                />
                <text
                  :x="rotationHandle.x"
                  :y="rotationHandle.y + 4"
                  text-anchor="middle"
                  class="rotation-handle-glyph"
                >↻</text>
              </g>
            </g>

            <g v-if="activeEdgeHandles.length" class="edge-handles">
              <circle
                v-for="handle in activeEdgeHandles"
                :key="handle.key"
                :class="['edge-handle', handle.kind]"
                :cx="handle.x"
                :cy="handle.y"
                r="6"
                @pointerdown="startEdgeHandleDrag(activeEdge, handle, $event)"
              />
            </g>

            <g v-if="dragGuides.length" class="align-guides" pointer-events="none">
              <template v-for="(guide, index) in dragGuides" :key="`guide-${index}`">
                <line
                  :x1="guide.x1"
                  :y1="guide.y1"
                  :x2="guide.x2"
                  :y2="guide.y2"
                  :class="['align-guide', { spacing: guide.spacing, container: guide.container }]"
                />
                <text
                  v-if="guide.label"
                  :x="guide.labelX"
                  :y="guide.labelY"
                  class="align-guide-label"
                  text-anchor="middle"
                >{{ guide.label }}</text>
              </template>
            </g>
          </g>
        </svg>

        <!-- 节点文字编辑：用普通 HTML 浮层，而不是 SVG foreignObject。
             foreignObject 里的 input 在部分浏览器/输入法下无法输入。 -->
        <div
          v-if="editingNodeOverlay"
          class="node-text-overlay"
          :style="nodeTextOverlayStyle"
          data-testid="node-text-overlay"
        >
          <textarea
            ref="nodeTextInputRef"
            v-model="textOverlay.draftText.value"
            data-testid="text-overlay-input"
            class="inline-node-input"
            rows="1"
            maxlength="100"
            @focus="handleTextOverlayFocus"
            @blur="handleTextOverlayBlur"
            @pointerdown="handleOverlayPointerDown(editingNodeOverlay, $event)"
            @keydown.enter.prevent="submitTextOverlayWithShortcut('sibling')"
            @keydown.tab.prevent="submitTextOverlayWithShortcut('child')"
            @keydown.esc.prevent="textOverlay.cancel()"
          />
        </div>

        <div v-if="document.mode === 'mindmap' || document.mode === 'mind-note'" class="mind-note-layer">
          <div
            v-for="block in visibleTextBlocks"
            :key="block.id"
            :data-testid="`mind-note-block-${block.id}`"
            :class="['mind-note-block', {
              active: block.id === editorState.activeTextBlockId.value,
              'search-hit': searchHitBlockIds.has(block.id)
            }]"
            :style="textBlockStyle(block)"
            @pointerdown="startTextBlockDrag(block, $event)"
            @click.stop="openTextBlockInspector(block.id)"
          >
            <div
              :data-testid="`mind-note-handle-${block.id}`"
              class="mind-note-block-handle"
              :title="t('editor.dragTextBlock')"
              :aria-label="t('editor.dragTextBlock')"
              @pointerdown.stop="startTextBlockDrag(block, $event)"
            >
              <button
                type="button"
                class="mind-note-block-action"
                data-testid="mind-note-indent"
                :title="t('editor.indentTextBlock')"
                @pointerdown.stop
                @click.stop="editorState.indentMindNoteTextBlock(block.id)"
              >⇥</button>
              <button
                type="button"
                class="mind-note-block-action"
                data-testid="mind-note-outdent"
                :title="t('editor.outdentTextBlock')"
                @pointerdown.stop
                @click.stop="editorState.outdentMindNoteTextBlock(block.id)"
              >⇤</button>
              <button
                type="button"
                class="mind-note-block-remove"
                :title="t('editor.deleteTextBlock')"
                @pointerdown.stop
                @click.stop="editorState.removeMindNoteTextBlock(block.id)"
              >×</button>
            </div>
            <MindNoteBlockEditor
              v-if="block.id === editorState.activeTextBlockId.value"
              :key="`editor-${block.id}`"
              :html="block.html"
              @click.stop="openTextBlockInspector(block.id)"
              @update="payload => editorState.applyMindNoteBlockContent(block.id, payload)"
              @focus="editorState.beginMindNoteBlockEdit(block.id)"
              @blur="editorState.commitMindNoteBlockEdit(block.id)"
            />
            <div
              v-else
              :data-testid="`mind-note-preview-${block.id}`"
              class="mind-note-preview"
              v-html="block.html"
            ></div>
            <span
              class="mind-note-block-resize"
              :title="t('editor.resizeTextBlock')"
              @pointerdown.stop="startTextBlockResize(block, $event)"
            ></span>
          </div>
        </div>

      </div>
      </div>

      <aside class="palette-panel">
        <header class="layer-header">
          <h3>{{ paletteTitle }}</h3>
        </header>

        <transition name="inspector-drawer">
          <section
            v-if="inspectorOpen"
            ref="inspectorDrawerRef"
            class="inspector-drawer"
            data-testid="inspector-drawer"
            @pointerdown.stop
          >
            <header class="inspector-head">
              <div class="inspector-title-wrap">
                <strong data-testid="inspector-title">{{ inspectorTitle }}</strong>
                <span v-if="inspectorSubtitle" class="inspector-subtitle">{{ inspectorSubtitle }}</span>
              </div>
              <button type="button" class="inspector-close" data-testid="inspector-close" @click="closeInspector">×</button>
            </header>

            <div class="inspector-body" data-testid="inspector-body">
              <div v-if="activeTextBlock" class="property-panel" data-testid="inspector-block">
                <p v-if="String(activeTextBlock.text || '').trim()" class="inspector-subtitle">{{ activeTextBlock.text }}</p>
                <div class="inspector-multi-grid">
                  <button type="button" :title="t('editor.indentTextBlock')" @click="editorState.indentMindNoteTextBlock(activeTextBlock.id)">⇥ {{ t('editor.indentTextBlockShort') }}</button>
                  <button type="button" :title="t('editor.outdentTextBlock')" @click="editorState.outdentMindNoteTextBlock(activeTextBlock.id)">⇤ {{ t('editor.outdentTextBlockShort') }}</button>
                  <button type="button" class="danger" @click="editorState.removeMindNoteTextBlock(activeTextBlock.id)">{{ t('editor.menuDelete') }}</button>
                </div>
              </div>

              <div v-if="selectedNodeIds.length > 1" class="property-panel" data-testid="inspector-multi">
                <div class="inspector-multi-grid">
                  <button type="button" @click="alignNodes('left')">{{ t('editor.left') }}</button>
                  <button type="button" @click="alignNodes('center')">{{ t('editor.center') }}</button>
                  <button type="button" @click="alignNodes('right')">{{ t('editor.right') }}</button>
                  <button type="button" @click="alignNodes('top')">{{ t('editor.top') }}</button>
                  <button type="button" @click="alignNodes('middle')">{{ t('editor.middle') }}</button>
                  <button type="button" @click="alignNodes('bottom')">{{ t('editor.bottom') }}</button>
                  <button type="button" @click="distributeNodes('horizontal')">{{ t('editor.horizontal') }}</button>
                  <button type="button" @click="distributeNodes('vertical')">{{ t('editor.vertical') }}</button>
                  <button v-if="isTreeMode" type="button" data-testid="mindmap-add-summary" @click="addSummaryFromSelection">{{ t('mindmap.addSummary') }}</button>
                  <button type="button" data-testid="inspector-group" @click="groupSelection">{{ t('editor.group') }}</button>
                  <button type="button" data-testid="inspector-ungroup" @click="ungroupSelection">{{ t('editor.ungroup') }}</button>
                  <button type="button" class="danger" data-testid="inspector-delete" @click="editorState.removeNodes([...selectedNodeIds])">{{ t('editor.menuDelete') }}</button>
                </div>
              </div>

              <div v-if="selectedEdge && selectedNodeIds.length <= 1" class="property-panel edge-property-panel" data-testid="edge-property-panel">
                <h4>{{ t('editor.edgeLabelField') }}</h4>
                <input
                  class="edge-label-input"
                  type="text"
                  maxlength="100"
                  :value="selectedEdge.label || ''"
                  data-testid="edge-property-label-input"
                  :placeholder="t('editor.edgeLabelField')"
                  @change="editorState.updateEdgeLabel(selectedEdge.id, $event.target.value)"
                  @keydown.enter.prevent="$event.target.blur()"
                />
                <div class="edge-endpoints" data-testid="edge-endpoints">
                  <span><b>{{ t('editor.edgeFrom') }}</b>{{ selectedEdgeEndpoints?.from }}</span>
                  <span class="edge-endpoint-arrow" aria-hidden="true">→</span>
                  <span><b>{{ t('editor.edgeTo') }}</b>{{ selectedEdgeEndpoints?.to }}</span>
                </div>

                <h4>{{ t('editor.preset') }}</h4>
                <div class="property-actions">
                  <button
                    v-for="preset in edgePresets"
                    :key="preset.id"
                    type="button"
                    :class="['style-toggle', { active: isEdgePresetActive(preset) }]"
                    :data-testid="`edge-preset-${preset.id}`"
                    @click="editorState.updateActiveEdgeStyle(preset.style)"
                  >{{ preset.label }}</button>
                </div>

                <h4>{{ t('editor.route') }}</h4>
                <div class="property-actions">
                  <button type="button" :class="['style-toggle', { active: selectedEdgeStyle?.route === 'orthogonal' }]" data-testid="edge-route-orthogonal" @click="editorState.updateActiveEdgeStyle({ route: 'orthogonal' })">{{ t('editor.orthogonal') }}</button>
                  <button type="button" :class="['style-toggle', { active: selectedEdgeStyle?.route === 'straight' }]" data-testid="edge-route-straight" @click="editorState.updateActiveEdgeStyle({ route: 'straight' })">{{ t('editor.straight') }}</button>
                  <button type="button" :class="['style-toggle', { active: selectedEdgeStyle?.route === 'curve' }]" data-testid="edge-route-curve" @click="editorState.updateActiveEdgeStyle({ route: 'curve' })">{{ t('editor.curve') }}</button>
                </div>

                <h4>{{ t('editor.stroke') }}</h4>
                <div class="property-actions">
                  <button type="button" :class="['style-toggle', { active: selectedEdgeStyle?.stroke === 'solid' }]" data-testid="edge-stroke-solid" @click="editorState.updateActiveEdgeStyle({ stroke: 'solid' })">{{ t('editor.solid') }}</button>
                  <button type="button" :class="['style-toggle', { active: selectedEdgeStyle?.stroke === 'dashed' }]" data-testid="edge-stroke-dashed" @click="editorState.updateActiveEdgeStyle({ stroke: 'dashed' })">{{ t('editor.dashed') }}</button>
                  <button type="button" :class="['style-toggle', { active: selectedEdgeStyle?.stroke === 'dotted' }]" data-testid="edge-stroke-dotted" @click="editorState.updateActiveEdgeStyle({ stroke: 'dotted' })">{{ t('editor.dotted') }}</button>
                </div>

                <h4>{{ t('editor.arrow') }}</h4>
                <div class="property-actions">
                  <button type="button" :class="['style-toggle', { active: selectedEdgeStyle?.marker === 'arrow' }]" @click="editorState.updateActiveEdgeStyle({ marker: 'arrow' })">{{ t('editor.arrow') }}</button>
                  <button type="button" :class="['style-toggle', { active: selectedEdgeStyle?.marker === 'double-arrow' }]" @click="editorState.updateActiveEdgeStyle({ marker: 'double-arrow' })">{{ t('editor.doubleArrow') }}</button>
                  <button type="button" :class="['style-toggle', { active: selectedEdgeStyle?.marker === 'none' }]" @click="editorState.updateActiveEdgeStyle({ marker: 'none' })">{{ t('editor.noArrow') }}</button>
                  <button type="button" :class="['style-toggle', { active: selectedEdgeStyle?.marker === 'dot' }]" data-testid="edge-marker-dot" @click="editorState.updateActiveEdgeStyle({ marker: 'dot' })">{{ t('editor.markerDot') }}</button>
                  <button type="button" :class="['style-toggle', { active: selectedEdgeStyle?.marker === 'diamond' }]" data-testid="edge-marker-diamond" @click="editorState.updateActiveEdgeStyle({ marker: 'diamond' })">{{ t('editor.markerDiamond') }}</button>
                  <button type="button" :class="['style-toggle', { active: selectedEdgeStyle?.marker === 'square' }]" data-testid="edge-marker-square" @click="editorState.updateActiveEdgeStyle({ marker: 'square' })">{{ t('editor.markerSquare') }}</button>
                </div>

                <h4>{{ t('editor.edgeColor') }}</h4>
                <div class="edge-color-row">
                  <button
                    v-for="color in edgeColorOptions"
                    :key="color"
                    type="button"
                    class="color-swatch"
                    :class="{ active: (selectedEdgeStyle?.accent || '') === color }"
                    :style="{ background: resolveAccentPalette(color).stroke }"
                    :title="color"
                    :data-testid="`edge-color-${color}`"
                    @click="editorState.updateActiveEdgeStyle({ accent: color })"
                  ></button>
                </div>

                <div class="edge-property-actions">
                  <button type="button" data-testid="edge-edit-label" @click="openEdgeLabelEditor(selectedEdge)">{{ t('editor.menuEditLabel') }}</button>
                  <button type="button" class="danger" data-testid="edge-remove" @click="editorState.removeSelection()">{{ t('editor.removeEdge') }}</button>
                </div>
              </div>

              <div v-if="selectedNode && selectedNodeIds.length <= 1" class="property-panel inspector-node-actions" data-testid="inspector-node-actions">
                <button
                  v-if="!isTreeMode"
                  type="button"
                  data-testid="inspector-reset-node-size"
                  @click="resetSelectedNodeSize"
                >{{ t('editor.resetSize') }}</button>
                <button
                  type="button"
                  data-testid="inspector-node-lock"
                  @click="toggleNodeLock"
                >{{ selectedNode.locked ? t('editor.unlock') : t('editor.lock') }}</button>
                <div class="inspector-preset-row">
                  <button
                    v-for="preset in nodeThemePresets"
                    :key="preset.id"
                    type="button"
                    :class="['swatch-toggle', { active: selectedNodeStyle?.accent === preset.accent && selectedNodeStyle?.elevation === preset.elevation }]"
                    :data-testid="`inspector-node-preset-${preset.id}`"
                    @click="editorState.updateActiveNodeStyle({ accent: preset.accent, elevation: preset.elevation })"
                  >
                    <span class="swatch-dot" :style="{ background: resolveAccentPalette(preset.accent).stroke }"></span>
                    {{ preset.label }}
                  </button>
                </div>
              </div>

        <div v-if="isTreeMode && selectedNode && selectedNodeIds.length <= 1" class="property-panel mindmap-panel" data-testid="mindmap-node-panel">
          <div class="mindmap-branch-actions">
            <button
              type="button"
              class="style-toggle"
              data-testid="add-child-topic"
              :title="t('mindmap.addChildHint')"
              @click="addChildTopicFromPanel"
            >+ {{ t('mindmap.addChild') }}</button>
            <button
              type="button"
              class="style-toggle"
              data-testid="add-sibling-topic"
              :title="t('mindmap.addSiblingHint')"
              @click="addSiblingTopicFromPanel"
            >+ {{ t('mindmap.addSibling') }}</button>
          </div>

          <h4>{{ t('mindmap.sectionShape') }}</h4>
          <div class="mindmap-shape-grid">
            <button
              v-for="shape in topicShapeOptions"
              :key="shape.id"
              type="button"
              :class="['style-toggle', { active: (selectedNode.style?.shape || 'capsule') === shape.id }]"
              :data-testid="`mindmap-shape-${shape.id}`"
              @click="editorState.updateNodeStyle(selectedNode.id, { shape: shape.id })"
            >{{ shape.label }}</button>
          </div>
          <div class="mindmap-text-row">
            <button
              type="button"
              :class="['style-toggle', 'text-toggle', { active: Boolean(selectedNode.style?.bold) }]"
              data-testid="mindmap-bold"
              @click="editorState.updateNodeStyle(selectedNode.id, { bold: !selectedNode.style?.bold })"
            >B</button>
            <button
              type="button"
              :class="['style-toggle', 'text-toggle', 'italic', { active: Boolean(selectedNode.style?.italic) }]"
              data-testid="mindmap-italic"
              @click="editorState.updateNodeStyle(selectedNode.id, { italic: !selectedNode.style?.italic })"
            >I</button>
            <select
              class="mindmap-font-size"
              data-testid="mindmap-font-size"
              :value="selectedNode.style?.fontSize ? String(selectedNode.style.fontSize) : ''"
              @change="editorState.updateNodeStyle(selectedNode.id, { fontSize: $event.target.value ? Number($event.target.value) : null })"
            >
              <option value="">—</option>
              <option v-for="size in fontSizes" :key="size" :value="String(size)">{{ size }}</option>
            </select>
          </div>
          <div class="mindmap-color-row">
            <button
              v-for="color in textColorOptions"
              :key="color.id"
              type="button"
              :class="['color-swatch', { active: (selectedNode.style?.textColor || '') === color.value }]"
              :style="{ background: color.value || 'var(--foreground)' }"
              :title="color.label"
              :data-testid="`mindmap-text-color-${color.id}`"
              @click="editorState.updateNodeStyle(selectedNode.id, { textColor: color.value })"
            ></button>
          </div>

          <h4>{{ t('mindmap.sectionIcons') }}</h4>
          <div class="marker-grid">
            <button
              v-for="marker in markerOptions"
              :key="marker.id"
              type="button"
              :class="['marker-button', { active: selectedNodeMarkers.includes(marker.id) }]"
              :title="marker.label"
              :data-testid="`mindmap-marker-${marker.id}`"
              @click="toggleMarker(marker.id)"
            >{{ marker.emoji }}</button>
          </div>

          <h4>{{ t('mindmap.sectionStyle') }}</h4>
          <p class="property-caption">{{ t('mindmap.priority') }}</p>
          <div class="priority-grid">
            <button
              v-for="value in priorityValues"
              :key="value"
              type="button"
              :class="['priority-chip', { active: selectedNode.priority === value }]"
              :style="{ '--priority-color': priorityColors[value] }"
              :data-testid="`mindmap-priority-${value}`"
              @click="editorState.setNodePriority(value)"
            >{{ value }}</button>
            <button
              type="button"
              :class="['priority-chip', { active: !selectedNode.priority }]"
              data-testid="mindmap-priority-clear"
              @click="editorState.setNodePriority(null)"
            >{{ t('mindmap.priorityClear') }}</button>
          </div>
          <label class="property-text">
            {{ t('mindmap.progress') }}
            <select
              data-testid="mindmap-progress"
              :value="selectedNode.progress === null || selectedNode.progress === undefined ? '' : String(selectedNode.progress)"
              @change="editorState.setNodeProgress($event.target.value)"
            >
              <option value="">—</option>
              <option v-for="value in progressOptions" :key="value" :value="String(value)">{{ value }}%</option>
            </select>
          </label>

          <h4>{{ t('mindmap.sectionNote') }}</h4>
          <textarea
            class="mindmap-note-input"
            data-testid="mindmap-note"
            maxlength="2000"
            :value="selectedNode.note"
            :placeholder="t('mindmap.notePlaceholder')"
            @change="editorState.setNodeNote($event.target.value)"
          ></textarea>

          <h4>{{ t('mindmap.sectionLabels') }}</h4>
          <div class="mindmap-label-chips">
            <button
              v-for="label in selectedNodeLabels"
              :key="label"
              type="button"
              class="mindmap-label-chip"
              :data-testid="`mindmap-label-${label}`"
              @click="editorState.removeNodeLabel(label)"
            >#{{ label }} ×</button>
          </div>
          <input
            class="mindmap-label-input"
            type="text"
            maxlength="24"
            :placeholder="t('mindmap.labelPlaceholder')"
            data-testid="mindmap-label-input"
            @keydown.enter.prevent="submitNodeLabel"
          />

          <h4>{{ t('mindmap.sectionTask') }}</h4>
          <div class="mindmap-task-grid">
            <label class="mindmap-field">
              <span>{{ t('mindmap.taskStart') }}</span>
              <input
                type="date"
                :value="selectedNode.taskStart || ''"
                data-testid="mindmap-task-start"
                @change="editorState.setNodeTask({ start: $event.target.value })"
              />
            </label>
            <label class="mindmap-field">
              <span>{{ t('mindmap.taskDue') }}</span>
              <input
                type="date"
                :value="selectedNode.taskDue || ''"
                data-testid="mindmap-task-due"
                @change="editorState.setNodeTask({ due: $event.target.value })"
              />
            </label>
          </div>
          <input
            class="mindmap-label-input"
            type="text"
            maxlength="40"
            :value="selectedNode.assignee"
            :placeholder="t('mindmap.assigneePlaceholder')"
            data-testid="mindmap-assignee"
            @change="editorState.setNodeTask({ assignee: $event.target.value })"
          />

          <h4>{{ t('mindmap.sectionAttachments') }}</h4>
          <div v-if="(selectedNode.attachments || []).length" class="mindmap-attachment-list">
            <div
              v-for="item in selectedNode.attachments"
              :key="item.id"
              class="mindmap-attachment"
            >
              <a :href="item.url" target="_blank" rel="noopener noreferrer" :title="item.url" :download="item.url.startsWith('data:') ? item.name : undefined">📎 {{ item.name }}</a>
              <button
                type="button"
                :data-testid="`mindmap-remove-attachment-${item.id}`"
                @click.prevent="editorState.removeNodeAttachment(item.id)"
              >{{ t('mindmap.removeAttachment') }}</button>
            </div>
          </div>
          <div class="mindmap-attachment-form">
            <input
              v-model="attachmentDraft.name"
              type="text"
              maxlength="60"
              :placeholder="t('mindmap.attachmentName')"
              data-testid="mindmap-attachment-name"
            />
            <input
              v-model="attachmentDraft.url"
              type="url"
              maxlength="2048"
              placeholder="https://"
              data-testid="mindmap-attachment-url"
            />
            <button type="button" data-testid="mindmap-add-attachment" @click="submitAttachment">{{ t('mindmap.addAttachment') }}</button>
            <button type="button" class="mindmap-attachment-upload" data-testid="mindmap-upload-attachment" @click="triggerAttachmentUpload">{{ t('mindmap.uploadAttachment') }}</button>
            <input
              ref="attachmentFileInput"
              type="file"
              class="hidden-file-input"
              data-testid="mindmap-attachment-file"
              @change="onAttachmentFileChange"
            />
          </div>

          <h4>{{ t('mindmap.sectionRelation') }}</h4>
          <div class="mindmap-action-grid">
            <button
              type="button"
              :class="['style-toggle', { active: Boolean(relationSourceId) }]"
              data-testid="mindmap-add-relation"
              @click="startRelationship"
            >{{ t('mindmap.addRelation') }}</button>
            <button type="button" data-testid="mindmap-add-boundary" @click="editorState.addBoundary(selectedNode.id)">{{ t('mindmap.addBoundary') }}</button>
            <button type="button" :disabled="!hasBoundary(selectedNode.id)" data-testid="mindmap-remove-boundary" @click="editorState.removeBoundary(selectedNode.id)">{{ t('mindmap.removeBoundary') }}</button>
            <button type="button" :disabled="!summaryNodeIds.length" data-testid="mindmap-add-summary" @click="addSummaryFromSelection">{{ t('mindmap.addSummary') }}</button>
            <button
              type="button"
              :class="['style-toggle', { active: Boolean(focusNodeId) }]"
              data-testid="mindmap-focus"
              @click="toggleFocus"
            >{{ focusNodeId ? t('mindmap.focusOff') : t('mindmap.focusOn') }}</button>
            <button type="button" data-testid="mindmap-present" @click="startPresentation">{{ t('mindmap.present') }}</button>
          </div>
          <div v-if="hasBoundary(selectedNode.id)" class="mindmap-color-row" data-testid="boundary-color-row">
            <button
              v-for="color in boundaryColorOptions"
              :key="color"
              type="button"
              class="color-swatch"
              :class="{ active: currentBoundaryAccent === color }"
              :style="{ background: resolveBoundaryColor(color) }"
              :title="color"
              :data-testid="`boundary-color-${color}`"
              @click="editorState.setBoundaryAccent(color)"
            ></button>
          </div>
        </div>

        <div v-if="selectedSummary && selectedNodeIds.length <= 1" class="property-panel mindmap-panel" data-testid="mindmap-summary-panel">
          <h4>{{ t('mindmap.summary') }}</h4>
          <textarea
            class="mindmap-note-input"
            data-testid="mindmap-summary-text"
            maxlength="120"
            :value="selectedSummary.text"
            :placeholder="t('mindmap.summaryPlaceholder')"
            @change="editorState.updateSummaryText(selectedSummary.id, $event.target.value)"
          ></textarea>
          <div class="property-actions">
            <button type="button" data-testid="mindmap-remove-summary" @click="editorState.removeSummary(selectedSummary.id)">{{ t('mindmap.removeSummary') }}</button>
          </div>
          <div class="mindmap-color-row">
            <button
              v-for="color in boundaryColorOptions"
              :key="color"
              type="button"
              class="color-swatch"
              :class="{ active: selectedSummary.accent === color }"
              :style="{ background: resolveBoundaryColor(color) }"
              :title="color"
              :data-testid="`summary-color-${color}`"
              @click="editorState.setSummaryAccent(color)"
            ></button>
          </div>
        </div>

        <div v-if="isTreeMode && selectedEdge?.kind === 'relationship' && selectedNodeIds.length <= 1" class="property-panel mindmap-panel" data-testid="mindmap-relation-panel">
          <h4>{{ t('mindmap.addRelation') }}</h4>
          <div class="property-actions">
            <button type="button" data-testid="mindmap-remove-relation" @click="editorState.removeRelationship(selectedEdge.id)">{{ t('mindmap.removeRelation') }}</button>
          </div>
        </div>

        <div v-if="selectedNode && selectedNodeIds.length <= 1" class="property-panel" data-testid="property-panel">
          <h4>{{ t('editor.properties') }}</h4>
          <div class="property-grid">
            <label>X<input type="number" :value="Math.round(selectedNode.x)" @change="applyNodeField('x', $event)" /></label>
            <label>Y<input type="number" :value="Math.round(selectedNode.y)" @change="applyNodeField('y', $event)" /></label>
            <label>{{ t('editor.width') }}<input type="number" :value="Math.round(selectedNode.width)" @change="applyNodeField('width', $event)" /></label>
            <label>{{ t('editor.height') }}<input type="number" :value="Math.round(selectedNode.height)" @change="applyNodeField('height', $event)" /></label>
          </div>
          <label class="property-text">{{ t('editor.text') }}<input type="text" data-testid="node-text-input" :value="selectedNode.text" @change="applyNodeField('text', $event)" @keydown.tab.prevent="applyNodeTextFieldAndAddChild" @keydown.enter.prevent="$event.target.blur()" /></label>
          <label class="property-text">{{ t('editor.rotation') }}<input type="number" data-testid="rotation-input" :value="Math.round(selectedNode.rotation || 0)" @change="applyNodeField('rotation', $event)" /></label>
          <label class="property-text">{{ t('node.link') }}<input type="url" data-testid="node-link-input" :value="selectedNode.link" placeholder="https://" @change="applyNodeMetadata('link', $event)" /></label>
          <label class="property-text">{{ t('node.tooltip') }}<input type="text" data-testid="node-tooltip-input" :value="selectedNode.tooltip" maxlength="120" @change="applyNodeMetadata('tooltip', $event)" /></label>
          <label class="property-text">{{ t('node.image') }}<input type="text" data-testid="node-image-input" :value="selectedNode.image" placeholder="https://…" @change="applyNodeMetadata('image', $event)" /></label>
          <div class="property-actions">
            <button type="button" @click="triggerNodeImageUpload">{{ t('node.uploadImage') }}</button>
            <button type="button" :disabled="!selectedNode.image" @click="clearNodeImage">{{ t('node.clearImage') }}</button>
          </div>
          <input ref="nodeImageInputRef" type="file" accept="image/*" class="hidden-file-input" @change="onNodeImageFileChange" />
          <p class="property-meta">
            <span>{{ selectedNode.kind }}</span>
            <span v-if="selectedNode.containerId">{{ t('node.inContainer', { id: selectedNode.containerId }) }}</span>
          </p>
        </div>
            </div>
          </section>
        </transition>

        <div v-if="!isMindNote || !noteView" class="palette-shapes">
        <input
          v-model="paletteSearch"
          class="palette-search"
          type="search"
          :placeholder="t('editor.shapeSearch')"
          data-testid="palette-search"
        />

        <div v-for="group in paletteGroups" :key="group.name" class="palette-group">
          <p class="palette-group-title">{{ group.name }}</p>
          <div class="palette-list">
          <button
            v-for="item in group.items"
            :key="item.id"
            :data-testid="`palette-item-${item.id}`"
            :title="`${item.label}: ${item.description}`"
            class="palette-item"
            :style="resolvePaletteItemStyle(item)"
            type="button"
            draggable="true"
            @pointerdown="primePaletteDrag(item, $event)"
            @dragstart="startPaletteDrag(item, $event)"
            @dragend="endPaletteDrag"
          >
            <div class="palette-preview" :data-testid="`palette-preview-${item.id}`">
              <svg
                v-if="document.mode === 'flowchart'"
                class="palette-preview-svg"
                viewBox="0 0 120 72"
                aria-hidden="true"
              >
                <path
                  :d="getPaletteFlowchartPath(item.id)"
                  :fill="resolvePaletteAccentPalette(item).fillActive"
                  :stroke="resolvePaletteAccentPalette(item).stroke"
                  stroke-width="2.2"
                  stroke-linejoin="round"
                />
              </svg>
              <svg
                v-else
                class="palette-preview-svg"
                viewBox="0 0 120 72"
                aria-hidden="true"
              >
                <line
                  v-for="connector in getPaletteTreePreview(item.id).connectors"
                  :key="connector.key"
                  class="palette-preview-connector"
                  :x1="connector.x1"
                  :y1="connector.y1"
                  :x2="connector.x2"
                  :y2="connector.y2"
                  :stroke="resolvePaletteAccentPalette(item).stroke"
                />
                <rect
                  v-for="rect in getPaletteTreePreview(item.id).rects"
                  :key="rect.key"
                  :x="rect.x"
                  :y="rect.y"
                  :width="rect.width"
                  :height="rect.height"
                  :rx="rect.rx"
                  :fill="rect.fill || resolvePaletteAccentPalette(item).fillActive"
                  :stroke="rect.stroke || resolvePaletteAccentPalette(item).stroke"
                  stroke-width="2"
                />
                <line
                  v-for="noteLine in getPaletteTreePreview(item.id).noteLines"
                  :key="noteLine.key"
                  :x1="noteLine.x1"
                  :y1="noteLine.y1"
                  :x2="noteLine.x2"
                  :y2="noteLine.y2"
                  :stroke="resolvePaletteAccentPalette(item).text"
                  stroke-width="2.4"
                  stroke-linecap="round"
                />
                <circle
                  v-for="circle in getPaletteTreePreview(item.id).circles"
                  :key="circle.key"
                  :cx="circle.cx"
                  :cy="circle.cy"
                  :r="circle.r"
                  :fill="circle.fill || resolvePaletteAccentPalette(item).fillActive"
                  :stroke="circle.stroke || resolvePaletteAccentPalette(item).stroke"
                  stroke-width="2"
                />
              </svg>
            </div>
            <div class="palette-item-copy">
              <strong>{{ item.label }}</strong>
            </div>
          </button>
          </div>
        </div>

        <div v-if="!paletteGroups.length" class="palette-empty">
          {{ t('editor.noShapes') }}
        </div>
        </div>


        <div v-if="isTreeMode" class="property-panel mindmap-panel" data-testid="mindmap-layout-panel">
          <h4>{{ t('mindmap.sectionLayout') }}</h4>
          <div class="mindmap-layout-grid">
            <button
              v-for="layout in mindmapLayoutOptions"
              :key="layout.id"
              type="button"
              :class="['style-toggle', { active: mindmapLayout.direction === layout.id }]"
              :data-testid="`mindmap-layout-${layout.id}`"
              @click="editorState.setMindmapLayout(layout.id)"
            >{{ layout.label }}</button>
          </div>
          <div class="property-actions mindmap-theme-row">
            <button
              v-for="theme in mindmapThemeOptions"
              :key="theme.id"
              type="button"
              :class="['style-toggle', 'swatch-toggle', { active: mindmapLayout.theme === theme.id }]"
              :data-testid="`mindmap-theme-${theme.id}`"
              @click="editorState.applyMindmapTheme(theme.id)"
            >
              <span class="swatch-dot" :style="{ background: theme.swatch }"></span>
              {{ theme.label }}
            </button>
          </div>

          <h4>{{ t('mindmap.sectionStylePreset') }}</h4>
          <div class="mindmap-shape-grid">
            <button
              v-for="preset in stylePresetOptions"
              :key="preset.id"
              type="button"
              class="style-toggle"
              :data-testid="`mindmap-style-${preset.id}`"
              @click="editorState.applyMindmapStylePreset(preset.id)"
            >{{ preset.label }}</button>
          </div>

          <h4>{{ t('mindmap.sectionBranch') }}</h4>
          <div class="property-actions">
            <button
              v-for="branch in branchStyleOptions"
              :key="branch.id"
              type="button"
              :class="['style-toggle', { active: mindmapLayout.branchStyle === branch.id }]"
              :data-testid="`mindmap-branch-${branch.id}`"
              @click="editorState.setMindmapOption({ branchStyle: branch.id })"
            >{{ branch.label }}</button>
          </div>
          <div class="mindmap-action-grid">
            <button
              type="button"
              :class="['style-toggle', { active: mindmapLayout.rainbow }]"
              data-testid="mindmap-rainbow"
              @click="editorState.setMindmapOption({ rainbow: !mindmapLayout.rainbow })"
            >{{ t('mindmap.rainbow') }}</button>
            <button
              type="button"
              :class="['style-toggle', { active: mindmapLayout.numbering }]"
              data-testid="mindmap-numbering"
              @click="editorState.setMindmapOption({ numbering: !mindmapLayout.numbering })"
            >{{ t('mindmap.numbering') }}</button>
            <button type="button" data-testid="mindmap-collapse-all" @click="editorState.setAllCollapsed(true)">{{ t('mindmap.collapseAll') }}</button>
            <button type="button" data-testid="mindmap-expand-all" @click="editorState.setAllCollapsed(false)">{{ t('mindmap.expandAll') }}</button>
            <button type="button" data-testid="mindmap-add-floating" @click="editorState.addFloatingTopic()">{{ t('mindmap.addFloating') }}</button>
          </div>

        </div>

        <details class="panel-collapse" data-testid="canvas-panel-collapse">
          <summary>{{ t('editor.canvas') }}</summary>
          <div class="panel-collapse-body">
          <div class="page-panel" data-testid="page-panel">
            <div class="property-grid">
              <label>{{ t('editor.width') }}<input type="number" :value="canvasWidth" @change="applyPageSize('width', $event)" /></label>
              <label>{{ t('editor.height') }}<input type="number" :value="canvasHeight" @change="applyPageSize('height', $event)" /></label>
            </div>
            <div class="page-presets">
              <button type="button" @click="setPagePreset(1200, 720)">16:10</button>
              <button type="button" @click="setPagePreset(1123, 794)">{{ t('editor.a4Landscape') }}</button>
              <button type="button" @click="setPagePreset(794, 1123)">{{ t('editor.a4Portrait') }}</button>
            </div>
            <label class="page-toggle">
              <input type="checkbox" data-testid="grid-toggle" :checked="showGrid" @change="toggleGrid" />
              {{ t('editor.grid') }}
            </label>
          </div>
          </div>
        </details>




      </aside>
    </div>

    <div v-if="focusNodeId" class="focus-banner" data-testid="focus-banner">
      <span class="focus-banner-dot"></span>
      <span class="focus-banner-text">{{ t('mindmap.focusOn') }} · {{ t('mindmap.focusOff') }}（Esc）</span>
      <button type="button" class="focus-banner-exit" data-testid="focus-exit" @click="focusNodeId = null">{{ t('mindmap.focusOff') }}</button>
    </div>

    <div v-if="shortcutsOpen" class="shortcuts-overlay" data-testid="shortcuts-overlay" @click.self="shortcutsOpen = false">
      <div class="shortcuts-card" role="dialog" aria-modal="true" :aria-label="t('shortcuts.title')">
        <header class="shortcuts-header">
          <h3>{{ t('shortcuts.title') }}</h3>
          <button type="button" class="shortcuts-close" data-testid="shortcuts-close" @click="shortcutsOpen = false">{{ t('shortcuts.close') }}</button>
        </header>
        <div class="shortcuts-list">
          <div v-for="item in shortcutList" :key="item.key" class="shortcut-row">
            <span class="shortcut-keys">
              <kbd v-for="key in item.keys" :key="key">{{ key }}</kbd>
            </span>
            <span class="shortcut-label">{{ item.label }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="presentationActive" class="presentation-overlay" data-testid="presentation-overlay">
      <div class="presentation-card">
        <header class="presentation-header">
          <div class="presentation-status">
            <span class="presentation-progress">{{ presentationIndex + 1 }} / {{ presentationSlides.length }}</span>
            <span class="presentation-timer" data-testid="presentation-timer">{{ presentationElapsed }}</span>
          </div>
          <button type="button" class="presentation-close" data-testid="presentation-close" @click="endPresentation">{{ t('mindmap.presentExit') }}</button>
        </header>
        <div class="presentation-body">
          <p class="presentation-kicker">{{ t('mindmap.present') }}</p>
          <h2 class="presentation-title">{{ currentSlide?.text }}</h2>
          <div class="presentation-notes" data-testid="presentation-notes">
            <span class="presentation-notes-label">{{ t('mindmap.presenterNotes') }}</span>
            <textarea
              class="presentation-notes-input"
              data-testid="presentation-note-input"
              maxlength="2000"
              :value="currentSlide?.note || ''"
              :placeholder="t('mindmap.presenterNoNotes')"
              @change="updateSlideNote($event.target.value)"
            ></textarea>
          </div>
          <div v-if="currentSlide?.labels?.length" class="presentation-labels">
            <span v-for="label in currentSlide.labels" :key="label" class="presentation-label">#{{ label }}</span>
          </div>
          <p class="presentation-next-up">
            <span>{{ t('mindmap.presentNextUp') }}</span>
            <strong>{{ nextSlide?.text || '—' }}</strong>
          </p>
        </div>
        <footer class="presentation-footer">
          <button type="button" :disabled="presentationIndex === 0" data-testid="presentation-prev" @click="stepPresentation(-1)">{{ t('mindmap.presentPrev') }}</button>
          <div class="presentation-dots">
            <span
              v-for="(slide, index) in presentationSlides"
              :key="slide.id"
              :class="['presentation-dot', { active: index === presentationIndex }]"
            ></span>
          </div>
          <button type="button" :disabled="presentationIndex >= presentationSlides.length - 1" data-testid="presentation-next" @click="stepPresentation(1)">{{ t('mindmap.presentNext') }}</button>
        </footer>
      </div>
    </div>
  </section>
    <Teleport to="body">
          <div
            v-if="contextSubmenu"
            class="context-menu context-submenu context-menu-fixed"
            :style="{ left: contextSubmenu.x + 'px', top: contextSubmenu.y + 'px' }"
            role="menu"
            data-testid="context-submenu"
            @pointerdown.stop
            @contextmenu.prevent.stop
          >
            <template v-if="contextSubmenu.kind === 'export'">
              <p class="context-menu-caption">{{ t('editor.export') }}</p>
              <button type="button" role="menuitem" data-testid="ctx-export-png" @click="runContextExport('png')">PNG</button>
              <button type="button" role="menuitem" data-testid="ctx-export-jpg" @click="runContextExport('jpg')">JPG</button>
              <button v-if="document.mode !== 'markdown'" type="button" role="menuitem" data-testid="ctx-export-svg" @click="runContextExport('svg')">SVG</button>
              <button type="button" role="menuitem" data-testid="ctx-export-pdf" @click="runContextExport('pdf')">{{ t('editor.exportPdf') }}</button>
              <button v-if="isTreeMode" type="button" role="menuitem" data-testid="ctx-export-markdown" @click="runContextExport('markdown')">Markdown</button>
              <button v-if="isTreeMode" type="button" role="menuitem" data-testid="ctx-export-opml" @click="runContextExport('opml')">OPML</button>
              <button type="button" role="menuitem" :disabled="!canExportXMind" data-testid="ctx-export-xmind" @click="runContextExport('xmind')">XMind</button>
              <button type="button" role="menuitem" data-testid="ctx-export-drawio" @click="runContextExport('drawio')">draw.io</button>
            </template>
  
            <template v-else>
              <p class="context-menu-caption">{{ t('editor.import') }}</p>
              <button type="button" role="menuitem" data-testid="ctx-import-drawio" @click="runContextImport('drawio')">draw.io</button>
              <button type="button" role="menuitem" data-testid="ctx-import-markdown" @click="runContextImport('markdown')">Markdown</button>
              <button type="button" role="menuitem" data-testid="ctx-import-opml" @click="runContextImport('opml')">OPML</button>
              <button type="button" role="menuitem" data-testid="ctx-import-xmind" @click="runContextImport('xmind')">XMind</button>
            </template>
          </div>
    </Teleport>

</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { EditorContent } from '@tiptap/vue-3'
import { t } from '../i18n'
import { getFlowchartNodeSize } from '../editor/modes/flowchart'
import { collectSubtreeIds, buildMindmapTree, findRootNode } from '../editor/modes/mindmap'
import {
  BRANCH_STYLES,
  FONT_SIZES,
  MARKER_LIBRARY,
  MINDMAP_LAYOUTS,
  MINDMAP_STYLE_PRESETS,
  MINDMAP_THEMES,
  PRIORITY_COLORS,
  PRIORITY_VALUES,
  TEXT_COLORS,
  TOPIC_SHAPES,
  getMarkerEmoji,
  normalizeMindmapLayout,
  normalizeTopicShape
} from '../editor/model/mindmapMeta'
import { resolveTopicTextLayout } from '../editor/render/mindmapText'
import { buildEdgePath, routeEdge } from '../editor/render/edgeRouter'
import { resolveResizeCursor, rotatePointAround, rotateVector } from '../editor/render/geometry'
import MindNoteBlockEditor from './MindNoteBlockEditor.vue'
import { renderHtmlElementToDataUrl } from '../editor/exporters/imageExporter'
import { getVisibleTextBlocks, hasMindNoteBlockContent, NOTE_BLOCK_WIDTH } from '../editor/render/textBlockLayer'
import { flattenNodeBlocks } from '../editor/render/noteBlockOps'
import { findEqualSpacing, findContainerSnap, snapResizeRect } from '../editor/render/alignmentSnap'
import { useMarkdownFormatTools } from '../editor/render/useMarkdownFormatTools'
import { useTextOverlay } from '../editor/render/useTextOverlay'

const CANVAS_VIEW_WIDTH = 1200
const CANVAS_VIEW_HEIGHT = 720

const canvasWidth = computed(() => document.value.content.page?.width || CANVAS_VIEW_WIDTH)
const canvasHeight = computed(() => document.value.content.page?.height || CANVAS_VIEW_HEIGHT)
const DROP_GRID = 20

const ACCENT_PALETTES = {
  teal: { fill: '#ffffff', fillActive: '#f0fdfa', stroke: '#0f766e', strokeActive: '#0b5f59', text: '#134e4a', glow: 'transparent', edge: '#0f766e' },
  blue: { fill: '#ffffff', fillActive: '#eff6ff', stroke: '#2563eb', strokeActive: '#1d4ed8', text: '#1e3a8a', glow: 'transparent', edge: '#2563eb' },
  amber: { fill: '#ffffff', fillActive: '#fffbeb', stroke: '#b45309', strokeActive: '#92400e', text: '#78350f', glow: 'transparent', edge: '#b45309' },
  rose: { fill: '#ffffff', fillActive: '#fff1f2', stroke: '#be123c', strokeActive: '#9f1239', text: '#881337', glow: 'transparent', edge: '#be123c' },
  violet: { fill: '#ffffff', fillActive: '#f5f3ff', stroke: '#6d28d9', strokeActive: '#5b21b6', text: '#4c1d95', glow: 'transparent', edge: '#6d28d9' },
  emerald: { fill: '#ffffff', fillActive: '#ecfdf5', stroke: '#047857', strokeActive: '#065f46', text: '#065f46', glow: 'transparent', edge: '#047857' },
  sky: { fill: '#ffffff', fillActive: '#f0f9ff', stroke: '#0369a1', strokeActive: '#075985', text: '#0c4a6e', glow: 'transparent', edge: '#0369a1' },
  slate: { fill: '#ffffff', fillActive: '#f4f4f5', stroke: '#3f3f46', strokeActive: '#18181b', text: '#18181b', glow: 'transparent', edge: '#3f3f46' }
}

const props = defineProps({
  editorState: {
    type: Object,
    required: true
  },
  currentUser: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['back'])

const svgRef = ref(null)
const canvasCardRef = ref(null)
let canvasResizeObserver = null
const nodeTextInputRef = ref(null)
let textOverlayOpenedAt = 0
let textOverlayBlurTimer = 0
let overlayDragPointer = null
const previewRef = ref(null)
const dragState = ref(null)
const dragGuides = ref([])
const guidesDraft = ref(null)
const guides = computed(() => guidesDraft.value ?? document.value.content.guides ?? [])
const showGrid = computed(() => document.value.content.showGrid !== false)
const rulerTicks = ref({ x: [], y: [] })
const rulerHRef = ref(null)
const rulerVRef = ref(null)

const RULER_MIN_GAP = 48

function refreshRulers() {
  const svg = svgRef.value
  if (!svg) {
    return
  }

  const rect = svg.getBoundingClientRect()
  if (!rect.width || !rect.height) {
    return
  }

  const viewport = document.value.content.viewport
  const scale = Math.min(rect.width / canvasWidth.value, rect.height / canvasHeight.value) || 1
  const offsetX = (rect.width - canvasWidth.value * scale) / 2
  const offsetY = (rect.height - canvasHeight.value * scale) / 2
  const unitPx = scale * viewport.zoom

  let step = 100
  while (step * unitPx < RULER_MIN_GAP) {
    step *= 2
  }

  const rulerH = rulerHRef.value
  const rulerV = rulerVRef.value
  const baseX = rulerH ? rect.left - rulerH.getBoundingClientRect().left : 0
  const baseY = rulerV ? rect.top - rulerV.getBoundingClientRect().top : 0
  const sizeX = rulerH ? rulerH.clientWidth : rect.width
  const sizeY = rulerV ? rulerV.clientHeight : rect.height

  const build = (sizeInPx, base, offset) => {
    const ticks = []
    const startUnit = Math.floor((0 - offset) / unitPx / step) * step
    for (let unit = startUnit; unit * unitPx + offset + base <= sizeInPx; unit += step) {
      const pos = Math.round(unit * unitPx + offset + base)
      if (pos < 0) {
        continue
      }
      ticks.push({ pos, label: String(Math.round(unit)) })
    }
    return ticks
  }

  rulerTicks.value = {
    x: build(sizeX, baseX, offsetX + viewport.x * scale),
    y: build(sizeY, baseY, offsetY + viewport.y * scale)
  }
}

function startGuideFromRuler(axis, event) {
  event.preventDefault()
  const svg = svgRef.value
  if (!svg) {
    return
  }

  const point = resolveClientPoint(event.clientX, event.clientY)
  const pos = axis === 'vertical' ? point.x : point.y
  guidesDraft.value = [...guides.value, { axis, pos }]
  const index = guidesDraft.value.length - 1
  startGuideMove(index, event)
}

function startGuideMove(index, event) {
  const guide = guides.value[index]
  if (!guide) {
    return
  }

  event.preventDefault()
  event.stopPropagation()

  const move = moveEvent => {
    const point = resolveClientPoint(moveEvent.clientX, moveEvent.clientY)
    const pos = guide.axis === 'vertical' ? point.x : point.y
    const base = guidesDraft.value || guides.value
    guidesDraft.value = base.map((item, itemIndex) => (
      itemIndex === index ? { ...item, pos: Math.round(pos) } : item
    ))
  }

  const up = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', up)
    const draft = guidesDraft.value || guides.value
    const current = draft[index]
    // 拖出画布范围即删除
    const limit = current?.axis === 'vertical' ? canvasWidth.value : canvasHeight.value
    const next = current && (current.pos < 0 || current.pos > limit)
      ? draft.filter((_, itemIndex) => itemIndex !== index)
      : draft

    guidesDraft.value = null
    props.editorState.setGuides(next)
    refreshRulers()
  }

  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', up)
}

function removeGuide(index) {
  props.editorState.setGuides(guides.value.filter((_, itemIndex) => itemIndex !== index))
}

function fitToWindow() {
  props.editorState.setViewport({ x: 0, y: 0, zoom: 1 })
  nextTick(refreshRulers)
}

const resizeState = ref(null)
const MIN_NODE_SIZE = 40

const resizeHandles = computed(() => {
  if (isTreeMode.value) {
    return []
  }
  const node = selectedNode.value
  if (!node || selectedNodeIds.value.length > 1) {
    return []
  }
  if (layerMap.value.get(node.layerId)?.locked || node.locked) {
    return []
  }

  const { x, y, width, height } = node
  const cx = x + width / 2
  const cy = y + height / 2
  const rotation = Number(node.rotation) || 0
  const center = { x: cx, y: cy }
  return [
    { dir: 'nw', x, y },
    { dir: 'n', x: cx, y },
    { dir: 'ne', x: x + width, y },
    { dir: 'e', x: x + width, y: cy },
    { dir: 'se', x: x + width, y: y + height },
    { dir: 's', x: cx, y: y + height },
    { dir: 'sw', x, y: y + height },
    { dir: 'w', x, y: cy }
  ].map(handle => {
    const point = rotatePointAround(handle, center, rotation)
    return {
      ...handle,
      x: point.x,
      y: point.y,
      rotation,
      cursor: resolveResizeCursor(handle.dir, rotation)
    }
  })
})

const rotationHandle = computed(() => {
  if (isTreeMode.value) {
    return null
  }
  const node = selectedNode.value
  if (!node || selectedNodeIds.value.length > 1) {
    return null
  }
  if (layerMap.value.get(node.layerId)?.locked || node.locked) {
    return null
  }
  const center = { x: node.x + node.width / 2, y: node.y + node.height / 2 }
  const rotation = Number(node.rotation) || 0
  const anchor = rotatePointAround({ x: center.x, y: node.y }, center, rotation)
  const handle = rotatePointAround({ x: center.x, y: node.y - 38 }, center, rotation)
  return {
    x: handle.x,
    y: handle.y,
    anchorX: anchor.x,
    anchorY: anchor.y
  }
})

function startRotate(node, event) {
  if (!node || node.locked || layerMap.value.get(node.layerId)?.locked) {
    return
  }

  event.preventDefault()
  event.stopPropagation()
  props.editorState.selectNode(node.id)
  props.editorState.beginNodeResize(node.id)

  const rect = { x: node.x, y: node.y, width: node.width, height: node.height }
  const center = { x: node.x + node.width / 2, y: node.y + node.height / 2 }
  const startRotation = Number(node.rotation) || 0
  const startPoint = resolveClientPoint(event.clientX, event.clientY)
  const startAngle = Math.atan2(startPoint.y - center.y, startPoint.x - center.x)

  const move = moveEvent => {
    const point = resolveClientPoint(moveEvent.clientX, moveEvent.clientY)
    const angle = Math.atan2(point.y - center.y, point.x - center.x)
    const delta = ((angle - startAngle) * 180) / Math.PI
    props.editorState.previewNodeResize({
      ...rect,
      rotation: startRotation + delta
    })
  }

  const up = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', up)
    props.editorState.endNodeResize()
  }

  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', up)
}

function selectedNodeList() {
  return selectedNodeIds.value
    .map(id => activeNodes.value.find(node => node.id === id))
    .filter(Boolean)
}function alignNodes(mode) {
  const nodes = selectedNodeList()
  if (nodes.length < 2) {
    return
  }

  const left = Math.min(...nodes.map(node => node.x))
  const right = Math.max(...nodes.map(node => node.x + node.width))
  const top = Math.min(...nodes.map(node => node.y))
  const bottom = Math.max(...nodes.map(node => node.y + node.height))
  const centerX = (left + right) / 2
  const centerY = (top + bottom) / 2

  const entries = nodes.map(node => {
    let x = node.x
    let y = node.y
    if (mode === 'left') x = left
    if (mode === 'center') x = centerX - node.width / 2
    if (mode === 'right') x = right - node.width
    if (mode === 'top') y = top
    if (mode === 'middle') y = centerY - node.height / 2
    if (mode === 'bottom') y = bottom - node.height
    return { id: node.id, x: Math.round(x), y: Math.round(y) }
  })

  props.editorState.setNodePositions(entries)
}

function distributeNodes(axis) {
  const nodes = selectedNodeList()
  if (nodes.length < 3) {
    return
  }

  const horizontal = axis === 'horizontal'
  const sorted = [...nodes].sort((a, b) => (horizontal ? a.x - b.x : a.y - b.y))
  const first = sorted[0]
  const last = sorted[sorted.length - 1]

  const startEdge = horizontal ? first.x : first.y
  const endEdge = horizontal ? last.x + last.width : last.y + last.height
  const totalSize = sorted.reduce((sum, node) => sum + (horizontal ? node.width : node.height), 0)
  const gap = (endEdge - startEdge - totalSize) / (sorted.length - 1)

  let cursor = startEdge
  const entries = sorted.map(node => {
    const entry = { id: node.id, x: node.x, y: node.y }
    if (horizontal) {
      entry.x = Math.round(cursor)
    } else {
      entry.y = Math.round(cursor)
    }
    cursor += (horizontal ? node.width : node.height) + gap
    return entry
  })

  props.editorState.setNodePositions(entries)
}

const drawioInputRef = ref(null)
const nodeImageInputRef = ref(null)
const renamingPageId = ref(null)
const pageRenameDraft = ref('')
const pageRenameInput = ref(null)

function triggerNodeImageUpload() {
  nodeImageInputRef.value?.click()
}

function onNodeImageFileChange(event) {
  const file = event.target?.files?.[0]
  const node = selectedNode.value
  if (!file || !node) {
    return
  }
  if (!file.type.startsWith('image/')) {
    showEditorToast(t('node.imageTypeError'), 'error', 2400)
    event.target.value = ''
    return
  }
  if (file.size > 2 * 1024 * 1024) {
    showEditorToast(t('node.imageSizeError'), 'error', 2600)
    event.target.value = ''
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    props.editorState.updateNodeMetadata(node.id, { image: String(reader.result || '') })
  }
  reader.onerror = () => {
    showEditorToast(t('node.imageReadError'), 'error', 2400)
  }
  reader.readAsDataURL(file)
  event.target.value = ''
}

function clearNodeImage() {
  const node = selectedNode.value
  if (node) {
    props.editorState.updateNodeMetadata(node.id, { image: '' })
  }
}

function applyNodeMetadata(field, event) {
  const node = selectedNode.value
  if (!node) {
    return
  }
  props.editorState.updateNodeMetadata(node.id, { [field]: event.target.value })
}

function startPageRename(page) {
  if (!page) {
    return
  }
  renamingPageId.value = page.id
  pageRenameDraft.value = page.name
  requestAnimationFrame(() => {
    const input = Array.isArray(pageRenameInput.value) ? pageRenameInput.value[0] : pageRenameInput.value
    input?.focus()
    input?.select()
  })
}

function commitPageRename() {
  if (!renamingPageId.value) {
    return
  }
  const pageId = renamingPageId.value
  const name = String(pageRenameDraft.value || '').trim()
  renamingPageId.value = null
  pageRenameDraft.value = ''
  if (name) {
    props.editorState.renamePage(pageId, name)
  }
}

function cancelPageRename() {
  renamingPageId.value = null
  pageRenameDraft.value = ''
}

function triggerDrawioImport() {
  drawioInputRef.value?.click()
}

async function onDrawioFileChange(event) {
  const file = event.target?.files?.[0]
  if (!file) {
    return
  }
  if (file.size > 20 * 1024 * 1024) {
    showEditorToast(t('editor.importTooLarge'), 'error', 2800)
    event.target.value = ''
    return
  }
  const text = await file.text()
  props.editorState.importDrawio(text)
  event.target.value = ''
}

function toggleGrid(event) {
  props.editorState.setGridVisible(Boolean(event.target.checked))
}

function applyPageSize(field, event) {
  const value = Number(event.target.value)
  if (!Number.isFinite(value)) {
    event.target.value = field === 'width' ? canvasWidth.value : canvasHeight.value
    return
  }
  const nextWidth = field === 'width' ? value : canvasWidth.value
  const nextHeight = field === 'height' ? value : canvasHeight.value
  props.editorState.setPageSize(nextWidth, nextHeight)
  nextTick(refreshRulers)
}

function setPagePreset(width, height) {
  props.editorState.setPageSize(width, height)
  nextTick(refreshRulers)
}

function applyNodeField(field, event) {
  const node = selectedNode.value
  if (!node) {
    return
  }
  const raw = event.target.value
  if (field === 'text') {
    props.editorState.updateNodeRect(node.id, { text: raw })
    return
  }
  const value = Number(raw)
  if (!Number.isFinite(value)) {
    event.target.value = Math.round(node[field])
    return
  }
  props.editorState.updateNodeRect(node.id, { [field]: value })
}

function resetSelectedNodeSize() {
  const node = selectedNode.value
  if (!node || isTreeMode.value) {
    return
  }
  const size = getFlowchartNodeSize(node.kind)
  props.editorState.updateNodeRect(node.id, {
    width: size.width,
    height: size.height
  })
}

// 图标标记：优先作用于「当前选中的主题」；多选且当前主题在选区里时批量打标
function toggleMarker(markerId) {
  const activeId = props.editorState.activeNodeId.value
  const selected = selectedNodeIds.value

  const ids = activeId
    ? (selected.length > 1 && selected.includes(activeId) ? [...selected] : [activeId])
    : [...selected]

  if (!ids.length) {
    showEditorToast(t('mindmap.markerNeedSelection'), 'error', 1800)
    return
  }

  props.editorState.toggleNodeMarkers(ids, markerId)
}

// 直接点画布上的角标即可移除对应图标
function removeBadge(badge, node) {
  if (!badge?.markerId) {
    return
  }
  props.editorState.toggleNodeMarkers([node.id], badge.markerId)
}

function groupSelection() {
  const ids = selectedNodeIds.value.length ? selectedNodeIds.value : []
  if (ids.length > 1) {
    props.editorState.groupNodes(ids)
  }
}

function ungroupSelection() {
  const ids = selectedNodeIds.value.length ? selectedNodeIds.value : []
  if (ids.length) {
    props.editorState.ungroupNodes(ids)
  }
}

function toggleNodeLock() {
  const node = selectedNode.value
  if (!node) {
    return
  }
  props.editorState.setNodeLocked(node.id, !node.locked)
}

// ── 右键菜单 ─────────────────────────────────────────────────────────
const contextMenuRef = ref(null)
const contextSubmenu = ref(null)
const CONTEXT_MENU_WIDTH = 220
const CONTEXT_MENU_MAX_HEIGHT = 380

function handleMarkdownPointerDownCapture(event) {
  closeMarkdownPopovers()
  if (event.button === 2) {
    markdownPanel.rememberSelection()
  }
}

function openMarkdownContextMenu(event) {
  openContextMenu(event, { kind: 'markdown' })
}

function openContextMenu(event, payload = {}) {
  const kind = payload.kind || 'canvas'

  if (kind === 'node' && payload.nodeId) {
    // 右键落在已选中的节点上 -> 保留多选；落在别的节点上 -> 先选中它
    if (!selectedNodeIdSet.value.has(payload.nodeId)) {
      setSelectedNodes([payload.nodeId])
    }
  } else if (kind === 'edge' && payload.edgeId) {
    setSelectedNodes([])
    props.editorState.selectEdge(payload.edgeId)
  }

  const x = Math.max(8, Math.min(event.clientX, window.innerWidth - CONTEXT_MENU_WIDTH - 8))
  const menuMaxHeight = kind === 'markdown' ? window.innerHeight - 16 : CONTEXT_MENU_MAX_HEIGHT
  const y = Math.max(8, Math.min(event.clientY, window.innerHeight - menuMaxHeight - 8))
  contextMenu.value = {
    x,
    y,
    kind,
    nodeId: payload.nodeId || null,
    edgeId: payload.edgeId || null
  }

  // 菜单高度取决于条目数量，渲染后再按实际高度贴边修正
  nextTick(() => {
    const menuElement = contextMenuRef.value
    if (!menuElement || !contextMenu.value) {
      return
    }
    const rect = menuElement.getBoundingClientRect()
    const maxX = window.innerWidth - rect.width - 8
    const maxY = window.innerHeight - rect.height - 8
    if (rect.right > window.innerWidth - 8 || rect.bottom > window.innerHeight - 8) {
      contextMenu.value = {
        ...contextMenu.value,
        x: Math.max(8, Math.min(contextMenu.value.x, maxX)),
        y: Math.max(8, Math.min(contextMenu.value.y, maxY))
      }
    }
  })
}

function closeContextMenu() {
  contextMenu.value = null
  contextSubmenu.value = null
}

function handleContextMenuOutsidePointerDown(event) {
  if (!contextMenu.value && !contextSubmenu.value) {
    return
  }
  const target = event.target
  if (target instanceof Element && target.closest('.context-menu, .context-submenu')) {
    return
  }
  closeContextMenu()
}

function toggleLockForSelection() {
  const ids = selectedNodeIds.value.length
    ? [...selectedNodeIds.value]
    : (contextMenu.value?.nodeId ? [contextMenu.value.nodeId] : [])
  const nodes = document.value.content.nodes.filter(node => ids.includes(node.id))
  if (!nodes.length) {
    return
  }
  const nextLocked = !nodes.every(node => node.locked)
  nodes.forEach(node => props.editorState.setNodeLocked(node.id, nextLocked))
}

function runContextExport(format) {
  contextSubmenu.value = null
  runExport(format)
}

function runContextImport(kind) {
  contextSubmenu.value = null
  runImport(kind)
}

function runContextAction(action) {
  const menu = contextMenu.value
  if (!menu) {
    return
  }

  const ids = selectedNodeIds.value.length
    ? [...selectedNodeIds.value]
    : (menu.nodeId ? [menu.nodeId] : [])

  if (action === 'exportMenu' || action === 'importMenu') {
    const kind = action === 'exportMenu' ? 'export' : 'import'
    const x = Math.min(menu.x + 12, Math.max(8, window.innerWidth - 320))
    const y = Math.min(menu.y, Math.max(8, window.innerHeight - 360))
    closeContextMenu()
    contextSubmenu.value = { kind, x, y }
    return
  }

  closeContextMenu()

  switch (action) {
    case 'copy':
      props.editorState.copyNodes(ids)
      break
    case 'cut':
      if (props.editorState.copyNodes(ids)) {
        props.editorState.removeNodes(ids)
        setSelectedNodes([])
      }
      break
    case 'paste': {
      const pasted = props.editorState.pasteNodes()
      if (pasted.length) {
        setSelectedNodes(pasted)
      }
      break
    }
    case 'duplicate':
      if (props.editorState.copyNodes(ids)) {
        const pasted = props.editorState.pasteNodes()
        if (pasted.length) {
          setSelectedNodes(pasted)
        }
      }
      break
    case 'delete':
      if (menu.kind === 'edge') {
        props.editorState.removeSelection()
      } else {
        props.editorState.removeNodes(ids)
        setSelectedNodes([])
      }
      break
    case 'group':
      groupSelection()
      break
    case 'ungroup':
      ungroupSelection()
      break
    case 'lock':
      toggleLockForSelection()
      break
    case 'resetSize':
      resetSelectedNodeSize()
      break
    case 'front':
      props.editorState.setNodesZOrder(ids, true)
      break
    case 'back':
      props.editorState.setNodesZOrder(ids, false)
      break
    case 'editText':
      if (menu.nodeId) {
        openTextOverlay(menu.nodeId)
      }
      break
    case 'editEdgeLabel': {
      const edge = document.value.content.edges.find(item => item.id === menu.edgeId)
      if (edge) {
        openEdgeLabelEditor(edge)
      }
      break
    }
    case 'routeOrthogonal':
      props.editorState.updateEdgeStyle(menu.edgeId, { route: 'orthogonal' })
      break
    case 'routeStraight':
      props.editorState.updateEdgeStyle(menu.edgeId, { route: 'straight' })
      break
    case 'routeCurve':
      props.editorState.updateEdgeStyle(menu.edgeId, { route: 'curve' })
      break
    case 'markerArrow':
      props.editorState.updateEdgeStyle(menu.edgeId, { marker: 'arrow' })
      break
    case 'markerDouble':
      props.editorState.updateEdgeStyle(menu.edgeId, { marker: 'double-arrow' })
      break
    case 'markerNone':
      props.editorState.updateEdgeStyle(menu.edgeId, { marker: 'none' })
      break
    case 'selectAll':
      setSelectedNodes(visibleNodes.value.map(node => node.id))
      break
    case 'newNode':
      props.editorState.addNode('process')
      break
    case 'insertProcess':
      props.editorState.addNode('process')
      break
    case 'insertDecision':
      props.editorState.addNode('decision')
      break
    case 'insertTextBlock':
      props.editorState.addMindNoteTextBlock()
      break
    case 'insertChildTopic':
      props.editorState.addMindmapChildBranch()
      break
    case 'insertSiblingTopic':
      props.editorState.addMindmapSiblingBranch()
      break
    case 'shortcuts':
      shortcutsOpen.value = true
      break
    case 'mdBold':
      markdownPanel.toggleBold()
      break
    case 'mdItalic':
      markdownPanel.toggleItalic()
      break
    case 'mdUnderline':
      markdownPanel.toggleUnderline()
      break
    case 'mdStrike':
      markdownPanel.toggleStrike()
      break
    case 'mdInlineCode':
      markdownPanel.toggleInlineCode()
      break
    case 'mdH1':
      markdownPanel.toggleHeading(1)
      break
    case 'mdH2':
      markdownPanel.toggleHeading(2)
      break
    case 'mdH3':
      markdownPanel.toggleHeading(3)
      break
    case 'mdBulletList':
      markdownPanel.toggleBulletList()
      break
    case 'mdOrderedList':
      markdownPanel.toggleOrderedList()
      break
    case 'mdTaskList':
      markdownPanel.toggleTaskList()
      break
    case 'mdBlockquote':
      markdownPanel.toggleBlockquote()
      break
    case 'mdCodeBlock':
      toggleMarkdownCodeBlock()
      break
    case 'mdTable':
      markdownPanel.insertTable()
      break
    case 'mdHr':
      markdownPanel.insertHorizontalRule()
      break
    case 'mdLink':
      markdownLinkEditorOpen.value = true
      nextTick(() => markdownLinkInputRef.value?.focus())
      break
    case 'save':
      void props.editorState.saveDocument()
      break
    case 'history':
      void openRevisionPanel()
      break
    case 'print':
      handlePrintDocument({ autoPrint: true })
      break
    case 'fit':
      fitToWindow()
      break
    case 'grid':
      props.editorState.setGridVisible(!showGrid.value)
      break
    case 'clearGuides':
      props.editorState.setGuides([])
      break
    default:
      break
  }
}

function startResize(node, direction, event) {
  if (node.locked || layerMap.value.get(node.layerId)?.locked) {
    return
  }

  event.preventDefault()
  event.stopPropagation()

  props.editorState.selectNode(node.id)
  props.editorState.beginNodeResize(node.id)

  const startRect = { x: node.x, y: node.y, width: node.width, height: node.height }
  resizeState.value = {
    nodeId: node.id,
    direction,
    rotation: Number(node.rotation) || 0,
    startPoint: resolveClientPoint(event.clientX, event.clientY),
    startRect,
    center: {
      x: startRect.x + startRect.width / 2,
      y: startRect.y + startRect.height / 2
    },
    ratio: startRect.width / Math.max(startRect.height, 1)
  }

  window.addEventListener('pointermove', onResizePointerMove)
  window.addEventListener('pointerup', endResize)
  window.addEventListener('pointercancel', endResize)
}

function onResizePointerMove(event) {
  const state = resizeState.value
  if (!state) {
    return
  }

  const point = resolveClientPoint(event.clientX, event.clientY)
  const startDelta = rotateVector(
    state.startPoint.x - state.center.x,
    state.startPoint.y - state.center.y,
    -state.rotation
  )
  const currentDelta = rotateVector(
    point.x - state.center.x,
    point.y - state.center.y,
    -state.rotation
  )
  const dx = currentDelta.x - startDelta.x
  const dy = currentDelta.y - startDelta.y
  let width = state.startRect.width
  let height = state.startRect.height

  if (state.direction.includes('e')) {
    width += dx
  }
  if (state.direction.includes('w')) {
    width -= dx
  }
  if (state.direction.includes('s')) {
    height += dy
  }
  if (state.direction.includes('n')) {
    height -= dy
  }

  width = Math.max(MIN_NODE_SIZE, width)
  height = Math.max(MIN_NODE_SIZE, height)

  if (event.shiftKey && state.direction.length === 2) {
    height = Math.max(MIN_NODE_SIZE, Math.round(width / Math.max(state.ratio, 0.01)))
  }

  const oppositeLocal = {
    x: state.direction.includes('e')
      ? -state.startRect.width / 2
      : (state.direction.includes('w') ? state.startRect.width / 2 : 0),
    y: state.direction.includes('s')
      ? -state.startRect.height / 2
      : (state.direction.includes('n') ? state.startRect.height / 2 : 0)
  }
  const oppositeWorld = {
    x: state.center.x + rotateVector(oppositeLocal.x, oppositeLocal.y, state.rotation).x,
    y: state.center.y + rotateVector(oppositeLocal.x, oppositeLocal.y, state.rotation).y
  }
  const nextOppositeLocal = {
    x: state.direction.includes('e')
      ? -width / 2
      : (state.direction.includes('w') ? width / 2 : 0),
    y: state.direction.includes('s')
      ? -height / 2
      : (state.direction.includes('n') ? height / 2 : 0)
  }
  const nextOppositeRotated = rotateVector(nextOppositeLocal.x, nextOppositeLocal.y, state.rotation)
  const center = {
    x: oppositeWorld.x - nextOppositeRotated.x,
    y: oppositeWorld.y - nextOppositeRotated.y
  }

  const resizedRect = applyResizeSnap(
    {
      x: center.x - width / 2,
      y: center.y - height / 2,
      width,
      height
    },
    state.direction,
    state.rotation,
    state.nodeId
  )

  props.editorState.previewNodeResize(resizedRect)
}

function endResize() {
  window.removeEventListener('pointermove', onResizePointerMove)
  window.removeEventListener('pointerup', endResize)
  window.removeEventListener('pointercancel', endResize)
  resizeState.value = null
  dragGuides.value = []
  props.editorState.endNodeResize()
}
const textBlockDragState = ref(null)
const noteResizeState = ref(null)
const panState = ref(null)
const selectionState = ref(null)
const selectedNodeIds = ref([])
const spacePressed = ref(false)
const altPressed = ref(false)
const suppressCanvasClick = ref(false)
const suppressNodeClick = ref(false)
const treeClickState = ref({ nodeId: null, timestamp: 0 })
const paletteDragItem = ref(null)
const palettePointerState = ref(null)
const paletteDropHandled = ref(false)
const canvasDragInside = ref(false)
const lastCanvasDragPoint = ref(null)
const edgeLabelEditor = ref(null)
const hoveredNodeId = ref(null)
const hoveredEdgeId = ref(null)
const editorToast = ref({ visible: false, message: '', tone: 'success' })
// 右键菜单：{ x, y, kind: 'node' | 'edge' | 'canvas', nodeId, edgeId }
const contextMenu = ref(null)

// ── 属性抽屉（选中元素时覆盖右侧面板）──────────────────────────
const inspectorDrawerRef = ref(null)
const inspectorOpen = ref(false)

const inspectorSelectionKey = computed(() => {
  if (props.editorState.activeSummaryId.value) return `summary:${props.editorState.activeSummaryId.value}`
  if (props.editorState.activeEdgeId.value) return `edge:${props.editorState.activeEdgeId.value}`
  if (props.editorState.activeTextBlockId.value) return `block:${props.editorState.activeTextBlockId.value}`
  if (props.editorState.activeNodeId.value) return `node:${props.editorState.activeNodeId.value}`
  return ''
})

const inspectorTitle = computed(() => {
  if (selectedNodeIds.value.length > 1) return t('editor.multiSelection', { count: selectedNodeIds.value.length })
  if (selectedSummary.value) return t('mindmap.summary')
  if (selectedEdge.value) return t('editor.edgeLabel')
  if (props.editorState.activeTextBlockId.value) return t('editor.textBlockLayer')
  if (selectedNode.value) return t('editor.properties')
  return ''
})

const activeTextBlock = computed(() => (props.editorState.document.value.content.textBlocks || []).find(block => block.id === props.editorState.activeTextBlockId.value) || null)

const inspectorSubtitle = computed(() => {
  if (selectedNodeIds.value.length > 1) return ''
  const text = selectedNode.value?.text || ''
  return text.length > 24 ? `${text.slice(0, 24)}…` : text
})

// 选中元素 → 打开抽屉；切换元素 → 只换内容（不重新滑入）
watch(inspectorSelectionKey, (key, previous) => {
  if (!key) {
    inspectorOpen.value = false
    return
  }
  if (key !== previous) {
    inspectorOpen.value = true
  }
})

function openTextBlockInspector(blockId) {
  props.editorState.selectTextBlock(blockId)
  inspectorOpen.value = true
}

function closeInspector() {
  inspectorOpen.value = false
}

// 点抽屉以外的地方关闭（点画布上的元素交给 watch 重新打开，避免闪烁）
function handleInspectorOutsidePointerDown(event) {
  if (!inspectorOpen.value) {
    return
  }
  const drawer = inspectorDrawerRef.value
  if (drawer && drawer.contains(event.target)) {
    return
  }
  if (event.target instanceof Element && event.target.closest(
    '[data-testid^="node-shape-"], [data-testid^="node-label-"], [data-testid^="node-badge-"], [data-testid^="edge-path-"], [data-testid^="edge-label"], .mind-note-block, .mindmap-summary'
  )) {
    return
  }
  closeInspector()
}

const document = computed(() => props.editorState.document.value)
const isTreeMode = computed(() => ['mindmap', 'mind-note'].includes(document.value.mode))
const isMindNote = computed(() => document.value.mode === 'mind-note')
// 思维笔记的「笔记视图」：左大纲 + 右富文本块
const noteView = ref(false)

const activeNodeBlocks = computed(() => flattenNodeBlocks(
  document.value.content.textBlocks || [],
  props.editorState.activeNodeId.value || ''
))

// 历史版本面板
const revisionPanelOpen = ref(false)
const revisionItems = ref([])
const revisionBusy = ref(false)

async function openRevisionPanel() {
  revisionPanelOpen.value = true
  revisionBusy.value = true
  try {
    revisionItems.value = await props.editorState.listRevisions()
  } finally {
    revisionBusy.value = false
  }
}

function formatRevisionTime(item) {
  const value = item?.createdAt
  if (!value) {
    return ''
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString()
}

async function restoreRevision(item) {
  if (!item?.id || revisionBusy.value) {
    return
  }
  const confirmed = typeof window === 'undefined'
    || window.confirm(t('editor.revisionConfirm', { time: formatRevisionTime(item) }))
  if (!confirmed) {
    return
  }

  revisionBusy.value = true
  try {
    const ok = await props.editorState.restoreRevision(item.id)
    if (ok) {
      revisionPanelOpen.value = false
      showEditorToast(t('editor.revisionRestored'), 'success')
    }
  } finally {
    revisionBusy.value = false
  }
}
const orderedLayers = computed(() => [...document.value.content.layers].sort((left, right) => left.order - right.order))
const layerMap = computed(() => new Map(orderedLayers.value.map(layer => [layer.id, layer])))
const hiddenNodeIds = computed(() => new Set(props.editorState.performanceSummary.value.hiddenNodeIds || []))
const canExportXMind = computed(() => ['mindmap', 'mind-note'].includes(document.value.mode))
const selectedNode = computed(() => document.value.content.nodes.find(node => node.id === props.editorState.activeNodeId.value) || null)
const selectedNodeStyle = computed(() => selectedNode.value?.style || null)
const selectedEdge = computed(() => document.value.content.edges.find(edge => edge.id === props.editorState.activeEdgeId.value) || null)
const selectedEdgeStyle = computed(() => selectedEdge.value?.style || null)
const selectedEdgeEndpoints = computed(() => {
  const edge = selectedEdge.value
  if (!edge) {
    return null
  }
  const nodes = document.value.content.nodes || []
  const from = nodes.find(node => node.id === edge.fromNodeId)
  const to = nodes.find(node => node.id === edge.toNodeId)
  return {
    from: from?.text || edge.fromNodeId || '—',
    to: to?.text || edge.toNodeId || '—'
  }
})
const selectedNodeIdSet = computed(() => new Set(selectedNodeIds.value))
const selectedNodesAllLocked = computed(() => {
  const nodes = document.value.content.nodes.filter(node => selectedNodeIdSet.value.has(node.id))
  return nodes.length > 0 && nodes.every(node => node.locked)
})
const selectionBounds = computed(() => {
  if (!selectionState.value) {
    return null
  }

  return normalizeSelectionBounds(selectionState.value.startPoint, selectionState.value.currentPoint)
})
const nodeThemePresets = computed(() => [
  { id: 'teal-soft', label: t('editor.swatchClear'), accent: 'teal', elevation: 'soft' },
  { id: 'blue-glow', label: t('editor.swatchFocus'), accent: 'blue', elevation: 'glow' },
  { id: 'amber-soft', label: t('editor.swatchAccent'), accent: 'amber', elevation: 'soft' },
  { id: 'violet-soft', label: t('editor.swatchInspiration'), accent: 'violet', elevation: 'soft' },
  { id: 'rose-glow', label: t('editor.swatchReminder'), accent: 'rose', elevation: 'glow' }
])
const edgePresets = computed(() => [
  { id: 'flow', label: t('editor.edgeFlow'), style: { route: 'orthogonal', stroke: 'solid', marker: 'arrow' } },
  { id: 'link', label: t('editor.edgeLink'), style: { route: 'curve', stroke: 'dashed', marker: 'none' } },
  { id: 'feedback', label: t('editor.edgeFeedback'), style: { route: 'curve', stroke: 'solid', marker: 'double-arrow' } }
])

const mindmapLayout = computed(() => normalizeMindmapLayout(document.value.content.layout))
const mindmapLayoutOptions = computed(() => MINDMAP_LAYOUTS.map(item => ({
  id: item.id,
  label: t(item.labelKey)
})))
const stylePresetOptions = computed(() => MINDMAP_STYLE_PRESETS.map(item => ({
  id: item.id,
  label: t(item.labelKey)
})))
const mindmapThemeOptions = computed(() => MINDMAP_THEMES.map(item => ({
  id: item.id,
  label: t(item.labelKey),
  swatch: resolveAccentPalette(item.depths[1] || item.depths[0]).stroke
})))
const markerOptions = computed(() => MARKER_LIBRARY.map(item => ({
  id: item.id,
  emoji: item.emoji,
  label: t(item.labelKey)
})))
const topicShapeOptions = computed(() => TOPIC_SHAPES.map(item => ({
  id: item.id,
  label: t(item.labelKey)
})))
const branchStyleOptions = computed(() => BRANCH_STYLES.map(item => ({
  id: item.id,
  label: t(item.labelKey)
})))
const textColorOptions = computed(() => TEXT_COLORS.map(item => ({
  id: item.id,
  value: item.value,
  label: t(item.labelKey)
})))
const fontSizes = FONT_SIZES
const priorityValues = PRIORITY_VALUES
const priorityColors = PRIORITY_COLORS
const progressOptions = [0, 25, 50, 75, 100]
const selectedNodeMarkers = computed(() => selectedNode.value?.markers || [])
const selectedNodeLabels = computed(() => selectedNode.value?.labels || [])
const selectedSummary = computed(() => (
  (document.value.content.summaries || []).find(item => item.id === props.editorState.activeSummaryId.value) || null
))
const edgeColorOptions = ['teal', 'blue', 'amber', 'violet', 'rose', 'slate']
const boundaryColorOptions = ['teal', 'blue', 'amber', 'violet', 'rose']
const currentBoundaryAccent = computed(() => {
  const node = selectedNode.value
  if (!node) {
    return ''
  }
  const boundary = (document.value.content.boundaries || []).find(item => item.nodeId === node.id)
  return boundary?.accent || ''
})

const summaryNodeIds = computed(() => (
  selectedNodeIds.value.length > 1
    ? [...selectedNodeIds.value]
    : (props.editorState.activeNodeId.value ? [props.editorState.activeNodeId.value] : [])
))
// 关系线：先选中起点主题，再点另一个主题完成连线
const relationSourceId = ref(null)

// 聚焦分支 / 演示模式 / 附件草稿
const focusNodeId = ref(null)
const presentationActive = ref(false)
const presentationIndex = ref(0)
const attachmentDraft = reactive({ name: '', url: '' })
const attachmentFileInput = ref(null)
const ATTACHMENT_MAX_BYTES = 150 * 1024

const outlineCanMove = computed(() => (
  isTreeMode.value && Boolean(props.editorState.activeNodeId.value)
))

function triggerAttachmentUpload() {
  attachmentFileInput.value?.click()
}

function onAttachmentFileChange(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) {
    return
  }
  if (file.size > ATTACHMENT_MAX_BYTES) {
    showEditorToast(t('mindmap.attachmentTooLarge'), 'error', 2600)
    return
  }

  const reader = new FileReader()
  reader.onload = () => {
    props.editorState.addNodeAttachment(file.name, String(reader.result || ''))
  }
  reader.onerror = () => {
    showEditorToast(t('mindmap.attachmentReadFailed'), 'error', 2400)
  }
  reader.readAsDataURL(file)
}
const importAccept = ref('.md,.markdown,.txt,.opml,.xml,.xmind')
const mindmapInputRef = ref(null)

const focusVisibleIds = computed(() => {
  if (!focusNodeId.value) {
    return null
  }
  return new Set(collectSubtreeIds(document.value.content.nodes, focusNodeId.value))
})

const outlineRows = computed(() => {
  if (!isTreeMode.value) {
    return []
  }

  const nodes = document.value.content.nodes.filter(node => node.floating !== true)
  const byId = new Map(nodes.map(node => [node.id, node]))
  const tree = buildMindmapTree(nodes)
  const root = nodes.find(node => !node.parentId)
  const rows = []

  function walk(nodeId, depth) {
    const node = byId.get(nodeId)
    if (!node) {
      return
    }
    rows.push({ id: node.id, text: node.text, depth })
    ;(tree.get(nodeId) || []).forEach(childId => walk(childId, depth + 1))
  }

  if (root) {
    walk(root.id, 0)
  }
  return rows
})

const presentationSlides = computed(() => outlineRows.value.map(row => {
  const node = document.value.content.nodes.find(item => item.id === row.id) || {}
  return {
    id: row.id,
    text: row.text,
    depth: row.depth,
    note: node.note || '',
    labels: node.labels || []
  }
}))

const currentSlide = computed(() => presentationSlides.value[presentationIndex.value] || null)
const nextSlide = computed(() => presentationSlides.value[presentationIndex.value + 1] || null)

// 演示计时
const presentationElapsed = ref('00:00')
let presentationTimer = null
let presentationStartedAt = 0

function formatElapsed(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0')
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}

function startPresentationTimer() {
  stopPresentationTimer()
  presentationStartedAt = Date.now()
  presentationElapsed.value = '00:00'
  presentationTimer = window.setInterval(() => {
    presentationElapsed.value = formatElapsed(Date.now() - presentationStartedAt)
  }, 1000)
}

function stopPresentationTimer() {
  if (presentationTimer) {
    window.clearInterval(presentationTimer)
    presentationTimer = null
  }
}

// 演示时直接编辑当前主题的备注
function updateSlideNote(value) {
  const slide = currentSlide.value
  if (slide) {
    props.editorState.setNodeNoteById(slide.id, value)
  }
}

// 快捷键帮助面板
const shortcutsOpen = ref(false)
const shortcutList = computed(() => [
  { key: 'child', keys: ['Tab'], label: t('shortcuts.child') },
  { key: 'sibling', keys: ['Enter'], label: t('shortcuts.sibling') },
  { key: 'promote', keys: ['Shift', 'Tab'], label: t('shortcuts.promote') },
  { key: 'insert-parent', keys: ['Ctrl', 'Enter'], label: t('shortcuts.insertParent') },
  { key: 'edit', keys: ['F2'], label: t('shortcuts.edit') },
  { key: 'delete', keys: ['Delete'], label: t('shortcuts.delete') },
  { key: 'pan', keys: ['Space'], label: t('shortcuts.pan') },
  { key: 'zoom', keys: ['+', '-'], label: t('shortcuts.zoom') },
  { key: 'undo', keys: ['Ctrl', 'Z'], label: t('shortcuts.undoRedo') },
  { key: 'save', keys: ['Ctrl', 'S'], label: t('shortcuts.save') },
  { key: 'escape', keys: ['Esc'], label: t('shortcuts.escape') },
  { key: 'help', keys: ['?'], label: t('shortcuts.help') }
])

// 大纲拖拽排序
const outlineDragId = ref(null)

function onOutlineDragStart(row, event) {
  outlineDragId.value = row.id
  try {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', row.id)
  } catch {
    // 拖拽数据不可用时依赖 outlineDragId
  }
}

function onOutlineDrop(row, event) {
  const dragId = outlineDragId.value || event.dataTransfer?.getData('text/plain')
  outlineDragId.value = null
  if (dragId && dragId !== row.id) {
    props.editorState.moveTopicToNode(dragId, row.id)
  }
}

function toggleFocus() {
  if (focusNodeId.value) {
    focusNodeId.value = null
    return
  }
  const nodeId = props.editorState.activeNodeId.value
  if (nodeId) {
    focusNodeId.value = nodeId
  }
}

function startPresentation() {
  if (!presentationSlides.value.length) {
    return
  }
  const activeIndex = presentationSlides.value.findIndex(slide => slide.id === props.editorState.activeNodeId.value)
  presentationIndex.value = activeIndex >= 0 ? activeIndex : 0
  presentationActive.value = true
  startPresentationTimer()
}

function endPresentation() {
  presentationActive.value = false
  stopPresentationTimer()
}

function stepPresentation(step) {
  const next = presentationIndex.value + step
  if (next < 0 || next >= presentationSlides.value.length) {
    return
  }
  presentationIndex.value = next
}

function submitAttachment() {
  const name = attachmentDraft.name.trim()
  const url = attachmentDraft.url.trim()
  if (!url) {
    return
  }
  if (props.editorState.addNodeAttachment(name, url)) {
    attachmentDraft.name = ''
    attachmentDraft.url = ''
  }
}

// 顶栏「导出 / 导入」下拉菜单
const toolbarMenu = ref('')

function toggleToolbarMenu(name) {
  toolbarMenu.value = toolbarMenu.value === name ? '' : name
}

function closeToolbarMenu() {
  if (toolbarMenu.value) {
    toolbarMenu.value = ''
  }
  markdownTableControlsOpen.value = false
}

function runExport(format) {
  toolbarMenu.value = ''
  if (format === 'pdf') {
    handleExportPdf()
    return
  }
  if (format === 'drawio') {
    props.editorState.exportDrawio()
    return
  }
  handleExport(format)
}

function runImport(kind) {
  toolbarMenu.value = ''
  if (kind === 'drawio') {
    triggerDrawioImport()
    return
  }
  if (kind === 'markdown') {
    importAccept.value = '.md,.markdown,.txt'
  } else if (kind === 'opml') {
    importAccept.value = '.opml,.xml'
  } else {
    importAccept.value = '.xmind'
  }
  nextTick(() => mindmapInputRef.value?.click())
}

function onMindmapFileChange(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (file) {
    void props.editorState.importMindmapFile(file)
  }
}

// 编号：按树顺序生成 1 / 1.1 / 1.2
const nodeNumbers = computed(() => {
  const map = new Map()
  if (!isTreeMode.value || !mindmapLayout.value.numbering) {
    return map
  }

  const nodes = document.value.content.nodes.filter(node => node.floating !== true)
  const tree = buildMindmapTree(nodes)
  const root = nodes.find(node => !node.parentId)
  if (!root) {
    return map
  }

  function walk(nodeId, prefix) {
    ;(tree.get(nodeId) || []).forEach((childId, index) => {
      const number = `${prefix}${index + 1}`
      map.set(childId, number)
      walk(childId, `${number}.`)
    })
  }

  walk(root.id, '')
  return map
})

// 每个主题在树里的层级，用于连线粗细/层级视觉权重
const nodeDepthMap = computed(() => {
  const map = new Map()
  const nodes = document.value.content.nodes
  const byId = new Map(nodes.map(node => [node.id, node]))
  nodes.forEach(node => {
    let depth = 0
    let current = node
    while (current?.parentId && depth < 64) {
      depth += 1
      current = byId.get(current.parentId)
    }
    map.set(node.id, depth)
  })
  return map
})

const nodeSearch = ref('')
const nodeFilter = ref('')
const searchInputRef = ref(null)
const hasSearchFilter = computed(() => Boolean(nodeSearch.value.trim() || nodeFilter.value))

function resetNodeSearch() {
  nodeSearch.value = ''
  nodeFilter.value = ''
  nextTick(() => searchInputRef.value?.focus())
}

function matchesNodeFilter(node, filter) {
  switch (filter) {
    case 'note':
      return Boolean(node.note)
    case 'label':
      return (node.labels || []).length > 0
    case 'marker':
      return (node.markers || []).length > 0
    case 'priority':
      return Boolean(node.priority)
    case 'task':
      return Boolean(node.taskStart || node.taskDue || node.assignee)
    case 'attachment':
      return (node.attachments || []).length > 0
    case 'done':
      return Number(node.progress) >= 100
    default:
      return true
  }
}

const searchHitBlockIds = computed(() => {
  const query = nodeSearch.value.trim().toLowerCase()
  if (!query || !isTreeMode.value) {
    return new Set()
  }
  return new Set(
    (document.value.content.textBlocks || [])
      .filter(block => String(block.text || '').toLowerCase().includes(query))
      .map(block => block.id)
  )
})

const searchHitIds = computed(() => {
  const query = nodeSearch.value.trim().toLowerCase()
  const filter = nodeFilter.value
  if ((!query && !filter) || !isTreeMode.value) {
    return new Set()
  }

  const labelQuery = query.startsWith('#') ? query.slice(1) : null
  const hits = new Set()
  const noteTextByNode = new Map()
  ;(document.value.content.textBlocks || []).forEach(block => {
    const existing = noteTextByNode.get(block.nodeId) || []
    existing.push(block.text || '')
    noteTextByNode.set(block.nodeId, existing)
  })
  document.value.content.nodes.forEach(node => {
    const haystack = [
      node.text,
      node.note,
      ...(node.labels || []),
      ...(noteTextByNode.get(node.id) || [])
    ].join(' ').toLowerCase()
    const matchesQuery = labelQuery !== null
      ? (node.labels || []).some(label => label.toLowerCase().includes(labelQuery))
      : (!query
        || haystack.includes(query)
        || (node.priority && String(node.priority) === query))
    if (matchesQuery && matchesNodeFilter(node, filter)) {
      hits.add(node.id)
    }
  })
  return hits
})
// 过滤时保留命中节点的祖先链，保证结构可读
const searchVisibleIds = computed(() => {
  if (!hasSearchFilter.value) {
    return null
  }

  const visible = new Set(searchHitIds.value)
  const byId = new Map(document.value.content.nodes.map(node => [node.id, node]))
  visible.forEach(nodeId => {
    let current = byId.get(nodeId)
    while (current?.parentId) {
      visible.add(current.parentId)
      current = byId.get(current.parentId)
    }
  })
  return visible
})

const visibleBoundaries = computed(() => {
  if (!isTreeMode.value) {
    return []
  }

  const byId = new Map(visibleNodes.value.map(node => [node.id, node]))
  return (document.value.content.boundaries || []).map(boundary => {
    const root = byId.get(boundary.nodeId)
    if (!root) {
      return null
    }

    const subtree = collectSubtreeIds(visibleNodes.value, boundary.nodeId)
      .map(nodeId => byId.get(nodeId))
      .filter(Boolean)
    if (!subtree.length) {
      return null
    }

    const left = Math.min(...subtree.map(node => node.x))
    const top = Math.min(...subtree.map(node => node.y))
    const right = Math.max(...subtree.map(node => node.x + node.width))
    const bottom = Math.max(...subtree.map(node => node.y + node.height))
    const hasBadges = subtree.some(node => nodeMarkerBadges(node).length)
    const hasLabels = subtree.some(node => (node.labels || []).length)
    const pad = 20

    return {
      id: boundary.id,
      nodeId: boundary.nodeId,
      accent: boundary.accent || 'rose',
      x: left - pad,
      y: top - (hasBadges ? pad + 12 : pad),
      width: right - left + pad * 2,
      height: bottom - top + pad * 2 + (hasBadges ? 12 : 0) + (hasLabels ? 12 : 0)
    }
  }).filter(Boolean)
})

const visibleSummaries = computed(() => {
  if (!isTreeMode.value) {
    return []
  }

  const byId = new Map(visibleNodes.value.map(node => [node.id, node]))
  const direction = mindmapLayout.value.direction
  const activeId = props.editorState.activeSummaryId.value

  return (document.value.content.summaries || []).map(summary => {
    const members = (summary.nodeIds || []).map(nodeId => byId.get(nodeId)).filter(Boolean)
    if (!members.length) {
      return null
    }

    const text = summary.text || ''
    const labelWidth = Math.max(56, Math.min(240, text.length * 12 + 24))
    const common = {
      id: summary.id,
      text,
      accent: summary.accent || 'amber',
      active: summary.id === activeId,
      labelWidth
    }

    if (direction === 'down') {
      const left = Math.min(...members.map(node => node.x))
      const right = Math.max(...members.map(node => node.x + node.width))
      const bottom = Math.max(...members.map(node => node.y + node.height)) + 18
      return {
        ...common,
        path: `M ${left} ${bottom - 8} V ${bottom} H ${right} V ${bottom - 8}`,
        labelX: (left + right) / 2,
        labelY: bottom + 16
      }
    }

    const top = Math.min(...members.map(node => node.y))
    const bottom = Math.max(...members.map(node => node.y + node.height))
    const sign = direction === 'left' ? -1 : 1
    const anchorX = sign > 0
      ? Math.max(...members.map(node => node.x + node.width)) + 18
      : Math.min(...members.map(node => node.x)) - 18

    return {
      ...common,
      path: `M ${anchorX - sign * 8} ${top} H ${anchorX} V ${bottom} H ${anchorX - sign * 8}`,
      labelX: anchorX + sign * (labelWidth / 2 + 14),
      labelY: (top + bottom) / 2
    }
  }).filter(Boolean)
})
const layerOrderMap = computed(() => {
  const map = new Map()
  orderedLayers.value.forEach((layer, index) => map.set(layer.id, index))
  return map
})

const activeNodes = computed(() => {
  const base = document.value.content.nodes
  const sorted = [...base].sort((left, right) => (
    (layerOrderMap.value.get(left.layerId) ?? 0) - (layerOrderMap.value.get(right.layerId) ?? 0)
  ))
  if (!dragState.value?.previewPositions) return sorted
  return sorted.map(node => {
    if (dragState.value.previewPositions[node.id]) {
      return {
        ...node,
        x: dragState.value.previewPositions[node.id].x,
        y: dragState.value.previewPositions[node.id].y
      }
    }
    return node
  })
})
const visibleNodes = computed(() => activeNodes.value.filter(node => {
  if (layerMap.value.get(node.layerId)?.visible === false) {
    return false
  }
  if (searchVisibleIds.value && !searchVisibleIds.value.has(node.id)) {
    return false
  }
  if (focusVisibleIds.value && !focusVisibleIds.value.has(node.id)) {
    return false
  }
  return !hiddenNodeIds.value.has(node.id)
}))
// 时间轴布局的水平轴线：取中心主题中线，横跨所有主题，并在一级分支处打点
const timelineAxis = computed(() => {
  const direction = mindmapLayout.value.direction
  if (direction !== 'timeline' && direction !== 'fishbone') {
    return null
  }
  const nodes = visibleNodes.value
  if (!nodes.length) {
    return null
  }
  const root = nodes.find(node => !node.parentId)
  if (!root) {
    return null
  }
  const axisY = root.y + root.height / 2
  const minX = Math.min(...nodes.map(node => node.x))
  const maxX = Math.max(...nodes.map(node => node.x + node.width))
  const branchIds = new Set(
    document.value.content.nodes
      .filter(node => node.parentId === root.id)
      .map(node => node.id)
  )
  const dots = direction === 'timeline'
    ? nodes
        .filter(node => branchIds.has(node.id))
        .map(node => ({ id: node.id, x: node.x + node.width / 2 }))
    : []
  const x1 = direction === 'fishbone' ? root.x + root.width : minX - 60
  return { axisY, x1, x2: maxX + 60, dots, kind: direction }
})

const layerRows = computed(() => {
  const nodes = document.value.content.nodes
  return [...orderedLayers.value]
    .reverse()
    .map(layer => ({
      id: layer.id,
      name: layer.name,
      visible: layer.visible !== false,
      locked: layer.locked === true,
      count: nodes.filter(node => node.layerId === layer.id).length
        + document.value.content.edges.filter(edge => edge.layerId === layer.id).length
    }))
})

const groupOutlines = computed(() => {
  const groupIds = new Set()
  selectedNodeIds.value.forEach(nodeId => {
    const node = activeNodes.value.find(item => item.id === nodeId)
    if (node?.groupId) {
      groupIds.add(node.groupId)
    }
  })

  return [...groupIds].map(groupId => {
    const members = activeNodes.value.filter(node => node.groupId === groupId)
    if (members.length < 2) {
      return null
    }
    const x = Math.min(...members.map(node => node.x))
    const y = Math.min(...members.map(node => node.y))
    const right = Math.max(...members.map(node => node.x + node.width))
    const bottom = Math.max(...members.map(node => node.y + node.height))
    return { id: groupId, x: x - 10, y: y - 10, width: right - x + 20, height: bottom - y + 20 }
  }).filter(Boolean)
})

const largeDocument = computed(() => document.value.content.nodes.length > 150)

// 快速路由只依赖两端节点，可安全缓存；拖拽时未受影响的连线直接命中缓存
const fastRouteCache = new Map()

function routeEdgeCached(edge, nodes, fast) {
  if (!fast) {
    fastRouteCache.delete(edge.id)
    return routeEdge(edge, nodes, { fast: false })
  }

  const from = nodes.find(node => node.id === edge.fromNodeId)
  const to = nodes.find(node => node.id === edge.toNodeId)
  const key = [
    from?.x, from?.y, from?.width, from?.height, from?.rotation, edge.fromAnchor,
    to?.x, to?.y, to?.width, to?.height, to?.rotation, edge.toAnchor,
    JSON.stringify(edge.style?.waypoints || []),
    edge.style?.route || ''
  ].join('|')

  const cached = fastRouteCache.get(edge.id)
  if (cached && cached.key === key) {
    return cached.points
  }

  const points = routeEdge(edge, nodes, { fast: true })
  fastRouteCache.set(edge.id, { key, points })
  return points
}

const visibleEdges = computed(() => document.value.content.edges
  .filter(edge => layerMap.value.get(edge.layerId)?.visible !== false)
  .filter(edge => !hiddenNodeIds.value.has(edge.fromNodeId) && !hiddenNodeIds.value.has(edge.toNodeId))
  .filter(edge => !focusVisibleIds.value || (
    focusVisibleIds.value.has(edge.fromNodeId) && focusVisibleIds.value.has(edge.toNodeId)
  ))
  .map(edge => {
    // 拖拽中或大文档：跳过避让评分，只算基础走线
    const points = routeEdgeCached(edge, activeNodes.value, Boolean(dragState.value) || largeDocument.value)
    return {
      ...edge,
      points,
      path: buildEdgePath(points, edge.style),
      labelPosition: resolveEdgeLabelPosition(points),
      labelText: edge.label || ''
    }
  }))
const activeEdge = computed(() => {
  const edgeId = props.editorState.activeEdgeId.value
  if (!edgeId || document.value.mode !== 'flowchart') {
    return null
  }
  return visibleEdges.value.find(edge => edge.id === edgeId) || null
})

const activeEdgeHandles = computed(() => {
  const edge = activeEdge.value
  if (!edge || !edge.points?.length) {
    return []
  }

  const points = edge.points
  const handles = [
    { key: 'from', kind: 'endpoint', side: 'from', x: points[0].x, y: points[0].y },
    { key: 'to', kind: 'endpoint', side: 'to', x: points[points.length - 1].x, y: points[points.length - 1].y }
  ]

  for (let index = 1; index < points.length - 1; index += 1) {
    handles.push({
      key: `vertex-${index}`,
      kind: 'vertex',
      vertexIndex: index,
      x: points[index].x,
      y: points[index].y
    })
  }

  if (points.length === 2) {
    handles.push({
      key: 'midpoint',
      kind: 'midpoint',
      x: (points[0].x + points[1].x) / 2,
      y: (points[0].y + points[1].y) / 2
    })
  }

  return handles
})

const edgeHandleDrag = ref(null)

const edgeDragPreview = computed(() => {
  const state = edgeHandleDrag.value
  const edge = activeEdge.value
  if (!state || !edge) {
    return null
  }

  const points = edge.points || []
  if (points.length < 2) {
    return null
  }

  if (state.mode === 'endpoint') {
    const fixed = state.side === 'from' ? points[points.length - 1] : points[0]
    let moving = { x: state.x, y: state.y }

    if (state.targetNodeId) {
      const target = activeNodes.value.find(node => node.id === state.targetNodeId)
      if (target) {
        moving = resolveAnchorPoint(target, state.targetAnchor)
      }
    }

    return `M ${fixed.x} ${fixed.y} L ${moving.x} ${moving.y}`
  }

  const chain = [points[0], ...state.waypoints, points[points.length - 1]]
  return chain.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
})

const connectTarget = computed(() => {
  const fromConnect = connectState.value
  if (fromConnect?.targetNodeId) {
    return { nodeId: fromConnect.targetNodeId, anchor: fromConnect.targetAnchor }
  }
  const fromEdge = edgeHandleDrag.value
  if (fromEdge?.targetNodeId) {
    return { nodeId: fromEdge.targetNodeId, anchor: fromEdge.targetAnchor }
  }
  return null
})

function startEdgeHandleDrag(edge, handle, event) {
  event.preventDefault()
  event.stopPropagation()

  const state = {
    edgeId: edge.id,
    mode: handle.kind,
    side: handle.side || null,
    index: -1,
    horizontal: false,
    waypoints: (edge.points || []).slice(1, -1).map(point => ({ x: point.x, y: point.y })),
    x: handle.x,
    y: handle.y,
    targetNodeId: null,
    targetAnchor: null
  }

  if (handle.kind === 'vertex') {
    state.index = handle.vertexIndex - 1
  } else if (handle.kind === 'midpoint') {
    const start = edge.points[0]
    const end = edge.points[edge.points.length - 1]
    state.horizontal = Math.abs(start.y - end.y) < Math.abs(start.x - end.x)
    state.index = state.waypoints.length
    state.waypoints.push({ x: handle.x, y: handle.y })
  }

  edgeHandleDrag.value = state
  window.addEventListener('pointermove', onEdgeHandleMove)
  window.addEventListener('pointerup', onEdgeHandleUp)
  window.addEventListener('pointercancel', cancelEdgeHandleDrag)
}

function onEdgeHandleMove(event) {
  const state = edgeHandleDrag.value
  if (!state) {
    return
  }

  const point = resolveClientPoint(event.clientX, event.clientY)
  const next = { ...state, x: point.x, y: point.y }

  if (state.mode === 'endpoint') {
    const edge = activeEdge.value
    const otherNodeId = state.side === 'from' ? edge?.toNodeId : edge?.fromNodeId
    const target = resolveConnectTarget(otherNodeId, point)
    next.targetNodeId = target?.nodeId || null
    next.targetAnchor = target?.anchor || null
  } else {
    const waypoints = state.waypoints.map(waypoint => ({ ...waypoint }))
    if (waypoints[state.index]) {
      waypoints[state.index] = { x: point.x, y: point.y }
    }
    next.waypoints = waypoints
  }

  edgeHandleDrag.value = next
}

function onEdgeHandleUp() {
  const state = edgeHandleDrag.value
  stopEdgeHandleDrag()

  if (!state) {
    return
  }

  if (state.mode === 'endpoint') {
    if (!state.targetNodeId) {
      return
    }
    const patch = state.side === 'from'
      ? { fromNodeId: state.targetNodeId, fromAnchor: state.targetAnchor }
      : { toNodeId: state.targetNodeId, toAnchor: state.targetAnchor }
    props.editorState.updateEdgeConnection(state.edgeId, patch)
    return
  }

  props.editorState.updateEdgeStyle(state.edgeId, { waypoints: state.waypoints })
}

function cancelEdgeHandleDrag() {
  stopEdgeHandleDrag()
}

function stopEdgeHandleDrag() {
  edgeHandleDrag.value = null
  window.removeEventListener('pointermove', onEdgeHandleMove)
  window.removeEventListener('pointerup', onEdgeHandleUp)
  window.removeEventListener('pointercancel', cancelEdgeHandleDrag)
}

const linkPreview = computed(() => {
  if (document.value.mode !== 'flowchart' || edgeLabelEditor.value || textOverlay.editingNode.value) {
    return null
  }

  const sourceId = props.editorState.activeNodeId.value
  const targetId = hoveredNodeId.value
  if (!sourceId || !targetId || sourceId === targetId) {
    return null
  }

  const sourceNode = activeNodes.value.find(node => node.id === sourceId)
  const targetNode = activeNodes.value.find(node => node.id === targetId)
  if (!sourceNode || !targetNode) {
    return null
  }

  const previewConnection = {
    ...resolveConnection(sourceNode, targetNode),
    style: { route: 'curve' }
  }
  const points = routeEdge(previewConnection, activeNodes.value)
  return {
    sourceId,
    targetId,
    path: buildEdgePath(points, { route: 'curve' }),
    anchors: [
      { key: `${sourceId}-start`, x: points[0].x, y: points[0].y },
      { key: `${targetId}-end`, x: points[points.length - 1].x, y: points[points.length - 1].y }
    ]
  }
})
const canvasTransform = computed(() => {
  const viewport = document.value.content.viewport
  return `translate(${viewport.x} ${viewport.y}) scale(${viewport.zoom})`
})
const visibleTextBlocks = computed(() => getVisibleTextBlocks(
  document.value.content.textBlocks,
  document.value.content.nodes,
  props.editorState.performanceSummary.value.hiddenNodeIds || [],
  new Set(orderedLayers.value.filter(layer => layer.visible !== false).map(layer => layer.id)),
  canvasWidth.value,
  {
    activeBlockId: props.editorState.activeTextBlockId.value,
    activeExtraHeight: 120
  }
).map(block => {
  let next = block
  if (textBlockDragState.value?.blockId === block.id && textBlockDragState.value.previewPosition) {
    next = {
      ...next,
      x: textBlockDragState.value.previewPosition.x,
      y: textBlockDragState.value.previewPosition.y
    }
  }
  if (noteResizeState.value?.blockId === block.id) {
    const extraHeight = Math.max(0, (block.height || 0) - (block.baseHeight || block.height || 0))
    next = {
      ...next,
      width: noteResizeState.value.width,
      baseHeight: noteResizeState.value.height,
      height: noteResizeState.value.height + extraHeight
    }
  }
  return next
}))
const exportTextBlocks = computed(() => getVisibleTextBlocks(
  document.value.content.textBlocks,
  document.value.content.nodes,
  props.editorState.performanceSummary.value.hiddenNodeIds || [],
  new Set(orderedLayers.value.filter(layer => layer.visible !== false).map(layer => layer.id)),
  canvasWidth.value
).filter(hasMindNoteBlockContent))
const paletteItems = computed(() => {
  if (document.value.mode === 'flowchart') {
    return [
      { id: 'process', group: t('editor.sectionShapes'), label: t('editor.shapeProcess'), description: t('editor.shapeProcessDesc'), keywords: 'jx juxing rect rectangle' },
      { id: 'roundrect', group: t('editor.sectionShapes'), label: t('editor.shapeRoundrect'), description: t('editor.shapeRoundrectDesc'), keywords: 'yjjx roundrect' },
      { id: 'ellipse', group: t('editor.sectionShapes'), label: t('editor.shapeEllipse'), description: t('editor.shapeEllipseDesc'), keywords: 'yx circle ellipse' },
      { id: 'triangle', group: t('editor.sectionShapes'), label: t('editor.shapeTriangle'), description: t('editor.shapeTriangleDesc'), keywords: 'sjx triangle' },

      { id: 'decision', group: t('editor.sectionFlow'), label: t('editor.shapeDecision'), description: t('editor.shapeDecisionDesc'), keywords: 'lx diamond decision panduan' },
      { id: 'terminator', group: t('editor.sectionFlow'), label: t('editor.shapeTerminator'), description: t('editor.shapeTerminatorDesc'), keywords: 'zzf terminator start end' },
      { id: 'hexagon', group: t('editor.sectionFlow'), label: t('editor.shapeHexagon'), description: t('editor.shapeHexagonDesc'), keywords: 'lbx hexagon' },
      { id: 'parallelogram', group: t('editor.sectionFlow'), label: t('editor.shapeParallelogram'), description: t('editor.shapeParallelogramDesc'), keywords: 'pxsbx parallelogram data' },

      { id: 'document', group: t('editor.sectionData'), label: t('editor.shapeDocument'), description: t('editor.shapeDocumentDesc'), keywords: 'wd document file' },
      { id: 'cylinder', group: t('editor.sectionData'), label: t('editor.shapeCylinder'), description: t('editor.shapeCylinderDesc'), keywords: 'yzt cylinder database db' },
      { id: 'cloud', group: t('editor.sectionData'), label: t('editor.shapeCloud'), description: t('editor.shapeCloudDesc'), keywords: 'yd cloud' },
      { id: 'note', group: t('editor.sectionData'), label: t('editor.shapeNote'), description: t('editor.shapeNoteDesc'), keywords: 'bq note comment' },

      { id: 'container', group: t('editor.sectionContainer'), label: t('editor.shapeContainer'), description: t('editor.shapeContainerDesc'), keywords: 'rq container group frame' },
      { id: 'swimlane', group: t('editor.sectionContainer'), label: t('editor.shapeSwimlane'), description: t('editor.shapeSwimlaneDesc'), keywords: 'yd swimlane lane' },
      { id: 'umlclass', group: t('editor.sectionContainer'), label: t('editor.shapeUmlclass'), description: t('editor.shapeUmlclassDesc'), keywords: 'lt class uml' },

      { id: 'card', group: t('editor.sectionOther'), label: t('editor.shapeCard'), description: t('editor.shapeCardDesc'), keywords: 'kp card' },
      { id: 'delay', group: t('editor.sectionOther'), label: t('editor.shapeDelay'), description: t('editor.shapeDelayDesc'), keywords: 'yc delay wait' },
      { id: 'arrow', group: t('editor.sectionOther'), label: t('editor.shapeArrow'), description: t('editor.shapeArrowDesc'), keywords: 'jt arrow' },
      { id: 'cross', group: t('editor.sectionOther'), label: t('editor.shapeCross'), description: t('editor.shapeCrossDesc'), keywords: 'sz cross plus' },
      { id: 'actor', group: t('editor.sectionOther'), label: t('editor.shapeActor'), description: t('editor.shapeActorDesc'), keywords: 'cyz actor user ren' }
    ]
  }
  if (document.value.mode === 'mindmap') {
    return [
      { id: 'mind-sibling', group: t('editor.nodes'), label: t('editor.shapeMindSibling'), description: t('editor.shapeMindSiblingDesc') },
      { id: 'mind-child', group: t('editor.nodes'), label: t('editor.shapeMindChild'), description: t('editor.shapeMindChildDesc') },
      { id: 'note-block', group: t('editor.nodes'), label: t('editor.shapeNoteBlock'), description: t('editor.shapeNoteBlockDesc') }
    ]
  }
  if (document.value.mode === 'mind-note') {
    return [
      { id: 'note-block', group: t('editor.text'), label: t('editor.shapeNoteBlock'), description: t('editor.shapeNoteBlockDesc') },
      { id: 'mind-child', group: t('editor.nodes'), label: t('editor.shapeMindChild'), description: t('editor.shapeMindChildDesc') },
      { id: 'mind-sibling', group: t('editor.nodes'), label: t('editor.shapeMindSibling'), description: t('editor.shapeMindSiblingDesc') }
    ]
  }
  return []
})

const paletteSearch = ref('')

const paletteGroups = computed(() => {
  const keyword = paletteSearch.value.trim().toLowerCase()
  const groups = []

  paletteItems.value.forEach(item => {
    if (keyword) {
      const haystack = `${item.label} ${item.description} ${item.keywords || ''}`.toLowerCase()
      if (!haystack.includes(keyword)) {
        return
      }
    }

    let group = groups.find(entry => entry.name === item.group)
    if (!group) {
      group = { name: item.group, items: [] }
      groups.push(group)
    }
    group.items.push(item)
  })

  return groups
})

const paletteTitle = computed(() => {
  if (document.value.mode === 'flowchart') {
    return t('editor.shapes')
  }
  return document.value.mode === 'mind-note' ? t('editor.nodesAndText') : t('editor.nodes')
})
const {
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
} = useMarkdownFormatTools({
  document,
  updateMarkdownSource: nextSource => props.editorState.updateMarkdownSource(nextSource)
})
const textOverlay = useTextOverlay(nodeId => document.value.content.nodes.find(node => node.id === nodeId))

// 节点文字编辑浮层（HTML，不用 foreignObject）
const editingNodeOverlay = computed(() => {
  const node = textOverlay.editingNode.value
  if (!node) {
    return null
  }
  return layerMap.value.get(node.layerId)?.locked ? null : node
})

const overlayAnchor = ref(null)

// SVG 用 viewBox 做了等比缩放，所以浮层坐标要把 user unit 换算成 CSS px
function estimateOverlayTextWidth(text, fontSizePx) {
  let units = 0
  for (const char of String(text || '')) {
    if (/\s/.test(char)) {
      units += 0.36
    } else if ((char.codePointAt(0) || 0) >= 0x2e80) {
      units += 1
    } else {
      units += 0.58
    }
  }
  return units * fontSizePx
}

function syncOverlayAnchor() {
  const svg = svgRef.value
  const card = canvasCardRef.value
  const node = editingNodeOverlay.value
  if (!svg || !card || !node) {
    overlayAnchor.value = null
    return
  }

  const svgRect = svg.getBoundingClientRect()
  const cardRect = card.getBoundingClientRect()
  // viewBox 默认 xMidYMid meet：等比缩放 + 居中，可能有上下（或左右）留白
  const scale = Math.min(
    svgRect.width / (canvasWidth.value || 1),
    svgRect.height / (canvasHeight.value || 1)
  ) || 1
  const padX = (svgRect.width - canvasWidth.value * scale) / 2
  const padY = (svgRect.height - canvasHeight.value * scale) / 2
  const viewport = document.value.content.viewport
  const draft = String(textOverlay.draftText.value ?? node.text ?? '')
  const labelStyle = resolveNodeLabelStyle(node)
  const baseFontSize = Number.parseFloat(labelStyle.fontSize) || 14
  // 编辑框保持可读字号，但随画布缩放做温和调整；文字完整换行，不再横向滚动截断。
  const fontSizePx = Math.max(12, Math.min(20, baseFontSize * Math.max(0.9, Math.min(viewport.zoom, 1.35))))
  const lineHeightPx = Math.round(fontSizePx * 1.45)
  const textWidthPx = estimateOverlayTextWidth(draft, fontSizePx)
  const nodeWidthPx = Math.max(node.width * viewport.zoom * scale, 92)
  const maxWidthPx = Math.min(620, Math.max(180, cardRect.width - 16))
  const overlayWidthPx = Math.min(
    maxWidthPx,
    Math.max(132, nodeWidthPx, Math.min(560, textWidthPx + 24))
  )
  const innerWidthPx = Math.max(80, overlayWidthPx - 20)
  const lineCount = Math.max(1, Math.ceil(textWidthPx / innerWidthPx))
  const nodeHeightPx = Math.max(node.height * viewport.zoom * scale, 28)
  const overlayHeightPx = Math.max(nodeHeightPx, lineCount * lineHeightPx + 12, 28)
  const centerPx = (svgRect.left - cardRect.left) + padX + ((node.x + node.width / 2) * viewport.zoom + viewport.x) * scale
  const nodeTopPx = (svgRect.top - cardRect.top) + padY + (node.y * viewport.zoom + viewport.y) * scale
  const clampedLeft = Math.min(Math.max(4, centerPx - overlayWidthPx / 2), Math.max(4, cardRect.width - overlayWidthPx - 4))
  const minTop = (svgRect.top - cardRect.top) + padY + 4
  const maxTop = Math.max(minTop, cardRect.height - overlayHeightPx - 4)
  const centeredTop = nodeTopPx + (nodeHeightPx - overlayHeightPx) / 2
  const clampedTop = Math.min(Math.max(minTop, centeredTop), maxTop)

  overlayAnchor.value = {
    left: clampedLeft,
    top: clampedTop,
    width: overlayWidthPx,
    height: overlayHeightPx,
    fontSizePx,
    lineHeightPx
  }
}

const nodeTextOverlayStyle = computed(() => {
  const anchor = overlayAnchor.value
  if (!anchor) {
    return {}
  }
  return {
    left: `${anchor.left}px`,
    top: `${anchor.top}px`,
    width: `${anchor.width}px`,
    height: `${anchor.height}px`,
    '--node-overlay-font-size': `${anchor.fontSizePx}px`,
    '--node-overlay-line-height': `${anchor.lineHeightPx}px`
  }
})

watch(
  () => [
    document.value.content.viewport.x,
    document.value.content.viewport.y,
    document.value.content.viewport.zoom,
    editingNodeOverlay.value?.id || '',
    editingNodeOverlay.value?.x || 0,
    editingNodeOverlay.value?.y || 0,
    editingNodeOverlay.value?.width || 0,
    editingNodeOverlay.value?.height || 0,
    textOverlay.draftText.value
  ],
  () => nextTick(syncOverlayAnchor)
)

let editorToastTimer = null

watch(() => props.editorState.manualSaveFeedbackToken.value, token => {
  if (!token) {
    return
  }

  showEditorToast(t('editor.saved'), 'success')
})

// errorToken 让「同样的错误再出现一次」也能重新弹提示（watch 只会在值变化时触发）
watch(
  () => `${props.editorState.errorToken?.value ?? 0}|${props.editorState.errorMessage.value}`,
  () => {
    const message = props.editorState.errorMessage.value
    if (!message) {
      return
    }

    showEditorToast(message, 'error', 2200)
  }
)

watch(() => document.value.content.nodes.map(node => node.id), nodeIds => {
  const nodeIdSet = new Set(nodeIds)
  selectedNodeIds.value = selectedNodeIds.value.filter(nodeId => nodeIdSet.has(nodeId))
})

watch(() => document.value.content.activePageId, () => {
  selectedNodeIds.value = []
  closeEdgeLabelEditor()
  textOverlay.cancel()
})

function startDrag(node, event) {
  // 只响应鼠标左键（指针事件里触摸/手写笔的 button 也是 0）
  if (event.button !== 0) {
    return
  }

  if (node.locked || layerMap.value.get(node.layerId)?.locked) {
    return
  }

  // 同理：上一次拖拽的抑制不应吞掉下一次点击
  suppressNodeClick.value = false

  // 指针按下即选中：这样「按下—拖动—松开」也算选中，
  // 不会出现点完节点后 activeNodeId 还停在上一个节点（图标只落到第一个元素）的情况。
  if (!event.shiftKey && props.editorState.activeNodeId.value !== node.id) {
    props.editorState.selectNode(node.id)
  }

  const baseNodeIds = selectedNodeIds.value.length > 1 && selectedNodeIdSet.value.has(node.id)
    ? [...selectedNodeIds.value]
    : [node.id]

  const expandedNodeIds = new Set(baseNodeIds)
  baseNodeIds.forEach(nodeId => {
    const target = activeNodes.value.find(item => item.id === nodeId)
    if (target && (target.kind === 'container' || target.kind === 'swimlane')) {
      props.editorState.getContainerChildren(nodeId).forEach(childId => expandedNodeIds.add(childId))
    }
    if (target?.groupId) {
      activeNodes.value
        .filter(node => node.groupId === target.groupId)
        .forEach(node => expandedNodeIds.add(node.id))
    }
  })
  const draggedNodeIds = [...expandedNodeIds]

  if (draggedNodeIds.length === 1) {
    selectedNodeIds.value = []
  }

  const pointer = resolvePoint(event)
  const initialPositions = Object.fromEntries(draggedNodeIds.map(nodeId => {
    const currentNode = activeNodes.value.find(item => item.id === nodeId) || document.value.content.nodes.find(item => item.id === nodeId)
    return [nodeId, { x: currentNode?.x || 0, y: currentNode?.y || 0 }]
  }))

  dragState.value = {
    anchorNodeId: node.id,
    nodeIds: draggedNodeIds,
    initialPositions,
    offsetX: pointer.x - node.x,
    offsetY: pointer.y - node.y,
    deltaX: 0,
    deltaY: 0,
    previewPositions: null
  }
  try {
    event.currentTarget?.setPointerCapture?.(event.pointerId)
  } catch {
    // 节点可能在提交文字后重渲染；窗口级 pointermove/pointerup 仍能完成拖动。
  }
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', endDrag)
}

let dragFrameId = 0
let pendingDragEvent = null

function onPointerMove(event) {
  if (!dragState.value) {
    return
  }

  // 合并同一帧内的多个 pointermove，一帧只重算一次
  pendingDragEvent = event
  if (dragFrameId) {
    return
  }

  dragFrameId = window.requestAnimationFrame(() => {
    dragFrameId = 0
    const pending = pendingDragEvent
    pendingDragEvent = null
    if (pending) {
      applyDragMove(pending)
    }
  })
}

function flushDragMove() {
  if (dragFrameId) {
    window.cancelAnimationFrame(dragFrameId)
    dragFrameId = 0
  }
  if (pendingDragEvent) {
    const pending = pendingDragEvent
    pendingDragEvent = null
    applyDragMove(pending)
  }
}

function applyDragMove(event) {
  if (!dragState.value) {
    return
  }

  const pointer = resolvePoint(event)
  const anchorPosition = dragState.value.initialPositions[dragState.value.anchorNodeId]
  const deltaX = (pointer.x - dragState.value.offsetX) - anchorPosition.x
  const deltaY = (pointer.y - dragState.value.offsetY) - anchorPosition.y
  dragState.value.deltaX = deltaX
  dragState.value.deltaY = deltaY
  const previewPositions = Object.fromEntries(dragState.value.nodeIds.map(nodeId => {
    const initialPosition = dragState.value.initialPositions[nodeId]
    return [nodeId, {
      x: initialPosition.x + deltaX,
      y: initialPosition.y + deltaY
    }]
  }))

  applyAlignmentSnap(previewPositions)
  dragState.value.previewPositions = previewPositions
}

const SNAP_THRESHOLD_PX = 8

function resolveSnapThreshold() {
  const svg = svgRef.value
  if (!svg) {
    return 8
  }
  const rect = svg.getBoundingClientRect()
  const viewport = document.value.content.viewport
  const scale = Math.min(rect.width / canvasWidth.value, rect.height / canvasHeight.value) * viewport.zoom
  return scale > 0 ? SNAP_THRESHOLD_PX / scale : 8
}

function applyAlignmentSnap(previewPositions) {
  const anchorId = dragState.value?.anchorNodeId
  const anchorNode = activeNodes.value.find(node => node.id === anchorId)
  const position = previewPositions[anchorId]
  dragGuides.value = []
  if (dragState.value) {
    dragState.value.snapDx = 0
    dragState.value.snapDy = 0
  }

  // 按住 Alt 时不做吸附、不画参考线
  if (altPressed.value) {
    return
  }

  if (!anchorNode || !position) {
    return
  }

  const moving = {
    left: position.x,
    right: position.x + anchorNode.width,
    centerX: position.x + anchorNode.width / 2,
    top: position.y,
    bottom: position.y + anchorNode.height,
    centerY: position.y + anchorNode.height / 2
  }

  let snapX = null
  let snapY = null
  const threshold = resolveSnapThreshold()

  guides.value.forEach(guide => {
    const distance = guide.axis === 'vertical' ? guide.pos - moving.left : guide.pos - moving.top
    if (guide.axis === 'vertical') {
      if (Math.abs(distance) <= threshold && (snapX === null || Math.abs(distance) < Math.abs(snapX.delta))) {
        snapX = { delta: distance, line: guide.pos, node: null, guide: true }
      }
    } else if (Math.abs(distance) <= threshold && (snapY === null || Math.abs(distance) < Math.abs(snapY.delta))) {
      snapY = { delta: distance, line: guide.pos, node: null, guide: true }
    }
  })

  activeNodes.value.forEach(other => {
    if (dragState.value.nodeIds.includes(other.id)) {
      return
    }

    const target = {
      left: other.x,
      right: other.x + other.width,
      centerX: other.x + other.width / 2,
      top: other.y,
      bottom: other.y + other.height,
      centerY: other.y + other.height / 2
    }

    ;[
      ['left', 'left'], ['centerX', 'centerX'], ['right', 'right'],
      ['left', 'right'], ['right', 'left']
    ].forEach(([movingKey, targetKey]) => {
      const distance = target[targetKey] - moving[movingKey]
      if (Math.abs(distance) <= threshold && (snapX === null || Math.abs(distance) < Math.abs(snapX.delta))) {
        snapX = { delta: distance, line: target[targetKey], node: other }
      }
    })

    ;[
      ['top', 'top'], ['centerY', 'centerY'], ['bottom', 'bottom'],
      ['top', 'bottom'], ['bottom', 'top']
    ].forEach(([movingKey, targetKey]) => {
      const distance = target[targetKey] - moving[movingKey]
      if (Math.abs(distance) <= threshold && (snapY === null || Math.abs(distance) < Math.abs(snapY.delta))) {
        snapY = { delta: distance, line: target[targetKey], node: other }
      }
    })
  })

  if (snapX) {
    Object.values(previewPositions).forEach(point => { point.x += snapX.delta })
    if (dragState.value) {
      dragState.value.snapDx = (dragState.value.snapDx || 0) + snapX.delta
    }
    const top = snapX.node ? Math.min(position.y, snapX.node.y) - 24 : 0
    const bottom = snapX.node ? Math.max(position.y + anchorNode.height, snapX.node.y + snapX.node.height) + 24 : canvasHeight.value
    dragGuides.value.push({ x1: snapX.line, y1: top, x2: snapX.line, y2: bottom })
  }

  if (snapY) {
    Object.values(previewPositions).forEach(point => { point.y += snapY.delta })
    if (dragState.value) {
      dragState.value.snapDy = (dragState.value.snapDy || 0) + snapY.delta
    }
    const left = snapY.node ? Math.min(position.x, snapY.node.x) - 24 : 0
    const right = snapY.node ? Math.max(position.x + anchorNode.width, snapY.node.x + snapY.node.width) + 24 : canvasWidth.value
    dragGuides.value.push({ x1: left, y1: snapY.line, x2: right, y2: snapY.line })
  }

  applyContainerSnap(anchorNode, previewPositions)
  applyEqualSpacing(anchorNode, previewPositions)
}

// 容器 / 泳道内的内边距吸附：拖进容器后自动留出均匀内边距
function applyContainerSnap(anchorNode, previewPositions) {
  if (!dragState.value) {
    return
  }
  const position = previewPositions[anchorNode.id]
  if (!position) {
    return
  }

  const movingIds = new Set(dragState.value.nodeIds)
  const containers = activeNodes.value.filter(node => (
    !movingIds.has(node.id) && (node.kind === 'container' || node.kind === 'swimlane')
  ))
  if (!containers.length) {
    return
  }

  const result = findContainerSnap({
    box: {
      left: position.x,
      right: position.x + anchorNode.width,
      top: position.y,
      bottom: position.y + anchorNode.height,
      centerX: position.x + anchorNode.width / 2,
      centerY: position.y + anchorNode.height / 2,
      width: anchorNode.width,
      height: anchorNode.height
    },
    containers,
    padding: 24,
    threshold: resolveSnapThreshold()
  })

  if (!result) {
    return
  }

  if (result.dx) {
    Object.values(previewPositions).forEach(point => { point.x += result.dx })
    dragState.value.snapDx = (dragState.value.snapDx || 0) + result.dx
  }
  if (result.dy) {
    Object.values(previewPositions).forEach(point => { point.y += result.dy })
    dragState.value.snapDy = (dragState.value.snapDy || 0) + result.dy
  }
  dragGuides.value.push(...result.guides)
}

// 等间距提示：拖到两个同级节点之间时，把左右（或上下）间距对齐成相等，并画两条提示线
function applyEqualSpacing(anchorNode, previewPositions) {
  if (!dragState.value) {
    return
  }
  const position = previewPositions[anchorNode.id]
  if (!position) {
    return
  }

  const movingIds = new Set(dragState.value.nodeIds)
  const others = activeNodes.value.filter(node => !movingIds.has(node.id))
  if (others.length < 2) {
    return
  }

  const result = findEqualSpacing({
    box: {
      left: position.x,
      right: position.x + anchorNode.width,
      top: position.y,
      bottom: position.y + anchorNode.height,
      centerX: position.x + anchorNode.width / 2,
      centerY: position.y + anchorNode.height / 2,
      width: anchorNode.width,
      height: anchorNode.height
    },
    others,
    threshold: resolveSnapThreshold()
  })

  if (!result) {
    return
  }

  if (result.axis === 'x') {
    Object.values(previewPositions).forEach(point => { point.x += result.delta })
    dragState.value.snapDx = (dragState.value.snapDx || 0) + result.delta
  } else {
    Object.values(previewPositions).forEach(point => { point.y += result.delta })
    dragState.value.snapDy = (dragState.value.snapDy || 0) + result.delta
  }
  dragGuides.value.push(...result.guides)
}

function applyResizeSnap(rect, direction, rotation, nodeId) {
  dragGuides.value = []
  if (altPressed.value || Math.abs(rotation) > 0.001) {
    return rect
  }

  const others = activeNodes.value.filter(node => node.id !== nodeId)
  if (!others.length) {
    return rect
  }

  const result = snapResizeRect({
    rect,
    direction,
    others,
    threshold: resolveSnapThreshold(),
    minSize: MIN_NODE_SIZE
  })

  dragGuides.value = result.guides
  return result.rect
}

function startTextBlockDrag(block, event) {
  if (event.button !== 0) {
    return
  }

  if (layerMap.value.get(block.layerId)?.locked) {
    return
  }

  // 文本块内部真正可编辑/可点击的控件不触发整块拖动；卡片正文和留白都可直接按住拖动。
  if (event.target instanceof Element && event.target.closest(
    'button, input, textarea, a, [contenteditable="true"], .mind-note-block-resize'
  )) {
    return
  }

  props.editorState.commitPendingMindNoteEdit?.()
  window.document.activeElement?.blur?.()
  props.editorState.selectTextBlock(block.id)

  const pointer = resolvePoint(event)
  textBlockDragState.value = {
    blockId: block.id,
    initialPosition: { x: block.x, y: block.y },
    offsetX: pointer.x - block.x,
    offsetY: pointer.y - block.y,
    deltaX: 0,
    deltaY: 0,
    previewPosition: null
  }
  try {
    event.currentTarget.setPointerCapture?.(event.pointerId)
  } catch {
    // 触屏/合成指针在个别浏览器里不支持捕获，窗口级监听仍可完成拖动。
  }
  window.addEventListener('pointermove', onTextBlockPointerMove)
  window.addEventListener('pointerup', endTextBlockDrag)
  window.addEventListener('pointercancel', endTextBlockDrag)
}

function onTextBlockPointerMove(event) {
  if (!textBlockDragState.value) {
    return
  }

  const pointer = resolvePoint(event)
  const deltaX = (pointer.x - textBlockDragState.value.offsetX) - textBlockDragState.value.initialPosition.x
  const deltaY = (pointer.y - textBlockDragState.value.offsetY) - textBlockDragState.value.initialPosition.y
  textBlockDragState.value.deltaX = deltaX
  textBlockDragState.value.deltaY = deltaY
  textBlockDragState.value.previewPosition = {
    x: textBlockDragState.value.initialPosition.x + deltaX,
    y: textBlockDragState.value.initialPosition.y + deltaY
  }
}

function startTextBlockResize(block, event) {
  if (event.button !== 0 || layerMap.value.get(block.layerId)?.locked) {
    return
  }
  props.editorState.commitPendingMindNoteEdit?.()
  window.document.activeElement?.blur?.()
  props.editorState.selectTextBlock(block.id)
  const pointer = resolvePoint(event)
  noteResizeState.value = {
    blockId: block.id,
    startX: pointer.x,
    startY: pointer.y,
    startWidth: Number(block.width) || NOTE_BLOCK_WIDTH,
    startHeight: Number(block.baseHeight || block.height) || 96,
    width: Number(block.width) || NOTE_BLOCK_WIDTH,
    height: Number(block.baseHeight || block.height) || 96
  }
  event.currentTarget.setPointerCapture?.(event.pointerId)
  window.addEventListener('pointermove', onTextBlockResizeMove)
  window.addEventListener('pointerup', endTextBlockResize)
  window.addEventListener('pointercancel', endTextBlockResize)
}

function onTextBlockResizeMove(event) {
  const state = noteResizeState.value
  if (!state) {
    return
  }
  const pointer = resolvePoint(event)
  state.width = Math.round(Math.max(180, Math.min(720, state.startWidth + pointer.x - state.startX)))
  state.height = Math.round(Math.max(80, Math.min(900, state.startHeight + pointer.y - state.startY)))
}

function endTextBlockResize() {
  const state = noteResizeState.value
  noteResizeState.value = null
  window.removeEventListener('pointermove', onTextBlockResizeMove)
  window.removeEventListener('pointerup', endTextBlockResize)
  window.removeEventListener('pointercancel', endTextBlockResize)
  if (state) {
    props.editorState.resizeMindNoteTextBlock(state.blockId, {
      width: state.width,
      height: state.height
    })
  }
}

function handleCanvasPointerDown(event) {
  if (paletteDragItem.value) {
    return
  }

  // 新一次手势开始：上一次框选的抑制不应延续到这一次点击
  suppressCanvasClick.value = false

  // 空白处左键拖动 = 平移画布；Shift+左键 = 框选
  if (event.button === 0 && event.shiftKey) {
    startSelectionMarquee(event)
    return
  }

  startCanvasPan(event)
}

function startCanvasPan(event) {
  const canPanWithLeftButton = event.button === 0
  const canPanWithMiddleButton = event.button === 1
  if (!canPanWithLeftButton && !canPanWithMiddleButton) {
    return
  }

  event.preventDefault()
  const viewport = document.value.content.viewport
  panState.value = {
    startX: event.clientX,
    startY: event.clientY,
    viewportX: viewport.x,
    viewportY: viewport.y,
    moved: false
  }
  window.addEventListener('pointermove', onCanvasPanMove)
  window.addEventListener('pointerup', endCanvasPan)
}

function onCanvasPanMove(event) {
  if (!panState.value) {
    return
  }

  panState.value.moved = panState.value.moved || Math.abs(event.clientX - panState.value.startX) > 4 || Math.abs(event.clientY - panState.value.startY) > 4
  props.editorState.setViewport({
    x: panState.value.viewportX + event.clientX - panState.value.startX,
    y: panState.value.viewportY + event.clientY - panState.value.startY
  })
}

function endCanvasPan() {
  const didMove = Boolean(panState.value?.moved)
  panState.value = null
  window.removeEventListener('pointermove', onCanvasPanMove)
  window.removeEventListener('pointerup', endCanvasPan)
  if (didMove) {
    suppressCanvasClick.value = true
  }
}

function startSelectionMarquee(event) {
  event.preventDefault()
  const point = resolvePoint(event)
  closeEdgeLabelEditor()
  selectionState.value = {
    startPoint: point,
    currentPoint: point
  }
  window.addEventListener('pointermove', onSelectionMarqueeMove)
  window.addEventListener('pointerup', endSelectionMarquee)
  window.addEventListener('pointercancel', endSelectionMarquee)
}

function onSelectionMarqueeMove(event) {
  if (!selectionState.value) {
    return
  }

  selectionState.value = {
    ...selectionState.value,
    currentPoint: resolvePoint(event)
  }
}

function endSelectionMarquee() {
  if (!selectionState.value) {
    return
  }

  const bounds = normalizeSelectionBounds(selectionState.value.startPoint, selectionState.value.currentPoint)
  const shouldSelect = bounds.width > 8 || bounds.height > 8
  if (shouldSelect) {
    const nextSelection = visibleNodes.value
      .filter(node => nodeIntersectsBounds(node, bounds))
      .map(node => node.id)
    setSelectedNodes(nextSelection)
    suppressCanvasClick.value = true
  }

  selectionState.value = null
  window.removeEventListener('pointermove', onSelectionMarqueeMove)
  window.removeEventListener('pointerup', endSelectionMarquee)
  window.removeEventListener('pointercancel', endSelectionMarquee)
}

function syncContainerMembership(movedIds) {
  const containers = activeNodes.value.filter(node => (
    (node.kind === 'container' || node.kind === 'swimlane') && !movedIds.includes(node.id)
  ))
  if (!containers.length) {
    return
  }

  movedIds.forEach(nodeId => {
    const node = activeNodes.value.find(item => item.id === nodeId)
    if (!node || node.kind === 'container' || node.kind === 'swimlane') {
      return
    }

    const centerX = node.x + node.width / 2
    const centerY = node.y + node.height / 2
    const hit = containers.find(container => (
      centerX > container.x &&
      centerX < container.x + container.width &&
      centerY > container.y &&
      centerY < container.y + container.height
    ))

    const nextContainerId = hit ? hit.id : null
    if ((node.containerId || null) !== nextContainerId) {
      props.editorState.setNodeContainer(nodeId, nextContainerId)
    }
  })
}

function clampDragDelta() {
  const state = dragState.value
  if (!state) {
    return { deltaX: 0, deltaY: 0 }
  }

  let minDeltaX = -Infinity
  let maxDeltaX = Infinity
  let minDeltaY = -Infinity
  let maxDeltaY = Infinity

  state.nodeIds.forEach(nodeId => {
    const node = activeNodes.value.find(item => item.id === nodeId)
    const initial = state.initialPositions[nodeId]
    if (!node || !initial) {
      return
    }
    minDeltaX = Math.max(minDeltaX, -initial.x)
    maxDeltaX = Math.min(maxDeltaX, canvasWidth.value - node.width - initial.x)
    minDeltaY = Math.max(minDeltaY, -initial.y)
    maxDeltaY = Math.min(maxDeltaY, canvasHeight.value - node.height - initial.y)
  })

  return {
    deltaX: Math.min(maxDeltaX, Math.max(minDeltaX, state.deltaX)),
    deltaY: Math.min(maxDeltaY, Math.max(minDeltaY, state.deltaY))
  }
}

function endDrag() {
  flushDragMove()
  dragGuides.value = []
  if (dragState.value && (Math.abs(dragState.value.deltaX) > 0.5 || Math.abs(dragState.value.deltaY) > 0.5)) {
    const clamped = clampDragDelta()
    const movedIds = [...dragState.value.nodeIds]
    props.editorState.moveNodes(dragState.value.nodeIds, {
      deltaX: clamped.deltaX + (dragState.value.snapDx || 0),
      deltaY: clamped.deltaY + (dragState.value.snapDy || 0)
    })
    nextTick(() => syncContainerMembership(movedIds))
    treeClickState.value = { nodeId: null, timestamp: 0 }
    suppressNodeClick.value = true
  }
  dragState.value = null
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', endDrag)
}

function endTextBlockDrag() {
  if (textBlockDragState.value && (Math.abs(textBlockDragState.value.deltaX) > 0.5 || Math.abs(textBlockDragState.value.deltaY) > 0.5)) {
    props.editorState.moveMindNoteTextBlock(textBlockDragState.value.blockId, {
      deltaX: textBlockDragState.value.deltaX,
      deltaY: textBlockDragState.value.deltaY
    })
  }

  textBlockDragState.value = null
  window.removeEventListener('pointermove', onTextBlockPointerMove)
  window.removeEventListener('pointerup', endTextBlockDrag)
  window.removeEventListener('pointercancel', endTextBlockDrag)
}

function resolvePoint(event) {
  return resolveClientPoint(event.clientX, event.clientY)
}

function resolveClientPoint(clientX, clientY) {
  const svg = svgRef.value
  if (!svg) {
    return { x: 0, y: 0 }
  }

  const rect = svg.getBoundingClientRect()
  const viewport = document.value.content.viewport
  // svg has viewBox 1200x720 and keeps aspect ratio, so CSS pixels != user units
  const scale = Math.min(rect.width / canvasWidth.value, rect.height / canvasHeight.value) || 1
  const offsetX = (rect.width - canvasWidth.value * scale) / 2
  const offsetY = (rect.height - canvasHeight.value * scale) / 2

  return {
    x: ((clientX - rect.left - offsetX) / scale - viewport.x) / viewport.zoom,
    y: ((clientY - rect.top - offsetY) / scale - viewport.y) / viewport.zoom
  }
}

function getNodePath(node) {
  const { x, y, width: w, height: h, kind } = node
  const cx = x + w / 2
  const cy = y + h / 2

  switch (kind) {
    case 'decision':
      return `M ${cx} ${y} L ${x + w} ${cy} L ${cx} ${y + h} L ${x} ${cy} Z`
    case 'parallelogram':
      return `M ${x + w * 0.15} ${y} L ${x + w} ${y} L ${x + w * 0.85} ${y + h} L ${x} ${y + h} Z`
    case 'document':
      return `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h * 0.8} Q ${x + w * 0.75} ${y + h} ${cx} ${y + h * 0.8} T ${x} ${y + h * 0.8} L ${x} ${y} Z`
    case 'cylinder':
      return `M ${x} ${y + h * 0.1} A ${cx - x} ${h * 0.1} 0 0 1 ${x + w} ${y + h * 0.1} L ${x + w} ${y + h * 0.9} A ${cx - x} ${h * 0.1} 0 0 1 ${x} ${y + h * 0.9} Z M ${x} ${y + h * 0.1} A ${cx - x} ${h * 0.1} 0 0 0 ${x + w} ${y + h * 0.1}`
    case 'hexagon':
      return `M ${x + w * 0.15} ${y} L ${x + w * 0.85} ${y} L ${x + w} ${cy} L ${x + w * 0.85} ${y + h} L ${x + w * 0.15} ${y + h} L ${x} ${cy} Z`
    case 'card':
      return `M ${x + w * 0.16} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} L ${x} ${y + h * 0.2} Z`
    case 'delay':
      return `M ${x} ${y} L ${x + w * 0.72} ${y} Q ${x + w} ${cy} ${x + w * 0.72} ${y + h} L ${x} ${y + h} Z`
    case 'note':
      return `M ${x} ${y} L ${x + w * 0.8} ${y} L ${x + w} ${y + h * 0.22} L ${x + w} ${y + h} L ${x} ${y + h} Z M ${x + w * 0.8} ${y} L ${x + w * 0.8} ${y + h * 0.22} L ${x + w} ${y + h * 0.22}`
    case 'cloud':
      return `M ${x + w * 0.18} ${y + h * 0.74} C ${x + w * 0.02} ${y + h * 0.74}, ${x - 6} ${y + h * 0.44}, ${x + w * 0.16} ${y + h * 0.42} C ${x + w * 0.12} ${y + h * 0.12}, ${x + w * 0.48} ${y - 8}, ${x + w * 0.6} ${y + h * 0.2} C ${x + w * 0.84} ${y + h * 0.06}, ${x + w} ${y + h * 0.34}, ${x + w * 0.88} ${y + h * 0.58} C ${x + w} ${y + h * 0.82}, ${x + w * 0.74} ${y + h}, ${x + w * 0.5} ${y + h * 0.88} C ${x + w * 0.34} ${y + h}, ${x + w * 0.08} ${y + h * 0.94}, ${x + w * 0.18} ${y + h * 0.74} Z`
    case 'ellipse':
      return `M ${x} ${cy} A ${w / 2} ${h / 2} 0 0 1 ${x + w} ${cy} A ${w / 2} ${h / 2} 0 0 1 ${x} ${cy} Z`
    case 'roundrect': {
      const r = Math.min(16, h / 2, w / 4)
      return `M ${x + r} ${y} L ${x + w - r} ${y} A ${r} ${r} 0 0 1 ${x + w} ${y + r} L ${x + w} ${y + h - r} A ${r} ${r} 0 0 1 ${x + w - r} ${y + h} L ${x + r} ${y + h} A ${r} ${r} 0 0 1 ${x} ${y + h - r} L ${x} ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} Z`
    }
    case 'triangle':
      return `M ${cx} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`
    case 'arrow':
      return `M ${x} ${y + h * 0.26} L ${x + w * 0.62} ${y + h * 0.26} L ${x + w * 0.62} ${y} L ${x + w} ${cy} L ${x + w * 0.62} ${y + h} L ${x + w * 0.62} ${y + h * 0.74} L ${x} ${y + h * 0.74} Z`
    case 'container': {
      const header = 34
      return `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z M ${x} ${y + header} L ${x + w} ${y + header}`
    }
    case 'swimlane': {
      const band = 38
      return `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z M ${x} ${y + band} L ${x + w} ${y + band}`
    }
    case 'umlclass': {
      const head = Math.max(32, h * 0.28)
      const mid = head + Math.max(28, (h - head) * 0.42)
      return `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z M ${x} ${y + head} L ${x + w} ${y + head} M ${x} ${y + mid} L ${x + w} ${y + mid}`
    }
    case 'actor': {
      const headRadius = Math.min(w, h) * 0.16
      const headY = y + headRadius + 4
      const bodyTop = headY + headRadius
      const bodyBottom = y + h * 0.62
      const armY = bodyTop + (bodyBottom - bodyTop) * 0.28
      const cxActor = x + w / 2
      return [
        `M ${cxActor} ${headY - headRadius} A ${headRadius} ${headRadius} 0 1 1 ${cxActor - 0.01} ${headY - headRadius} Z`,
        `M ${cxActor} ${bodyTop} L ${cxActor} ${bodyBottom}`,
        `M ${cxActor - w * 0.22} ${armY} L ${cxActor + w * 0.22} ${armY}`,
        `M ${cxActor} ${bodyBottom} L ${cxActor - w * 0.2} ${y + h - 6}`,
        `M ${cxActor} ${bodyBottom} L ${cxActor + w * 0.2} ${y + h - 6}`
      ].join(' ')
    }
    case 'cross':
      return `M ${x + w * 0.34} ${y} L ${x + w * 0.66} ${y} L ${x + w * 0.66} ${y + h * 0.34} L ${x + w} ${y + h * 0.34} L ${x + w} ${y + h * 0.66} L ${x + w * 0.66} ${y + h * 0.66} L ${x + w * 0.66} ${y + h} L ${x + w * 0.34} ${y + h} L ${x + w * 0.34} ${y + h * 0.66} L ${x} ${y + h * 0.66} L ${x} ${y + h * 0.34} L ${x + w * 0.34} ${y + h * 0.34} Z`
    case 'terminator':
      return `M ${x + h / 2} ${y} L ${x + w - h / 2} ${y} A ${h / 2} ${h / 2} 0 0 1 ${x + w} ${cy} A ${h / 2} ${h / 2} 0 0 1 ${x + w - h / 2} ${y + h} L ${x + h / 2} ${y + h} A ${h / 2} ${h / 2} 0 0 1 ${x} ${cy} A ${h / 2} ${h / 2} 0 0 1 ${x + h / 2} ${y} Z`
    default:
      return `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`
  }
}

function resolvePaletteItemStyle(item) {
  void item
  return {}
}

function hexToRgba(hex, alpha = 1) {
  const value = String(hex || '').replace('#', '')
  if (value.length !== 6) {
    return `rgb(9 9 11 / ${alpha})`
  }
  const red = parseInt(value.slice(0, 2), 16)
  const green = parseInt(value.slice(2, 4), 16)
  const blue = parseInt(value.slice(4, 6), 16)
  return `rgb(${red} ${green} ${blue} / ${alpha})`
}

function resolveNodeShapeStyle(node) {
  const palette = resolveAccentPalette(node.style?.accent)
  const isActive = node.id === props.editorState.activeNodeId.value
  const isSelected = selectedNodeIdSet.value.has(node.id)
  const isHovered = node.id === hoveredNodeId.value
  const isSnapTarget = linkPreview.value?.targetId === node.id
  const isSnapSource = linkPreview.value?.sourceId === node.id
  const isSearchHit = searchHitIds.value.has(node.id)
  const isUnderline = isTreeMode.value && topicShapeKind(node) === 'underline'
  const isRootTopic = isTreeMode.value && !node.parentId && node.floating !== true
  const elevation = node.style?.elevation || 'soft'
  const isFrame = node.kind === 'container' || node.kind === 'swimlane'

  const glowAlpha = isRootTopic ? 0.24 : (elevation === 'glow' ? 0.2 : 0.13)
  const glowRadius = isRootTopic ? 22 : (elevation === 'glow' ? 18 : 14)
  const glowOffset = isRootTopic ? 10 : 6
  const shadow = `drop-shadow(0 1px 2px rgb(9 9 11 / 0.07)) drop-shadow(0 ${glowOffset}px ${glowRadius}px ${hexToRgba(palette.stroke, glowAlpha)})`

  const topicAccent = ACCENT_PALETTES[node.style?.accent] ? node.style.accent : 'teal'
  const topicFill = isUnderline || isFrame
    ? 'transparent'
    : (isTreeMode.value ? `url(#node-grad-${topicAccent})` : (isActive || isSelected || isSnapTarget ? palette.fillActive : palette.fill))

  return {
    fill: topicFill,
    stroke: isSearchHit ? '#f59e0b' : (isActive || isSelected || isSnapTarget ? palette.strokeActive : palette.stroke),
    strokeWidth: isSearchHit
      ? 3.4
      : (isActive ? 3 : (isSelected || isHovered || isSnapSource || isSnapTarget ? 2.6 : (isRootTopic ? 2.4 : 2))),
    filter: largeDocument.value || isUnderline ? 'none' : shadow
  }
}

function resolvePaletteAccentPalette(item) {
  return resolveAccentPalette(item.accent || inferPaletteAccent(item.id))
}

function getPaletteFlowchartPath(kind) {
  return getNodePath({
    x: 18,
    y: 14,
    width: 84,
    height: 44,
    kind
  })
}

function getPaletteTreePreview(itemId) {
  switch (itemId) {
    case 'mind-sibling':
      return {
        connectors: [
          { key: 'root-branch', x1: 28, y1: 36, x2: 58, y2: 36 },
          { key: 'upper-branch', x1: 58, y1: 36, x2: 92, y2: 22 },
          { key: 'lower-branch', x1: 58, y1: 36, x2: 92, y2: 50 }
        ],
        rects: [],
        noteLines: [],
        circles: [
          { key: 'root', cx: 24, cy: 36, r: 7 },
          { key: 'bridge', cx: 58, cy: 36, r: 5 },
          { key: 'upper', cx: 96, cy: 22, r: 5 },
          { key: 'lower', cx: 96, cy: 50, r: 5 }
        ]
      }
    case 'note-block':
      return {
        connectors: [
          { key: 'topic-note', x1: 44, y1: 26, x2: 68, y2: 38 }
        ],
        rects: [
          { key: 'topic', x: 18, y: 16, width: 28, height: 18, rx: 9 },
          { key: 'note', x: 70, y: 28, width: 32, height: 24, rx: 8, fill: '#ffffff' }
        ],
        noteLines: [
          { key: 'note-line-1', x1: 77, y1: 37, x2: 95, y2: 37 },
          { key: 'note-line-2', x1: 77, y1: 44, x2: 90, y2: 44 }
        ],
        circles: []
      }
    case 'mind-child':
    default:
      return {
        connectors: [
          { key: 'horizontal', x1: 28, y1: 24, x2: 60, y2: 24 },
          { key: 'vertical', x1: 60, y1: 24, x2: 60, y2: 50 },
          { key: 'child', x1: 60, y1: 50, x2: 92, y2: 50 }
        ],
        rects: [],
        noteLines: [],
        circles: [
          { key: 'root', cx: 24, cy: 24, r: 7 },
          { key: 'joint', cx: 60, cy: 24, r: 5 },
          { key: 'child', cx: 96, cy: 50, r: 6 }
        ]
      }
  }
}

function resolveBoundaryColor(accent) {
  return resolveAccentPalette(accent || 'rose').stroke
}

function hasBoundary(nodeId) {
  return (document.value.content.boundaries || []).some(boundary => boundary.nodeId === nodeId)
}

const NODE_BADGE_SIZE = 18
const NODE_BADGE_GAP = 3

// 主题节点顶部的图标标记：优先级 + 备注角标
function nodeMarkerBadges(node) {
  const badges = []
  if (node.priority) {
    badges.push({
      key: 'priority',
      label: String(node.priority),
      color: PRIORITY_COLORS[node.priority] || PRIORITY_COLORS[9],
      priority: true,
      title: `${t('mindmap.priority')} ${node.priority}`
    })
  }
  ;(node.markers || []).forEach(markerId => {
    const marker = MARKER_LIBRARY.find(item => item.id === markerId)
    if (marker) {
      badges.push({
        key: `marker-${markerId}`,
        markerId,
        label: marker.emoji,
        title: `${t(marker.labelKey)} · ${t('mindmap.markerRemoveHint')}`
      })
    }
  })
  if (node.taskStart || node.taskDue) {
    const range = [node.taskStart, node.taskDue].filter(Boolean).join(' → ')
    badges.push({ key: 'task', label: '📅', title: `${t('mindmap.sectionTask')}：${range}` })
  }
  if (node.note) {
    badges.push({ key: 'note', label: '📝', title: node.note })
  }
  if ((node.attachments || []).length) {
    badges.push({
      key: 'attachments',
      label: '📎',
      title: node.attachments.map(item => item.name).join('、')
    })
  }

  if (!badges.length) {
    return []
  }

  const total = badges.length * NODE_BADGE_SIZE + (badges.length - 1) * NODE_BADGE_GAP
  const startX = node.x + node.width - total
  const y = node.y - NODE_BADGE_SIZE - 6

  return badges.map((badge, index) => ({
    ...badge,
    size: NODE_BADGE_SIZE,
    x: startX + index * (NODE_BADGE_SIZE + NODE_BADGE_GAP),
    y
  }))
}

// 主题节点下方的标签胶囊，放不下就截断
function nodeLabelChips(node) {
  const labels = node.labels || []
  if (!labels.length) {
    return []
  }

  const chips = []
  const maxRight = node.x + node.width
  let cursor = node.x

  labels.forEach(label => {
    const width = Math.min(Math.max(30, label.length * 12 + 16), node.width)
    if (cursor + width > maxRight + 0.5) {
      return
    }
    chips.push({ key: label, label, width, x: cursor, y: node.y + node.height + 6 })
    cursor += width + 4
  })

  return chips
}

function submitNodeLabel(event) {
  const input = event.target
  const value = String(input.value || '').trim()
  if (value) {
    props.editorState.addNodeLabel(value)
  }
  input.value = ''
}

function startRelationship() {
  const nodeId = props.editorState.activeNodeId.value
  if (!nodeId) {
    return
  }

  relationSourceId.value = relationSourceId.value === nodeId ? null : nodeId
}

// 概要作用在选中的同级主题上；先清掉多选（避免对齐工具栏常驻），再创建概要并选中它
function addSummaryFromSelection() {
  const ids = [...summaryNodeIds.value]
  if (!ids.length) {
    return
  }
  setSelectedNodes([])
  props.editorState.addSummary(ids)
}

function topicShapeKind(node) {
  return normalizeTopicShape(node.style?.shape)
}

function roundRectPath(x, y, width, height, radius) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2))
  return `M ${x + r} ${y} L ${x + width - r} ${y} A ${r} ${r} 0 0 1 ${x + width} ${y + r} L ${x + width} ${y + height - r} A ${r} ${r} 0 0 1 ${x + width - r} ${y + height} L ${x + r} ${y + height} A ${r} ${r} 0 0 1 ${x} ${y + height - r} L ${x} ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} Z`
}

function topicShapePath(node) {
  const shape = topicShapeKind(node)
  if (shape === 'ellipse') {
    return getNodePath({ ...node, kind: 'ellipse' })
  }
  if (shape === 'underline') {
    return `M ${node.x} ${node.y + node.height - 2} L ${node.x + node.width} ${node.y + node.height - 2}`
  }
  const radius = shape === 'capsule' ? node.height / 2 : (shape === 'rounded' ? 14 : 3)
  return roundRectPath(node.x, node.y, node.width, node.height, radius)
}

function nodeShapeClass(node) {
  return ['node-shape', {
    locked: node.locked === true,
    active: node.id === props.editorState.activeNodeId.value,
    selected: selectedNodeIdSet.value.has(node.id),
    hovered: node.id === hoveredNodeId.value,
    topic: isTreeMode.value,
    'topic-underline': isTreeMode.value && topicShapeKind(node) === 'underline',
    'search-hit': searchHitIds.value.has(node.id),
    'snap-source': linkPreview.value?.sourceId === node.id,
    'snap-target': linkPreview.value?.targetId === node.id
  }]
}

function nodeLineHeight(node) {
  return resolveTopicTextLayout(node).lineHeight
}

// 编号开启时，把「1.2」这样的序号拼在首行文本前
function nodeDisplayLines(node) {
  const sizing = resolveTopicTextLayout(node)
  const number = nodeNumbers.value.get(node.id)
  if (!number) {
    return sizing.lines
  }
  const lines = [...sizing.lines]
  lines[0] = `${number} ${lines[0]}`
  return lines
}

function resolveNodeLabelY(node) {
  if (isTreeMode.value) {
    const sizing = resolveTopicTextLayout(node)
    return node.y + node.height / 2 + sizing.fontSize * 0.36 - ((sizing.lines.length - 1) * sizing.lineHeight) / 2
  }
  if (node.kind === 'container') {
    return node.y + 21
  }
  if (node.kind === 'swimlane') {
    return node.y + 25
  }
  if (node.kind === 'actor') {
    return node.y + node.height + 14
  }
  if (node.kind === 'umlclass') {
    return node.y + Math.max(32, node.height * 0.28) / 2 + 4
  }
  if (node.image) {
    return node.y + node.height - 10
  }
  return node.y + node.height / 2 + 5
}

function resolveNodeLinkBadge(node) {
  if (node.kind === 'container' || node.kind === 'swimlane') {
    return { x: node.x + node.width - 12, y: node.y + node.height - 12 }
  }
  return { x: node.x + 10, y: node.y + 10 }
}

function resolveNodeImageSrc(value) {
  const raw = String(value || '').trim()
  if (/^data:image\//i.test(raw) || /^blob:/i.test(raw)) {
    return raw
  }
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' ? url.href : ''
  } catch {
    return ''
  }
}

function resolveNodeImageRect(node) {
  if (node.kind === 'container' || node.kind === 'swimlane') {
    return {
      x: node.x + node.width - 32,
      y: node.y + 8,
      width: 22,
      height: 22
    }
  }
  if (node.kind === 'umlclass') {
    return {
      x: node.x + node.width - 30,
      y: node.y + 5,
      width: 20,
      height: 20
    }
  }
  const padding = 8
  const labelSpace = node.text ? 24 : 0
  return {
    x: node.x + padding,
    y: node.y + padding,
    width: Math.max(node.width - padding * 2, 8),
    height: Math.max(node.height - padding * 2 - labelSpace, 8)
  }
}

function openNodeLink(node) {
  if (!node?.link) {
    return
  }
  try {
    const raw = String(node.link || '').trim()
    const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`
    const url = new URL(candidate)
    if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) {
      throw new Error('unsupported link protocol')
    }
    window.open(url.href, '_blank', 'noopener,noreferrer')
  } catch {
    showEditorToast(t('editor.invalidLink'), 'error', 2200)
  }
}

function resolveNodeLabelStyle(node) {
  const style = node.style || {}
  const palette = resolveAccentPalette(style.accent)
  const isActive = selectedNodeIdSet.value.has(node.id) || node.id === props.editorState.activeNodeId.value
  return {
    fill: style.textColor || palette.text,
    fontWeight: style.bold || isActive ? 700 : 500,
    fontStyle: style.italic ? 'italic' : 'normal',
    fontSize: isTreeMode.value ? `${resolveTopicTextLayout(node).fontSize}px` : undefined
  }
}

function resolveEdgeStroke(edge) {
  const palette = resolveAccentPalette(resolveEdgeAccent(edge))
  if (edge.id === props.editorState.activeEdgeId.value) {
    return palette.strokeActive
  }
  if (edge.id === hoveredEdgeId.value) {
    return palette.stroke
  }
  return palette.edge
}

function resolveEdgeWidth(edge) {
  const focus = edge.id === props.editorState.activeEdgeId.value
    ? 0.8
    : (edge.id === hoveredEdgeId.value ? 0.4 : 0)

  if (isTreeMode.value) {
    const depth = nodeDepthMap.value.get(edge.fromNodeId) ?? 0
    const base = depth === 0 ? 2.6 : (depth === 1 ? 2.2 : 1.8)
    return base + focus
  }

  return edge.id === props.editorState.activeEdgeId.value
    ? 2.6
    : (edge.id === hoveredEdgeId.value ? 2.2 : 1.8)
}

function resolveEdgeDasharray(edge) {
  if (edge.style?.stroke === 'dashed') {
    return '12 10'
  }
  if (edge.style?.stroke === 'dotted') {
    return '2 10'
  }
  return null
}

function resolveEdgeMarkerStart(edge) {
  return edge.style?.marker === 'double-arrow' ? 'url(#edge-arrow)' : null
}

const EDGE_MARKER_IDS = {
  arrow: 'edge-arrow',
  dot: 'edge-dot',
  diamond: 'edge-diamond',
  square: 'edge-square'
}

function resolveEdgeMarkerEnd(edge) {
  const marker = edge.style?.marker
  if (!marker || marker === 'none') {
    return null
  }
  const markerId = marker === 'double-arrow' ? 'edge-arrow' : EDGE_MARKER_IDS[marker]
  return markerId ? `url(#${markerId})` : null
}

function resolveEdgeLabelStyle(edge) {
  const palette = resolveAccentPalette(resolveEdgeAccent(edge))
  return {
    fill: 'rgba(255, 255, 255, 0.94)',
    stroke: edge.id === props.editorState.activeEdgeId.value ? palette.strokeActive : palette.stroke
  }
}

function resolveEdgeAccent(edge) {
  const override = edge.style?.accent
  if (override && ACCENT_PALETTES[override]) {
    return override
  }

  const fromNode = activeNodes.value.find(node => node.id === edge.fromNodeId)
  if (isTreeMode.value) {
    return fromNode?.style?.accent || 'teal'
  }
  return fromNode?.style?.accent || 'blue'
}

function inferPaletteAccent(itemId) {
  const accentMap = {
    process: 'teal',
    terminator: 'rose',
    decision: 'amber',
    ellipse: 'sky',
    parallelogram: 'violet',
    document: 'rose',
    cylinder: 'emerald',
    hexagon: 'amber',
    card: 'blue',
    delay: 'slate',
    note: 'violet',
    cloud: 'sky',
    'mind-sibling': 'amber',
    'mind-child': 'teal',
    'note-block': 'violet'
  }
  return accentMap[itemId] || 'teal'
}

function resolveAccentPalette(accent = 'teal') {
  return ACCENT_PALETTES[accent] || ACCENT_PALETTES.teal
}

function showEditorToast(message, tone = 'success', duration = 1600) {
  clearEditorToastTimer()
  editorToast.value = {
    visible: true,
    message,
    tone
  }

  editorToastTimer = window.setTimeout(() => {
    editorToast.value = {
      visible: false,
      message: '',
      tone
    }
    editorToastTimer = null
  }, duration)
}

function clearEditorToastTimer() {
  if (!editorToastTimer) {
    return
  }

  window.clearTimeout(editorToastTimer)
  editorToastTimer = null
}

function resolveInlineNodeEditorHeight(node) {
  return Math.min(Math.max(node.height - 16, 28), 44)
}

function isEdgePresetActive(preset) {
  if (!selectedEdgeStyle.value) {
    return false
  }

  return Object.entries(preset.style).every(([key, value]) => selectedEdgeStyle.value[key] === value)
}

function handleNodeClick(node, event) {
  if (suppressNodeClick.value) {
    suppressNodeClick.value = false
    return
  }

  if (connectState.value) {
    const state = connectState.value
    if (node.id === state.fromNodeId) {
      stopConnectTracking()
      return
    }
    const fromNode = document.value.content.nodes.find(item => item.id === state.fromNodeId)
    if (!fromNode) {
      stopConnectTracking()
      return
    }
    const connection = resolveConnection(fromNode, node)
    connection.fromAnchor = state.fromAnchor
    stopConnectTracking()
    props.editorState.addEdge(connection)
    props.editorState.selectNode(node.id)
    inspectorOpen.value = false
    return
  }

  // 点元素就打开属性抽屉（重复点同一个元素也要能打开）
  inspectorOpen.value = true

  if (relationSourceId.value) {
    const sourceId = relationSourceId.value
    relationSourceId.value = null
    if (node.id !== sourceId) {
      props.editorState.addRelationship(sourceId, node.id)
      props.editorState.selectNode(node.id)
    }
    return
  }

  closeEdgeLabelEditor()

  if ((event?.ctrlKey || event?.metaKey) && node.link) {
    event.preventDefault()
    event.stopPropagation()
    openNodeLink(node)
    return
  }

  if (!event?.shiftKey && node.groupId) {
    const members = activeNodes.value.filter(item => item.groupId === node.groupId).map(item => item.id)
    if (members.length > 1) {
      setSelectedNodes(members)
      return
    }
  }

  if (event?.shiftKey) {
    treeClickState.value = { nodeId: null, timestamp: 0 }
    toggleSelectedNode(node.id)
    return
  }

  const hadMultipleSelection = selectedNodeIds.value.length > 1
  selectedNodeIds.value = []

  if (hadMultipleSelection) {
    treeClickState.value = { nodeId: null, timestamp: 0 }
    props.editorState.selectNode(node.id)
    return
  }

  if (isTreeMode.value) {
    const now = Date.now()
    const elapsed = now - treeClickState.value.timestamp
    // 双击的第二次 click（间隔很短）不应该被当成"连点两次折叠"，
    // 否则双击进编辑时会把分支折叠掉，并把刚出现的输入框顶掉。
    const repeatedTreeClick = treeClickState.value.nodeId === node.id && elapsed >= 320 && elapsed < 900
    treeClickState.value = { nodeId: node.id, timestamp: now }

    if (repeatedTreeClick) {
      props.editorState.toggleCollapse(node.id)
      return
    }
    props.editorState.selectNode(node.id)
    return
  }

  props.editorState.selectNode(node.id)
}

function handleEdgeClick(edge) {
  if (connectState.value) {
    stopConnectTracking()
  }
  inspectorOpen.value = true
  treeClickState.value = { nodeId: null, timestamp: 0 }
  closeEdgeLabelEditor()
  props.editorState.selectEdge(edge.id)
}

function handleNodeHover(nodeId) {
  hoveredNodeId.value = nodeId
}

function handleEdgeHover(edgeId) {
  hoveredEdgeId.value = edgeId
}

function openTextOverlay(nodeId) {
  const node = document.value.content.nodes.find(item => item.id === nodeId)
  if (!node || layerMap.value.get(node.layerId)?.locked) {
    return
  }
  treeClickState.value = { nodeId: null, timestamp: 0 }
  closeEdgeLabelEditor()
  textOverlay.start(nodeId)
  textOverlayOpenedAt = Date.now()

  // 动态插入的 <input> 上的 autofocus 在浏览器里基本不生效，
  // 必须渲染完成后手动 focus + 全选，否则双击后还得再点一次才能输入。
  nextTick(() => {
    syncOverlayAnchor()
    focusNodeTextInput()
  })
  // 兜底：双击的第二次 mousedown/click 可能把焦点抢回 body，延后再补一次
  window.setTimeout(() => {
    syncOverlayAnchor()
    focusNodeTextInput()
  }, 160)
}

function focusNodeTextInput() {
  const input = nodeTextInputRef.value
  if (!input || !textOverlay.editingNodeId.value) {
    return
  }
  if (document.activeElement === input) {
    return
  }
  input.focus({ preventScroll: true })
  input.select()
}

// 打开的一瞬间浏览器可能把焦点抢走，这类 blur 不算"用户离开"，不提交
function handleTextOverlayBlur() {
  if (!textOverlay.editingNodeId.value) {
    return
  }
  if (Date.now() - textOverlayOpenedAt < 250) {
    nextTick(focusNodeTextInput)
    return
  }

  // 悬停/重渲染可能造成瞬时失焦：等一小会儿，焦点回来了就不提交
  window.clearTimeout(textOverlayBlurTimer)
  textOverlayBlurTimer = window.setTimeout(() => {
    textOverlayBlurTimer = null
    if (!textOverlay.editingNodeId.value) {
      return
    }
    const input = nodeTextInputRef.value
    if (input && document.activeElement === input) {
      return
    }
    submitTextOverlay()
  }, 120)
}

function handleTextOverlayFocus() {
  window.clearTimeout(textOverlayBlurTimer)
  textOverlayBlurTimer = null
}

function stopOverlayPointerTracking() {
  overlayDragPointer = null
  window.removeEventListener('pointermove', handleOverlayPointerMove)
  window.removeEventListener('pointerup', handleOverlayPointerUp)
  window.removeEventListener('pointercancel', handleOverlayPointerUp)
}

// 编辑框覆盖在节点正上方时，用户仍然可以直接按住节点拖动。
// 先按住再移动超过阈值 = 提交当前文字并拖动节点；原地点击 = 正常进入文字编辑。
function handleOverlayPointerDown(node, event) {
  if (!node || event.button !== 0 || event.isPrimary === false) {
    return
  }
  stopOverlayPointerTracking()
  overlayDragPointer = {
    node,
    event,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    dragging: false
  }
  window.addEventListener('pointermove', handleOverlayPointerMove, { passive: false })
  window.addEventListener('pointerup', handleOverlayPointerUp)
  window.addEventListener('pointercancel', handleOverlayPointerUp)
}

function handleOverlayPointerMove(event) {
  const state = overlayDragPointer
  if (!state || event.pointerId !== state.pointerId || state.dragging) {
    return
  }
  const distance = Math.hypot(event.clientX - state.startX, event.clientY - state.startY)
  if (distance < 7) {
    return
  }

  state.dragging = true
  event.preventDefault()
  window.getSelection?.()?.removeAllRanges?.()
  submitTextOverlay()
  startDrag(state.node, state.event)
  applyDragMove(event)
}

function handleOverlayPointerUp(event) {
  if (!overlayDragPointer || event.pointerId !== overlayDragPointer.pointerId) {
    return
  }
  stopOverlayPointerTracking()
}

// 点击输入框以外的任何地方（工具栏/面板/画布）都视为「编辑结束」→ 保存。
// 只监听 pointerdown，不会因为鼠标移动而触发。
function handleDocumentPointerDown(event) {
  if (!textOverlay.editingNodeId.value) {
    return
  }
  const input = nodeTextInputRef.value
  if (input && (event.target === input || input.contains?.(event.target))) {
    return
  }
  window.clearTimeout(textOverlayBlurTimer)
  textOverlayBlurTimer = null
  submitTextOverlay()
}

function submitTextOverlay() {
  textOverlay.submit((nodeId, nextText) => {
    props.editorState.updateNodeText(nodeId, nextText)
  })
}

// 编辑主题文字时：Tab = 确认并新建子主题，Enter = 确认并新建同级主题（仅思维导图/思维笔记）
function submitTextOverlayWithShortcut(kind) {
  const editingId = textOverlay.editingNodeId.value
  submitTextOverlay()

  if (!isTreeMode.value || !editingId || kind === 'none') {
    return
  }

  if (kind === 'child') {
    props.editorState.addMindmapChildBranch(editingId)
  } else if (kind === 'sibling') {
    props.editorState.addMindmapSiblingBranch(editingId)
  }

  // 新建出来的主题直接进入编辑态，连续输入不用再双击
  const createdId = props.editorState.activeNodeId.value
  if (createdId) {
    nextTick(() => openTextOverlay(createdId))
  }
}

// 面板里的「+ 子主题 / + 同级」按钮：快捷键失灵时的可靠入口
function addChildTopicFromPanel() {
  const node = selectedNode.value
  if (!node) {
    return
  }
  props.editorState.addMindmapChildBranch(node.id)
  const createdId = props.editorState.activeNodeId.value
  if (createdId) {
    nextTick(() => openTextOverlay(createdId))
  }
}

function addSiblingTopicFromPanel() {
  const node = selectedNode.value
  if (!node) {
    return
  }
  props.editorState.addMindmapSiblingBranch(node.id)
  const createdId = props.editorState.activeNodeId.value
  if (createdId) {
    nextTick(() => openTextOverlay(createdId))
  }
}

// 在右侧属性面板改完文字按 Tab：先落库再新建子主题（否则焦点会跳到下一个输入框）
function applyNodeTextFieldAndAddChild(event) {
  const input = event?.target
  const node = selectedNode.value
  if (!node) {
    return
  }

  const text = String(input?.value ?? node.text ?? '')
  props.editorState.updateNodeRect(node.id, { text })
  if (input) {
    input.value = text
  }

  if (!isTreeMode.value) {
    return
  }

  props.editorState.addMindmapChildBranch(node.id)
  const createdId = props.editorState.activeNodeId.value
  if (createdId) {
    nextTick(() => openTextOverlay(createdId))
  }
}

function handleCanvasWheel(event) {
  // Ctrl / ⌘ + 滚轮才缩放；普通滚轮 = 平移画布（符合大多数白板/绘图工具的习惯）
  if (event.ctrlKey || event.metaKey) {
    props.editorState.zoomBy(event.deltaY > 0 ? -0.1 : 0.1)
    return
  }

  const dx = Number(event.deltaX) || 0
  const dy = Number(event.deltaY) || 0
  if (!dx && !dy) {
    return
  }

  // 触控板常见的横向/纵向滑动；Shift+滚轮也按横向处理
  const panX = event.shiftKey && !dx ? -dy : -dx
  const panY = event.shiftKey && !dx ? 0 : -dy
  props.editorState.panBy(panX, panY)
}

function handleCanvasClick() {
  if (connectState.value) {
    stopConnectTracking()
  }
  closeInspector()
  // 点空白处即保存正在编辑的主题文字
  if (textOverlay.editingNodeId.value) {
    window.clearTimeout(textOverlayBlurTimer)
    textOverlayBlurTimer = null
    submitTextOverlay()
  }

  if (suppressCanvasClick.value) {
    suppressCanvasClick.value = false
    return
  }

  treeClickState.value = { nodeId: null, timestamp: 0 }
  closeEdgeLabelEditor()
  selectedNodeIds.value = []
  props.editorState.clearSelection()
}

function handleCanvasPointerUp(event) {
  if (!paletteDragItem.value || dragState.value || paletteDropHandled.value) {
    return
  }

  commitPaletteDrop(paletteDragItem.value, resolveClientPoint(event.clientX, event.clientY))
  paletteDragItem.value = null
  canvasDragInside.value = false
  lastCanvasDragPoint.value = null
}

function handleCanvasPointerUpOnSvg(event) {
  endDrag()
  handleCanvasPointerUp(event)
}

function primePaletteDrag(item, event) {
  if (event?.button !== 0) {
    return
  }

  paletteDragItem.value = item.id
  paletteDropHandled.value = false
  palettePointerState.value = {
    pointerId: event?.pointerId ?? null
  }
  window.addEventListener('pointermove', onPalettePointerMove)
  window.addEventListener('pointerup', onPalettePointerUp)
  window.addEventListener('pointercancel', onPalettePointerCancel)
}

function startPaletteDrag(item, event) {
  paletteDragItem.value = item.id
  paletteDropHandled.value = false
  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData('text/plain', item.id)
}

function endPaletteDrag(event) {
  const dragEndPoint = resolvePaletteDragEndPoint(event)
  if (paletteDragItem.value && dragEndPoint && !paletteDropHandled.value) {
    commitPaletteDrop(paletteDragItem.value, dragEndPoint)
  }

  stopPalettePointerTracking()
  paletteDragItem.value = null
  paletteDropHandled.value = false
  canvasDragInside.value = false
  lastCanvasDragPoint.value = null
  event.currentTarget?.blur?.()
}

function onPalettePointerMove(event) {
  if (!palettePointerState.value || !isMatchingPalettePointer(event)) {
    return
  }

  const point = resolveCanvasPointFromClient(event.clientX, event.clientY)
  canvasDragInside.value = Boolean(point)
  if (point) {
    lastCanvasDragPoint.value = point
  }
}

function onPalettePointerUp(event) {
  if (!palettePointerState.value || !isMatchingPalettePointer(event)) {
    return
  }

  const point = resolveCanvasPointFromClient(event.clientX, event.clientY) || lastCanvasDragPoint.value
  let didCommit = false
  if (paletteDragItem.value && point && !paletteDropHandled.value) {
    closeEdgeLabelEditor()
    commitPaletteDrop(paletteDragItem.value, point)
    didCommit = true
  }

  stopPalettePointerTracking()
  paletteDragItem.value = null
  if (!didCommit) {
    paletteDropHandled.value = false
  }
  canvasDragInside.value = false
  lastCanvasDragPoint.value = null
}

function onPalettePointerCancel(event) {
  if (!palettePointerState.value || !isMatchingPalettePointer(event)) {
    return
  }

  stopPalettePointerTracking()
  paletteDragItem.value = null
  paletteDropHandled.value = false
  canvasDragInside.value = false
  lastCanvasDragPoint.value = null
}

function handleCanvasDragEnter(event) {
  if (!paletteDragItem.value) {
    return
  }

  canvasDragInside.value = true
  lastCanvasDragPoint.value = resolveClientPoint(event.clientX, event.clientY)
}

function handleCanvasDragOver(event) {
  if (!paletteDragItem.value) {
    return
  }

  canvasDragInside.value = true
  lastCanvasDragPoint.value = resolveClientPoint(event.clientX, event.clientY)
}

function handleCanvasDragLeave(event) {
  if (!paletteDragItem.value) {
    return
  }

  if (event.currentTarget?.contains?.(event.relatedTarget)) {
    return
  }

  canvasDragInside.value = false
}

function handleCanvasDrop(event) {
  const itemId = event.dataTransfer?.getData('text/plain') || paletteDragItem.value
  closeEdgeLabelEditor()
  if (!itemId || paletteDropHandled.value) {
    return
  }

  const point = resolveClientPoint(event.clientX, event.clientY)
  commitPaletteDrop(itemId, point)
  paletteDragItem.value = null
  canvasDragInside.value = false
  lastCanvasDragPoint.value = null
}

function commitPaletteDrop(itemId, point) {
  if (paletteDropHandled.value) {
    return
  }

  applyCanvasDrop(itemId, point)
  paletteDropHandled.value = true
}

function stopPalettePointerTracking() {
  palettePointerState.value = null
  window.removeEventListener('pointermove', onPalettePointerMove)
  window.removeEventListener('pointerup', onPalettePointerUp)
  window.removeEventListener('pointercancel', onPalettePointerCancel)
}

function isMatchingPalettePointer(event) {
  return palettePointerState.value?.pointerId == null || event.pointerId === palettePointerState.value.pointerId
}

function resolveFallbackDropPoint() {
  // Never invent a drop position: a wrong spot is worse than a no-op.
  const last = lastCanvasDragPoint.value
  if (last) {
    return last
  }

  return null
}

function resolveCanvasPointFromClient(clientX, clientY) {
  const canvasRect = canvasCardRef.value?.getBoundingClientRect?.()
  if (!canvasRect || !Number.isFinite(clientX) || !Number.isFinite(clientY)) {
    return null
  }

  const isInsideCanvas = clientX >= canvasRect.left && clientX <= canvasRect.right && clientY >= canvasRect.top && clientY <= canvasRect.bottom
  if (!isInsideCanvas) {
    return null
  }

  return resolveClientPoint(clientX, clientY)
}

function resolvePaletteDragEndPoint(event) {
  if (lastCanvasDragPoint.value) {
    return lastCanvasDragPoint.value
  }

  if (!canvasDragInside.value) {
    return null
  }

  const clientX = Number(event?.clientX)
  const clientY = Number(event?.clientY)
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
    return resolveFallbackDropPoint()
  }

  return resolveCanvasPointFromClient(clientX, clientY) || resolveFallbackDropPoint()
}

function applyCanvasDrop(itemId, point) {
  if (!itemId || !point) {
    return
  }

  if (document.value.mode === 'flowchart') {
    const size = getFlowchartNodeSize(itemId)
    const centerX = Math.round(point.x / DROP_GRID) * DROP_GRID
    const centerY = Math.round(point.y / DROP_GRID) * DROP_GRID
    props.editorState.addNode(itemId, {
      x: Math.max(0, centerX - size.width / 2),
      y: Math.max(0, centerY - size.height / 2)
    })
    return
  }

  const dropTargetNode = resolveDropTargetNode(point)
  const targetNodeId = dropTargetNode?.id || props.editorState.activeNodeId.value || document.value.content.nodes[0]?.id || null

  if (itemId === 'mind-sibling') {
    props.editorState.addMindmapSiblingBranch(targetNodeId)
    return
  }
  if (itemId === 'mind-child') {
    props.editorState.addMindmapChildBranch(targetNodeId)
    return
  }
  if (itemId === 'note-block') {
    if ((document.value.mode === 'mindmap' || document.value.mode === 'mind-note') && targetNodeId) {
      props.editorState.addMindNoteTextBlock(targetNodeId)
    }
  }
}

function setSelectedNodes(nodeIds) {
  const uniqueNodeIds = [...new Set((nodeIds || []).filter(Boolean))]
  selectedNodeIds.value = uniqueNodeIds
  if (uniqueNodeIds.length) {
    props.editorState.selectNode(uniqueNodeIds[0])
    return
  }
  props.editorState.clearSelection()
}

function toggleSelectedNode(nodeId) {
  if (!nodeId) {
    return
  }

  // 普通点击只 set active，首次 Shift 点击时把它补进多选集
  let current = [...selectedNodeIds.value]
  const activeId = props.editorState.activeNodeId.value
  if (!current.length && activeId && activeId !== nodeId) {
    current = [activeId]
  }

  if (current.includes(nodeId)) {
    setSelectedNodes(current.filter(currentId => currentId !== nodeId))
    return
  }

  setSelectedNodes([...current, nodeId])
}

function normalizeSelectionBounds(startPoint, endPoint) {
  return {
    x: Math.min(startPoint.x, endPoint.x),
    y: Math.min(startPoint.y, endPoint.y),
    width: Math.abs(endPoint.x - startPoint.x),
    height: Math.abs(endPoint.y - startPoint.y)
  }
}

function nodeIntersectsBounds(node, bounds) {
  return !(node.x + node.width < bounds.x || node.x > bounds.x + bounds.width || node.y + node.height < bounds.y || node.y > bounds.y + bounds.height)
}

function openEdgeLabelEditor(edge) {
  props.editorState.selectEdge(edge.id)
  edgeLabelEditor.value = {
    edgeId: edge.id,
    x: edge.labelPosition.x,
    y: edge.labelPosition.y,
    text: edge.label || ''
  }
}

function submitEdgeLabelEditor() {
  if (!edgeLabelEditor.value) {
    return
  }
  props.editorState.updateEdgeLabel(edgeLabelEditor.value.edgeId, edgeLabelEditor.value.text)
  closeEdgeLabelEditor()
}

function closeEdgeLabelEditor() {
  edgeLabelEditor.value = null
}

function showAnchorHints(node) {
  return document.value.mode === 'flowchart' && (
    node.id === props.editorState.activeNodeId.value ||
    node.id === hoveredNodeId.value ||
    linkPreview.value?.targetId === node.id
  )
}

function resolveNodeAnchors(node) {
  return [
    { key: `${node.id}-top`, name: 'top', x: node.x + node.width / 2, y: node.y },
    { key: `${node.id}-right`, name: 'right', x: node.x + node.width, y: node.y + node.height / 2 },
    { key: `${node.id}-bottom`, name: 'bottom', x: node.x + node.width / 2, y: node.y + node.height },
    { key: `${node.id}-left`, name: 'left', x: node.x, y: node.y + node.height / 2 }
  ]
}

// 连接点圆点向节点外侧偏移，避免和同位置的缩放手柄争抢指针事件。
const NODE_ANCHOR_DISPLAY_OFFSET = 11

function resolveNodeAnchorDisplayPoint(anchor) {
  const offset = NODE_ANCHOR_DISPLAY_OFFSET
  if (anchor.name === 'top') return { x: anchor.x, y: anchor.y - offset }
  if (anchor.name === 'right') return { x: anchor.x + offset, y: anchor.y }
  if (anchor.name === 'bottom') return { x: anchor.x, y: anchor.y + offset }
  return { x: anchor.x - offset, y: anchor.y }
}

function resolveAnchorPoint(node, anchorName) {
  const cx = node.x + node.width / 2
  const cy = node.y + node.height / 2
  if (anchorName === 'top') return { x: cx, y: node.y }
  if (anchorName === 'bottom') return { x: cx, y: node.y + node.height }
  if (anchorName === 'left') return { x: node.x, y: cy }
  return { x: node.x + node.width, y: cy }
}

const EXPORT_INTERACTIVE_SELECTORS = [
  '.selection-marquee',
  '.guide-layer',
  '.align-guides',
  '.resize-handles',
  '.edge-handles',
  '.connect-preview',
  '.edge-drag-preview',
  '.node-anchor-hints',
  '.node-header-hit',
  '.link-preview-layer',
  '.group-outlines',
  '.mindmap-summary-hit',
  '.inline-node-editor',
  '.inline-edge-editor'
]

const SVG_EXPORT_STYLE_PROPS = [
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-dasharray',
  'stroke-linecap',
  'stroke-linejoin',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'text-anchor',
  'dominant-baseline',
  'letter-spacing',
  'opacity',
  'visibility',
  'paint-order',
  'filter'
]

// 导出前生成一份干净的 SVG 副本：去掉交互层、网格和 data-testid，并把思维笔记的文本块画进 SVG。
// 这样 PNG/JPG/PDF/SVG 都不会再把 HTML 容器当成纯文本导出。
async function buildExportSvgClone(options = {}) {
  const svg = svgRef.value
  if (!svg) {
    return null
  }

  const clone = svg.cloneNode(true)
  inlineSvgComputedStyles(svg, clone)
  // 导出不跟随用户当前的平移/缩放；统一回到画布坐标，文本块和图形才能对齐
  const transformLayer = clone.querySelector('.canvas-transform')
  if (transformLayer) {
    transformLayer.setAttribute('transform', 'translate(0 0) scale(1)')
  }
  const surface = clone.querySelector('[data-testid="canvas-surface"]')
  if (surface) {
    surface.setAttribute('fill', '#ffffff')
    surface.style.setProperty('fill', '#ffffff')
  }
  EXPORT_INTERACTIVE_SELECTORS.forEach(selector => {
    clone.querySelectorAll(selector).forEach(element => element.remove())
  })
  clone.querySelectorAll('[data-testid]').forEach(element => element.removeAttribute('data-testid'))
  await appendTextBlocksToExportSvg(clone)

  if (options.cropToContent) {
    const bounds = resolveExportContentBounds()
    if (bounds) {
      clone.setAttribute('viewBox', `${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`)
    }
  }
  return clone
}

function resolveExportNodeBounds(node) {
  const x = Number(node.x) || 0
  const y = Number(node.y) || 0
  const width = Number(node.width) || 0
  const height = Number(node.height) || 0
  const rotation = Number(node.rotation) || 0
  if (!rotation) {
    return { x, y, width, height }
  }

  const radians = (rotation * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const centerX = x + width / 2
  const centerY = y + height / 2
  const corners = [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height }
  ].map(corner => {
    const dx = corner.x - centerX
    const dy = corner.y - centerY
    return {
      x: centerX + dx * cos - dy * sin,
      y: centerY + dx * sin + dy * cos
    }
  })
  const left = Math.min(...corners.map(corner => corner.x))
  const top = Math.min(...corners.map(corner => corner.y))
  return {
    x: left,
    y: top,
    width: Math.max(...corners.map(corner => corner.x)) - left,
    height: Math.max(...corners.map(corner => corner.y)) - top
  }
}

// 图片/SVG 导出时裁到实际内容范围，避免 1200×720 画布上只有左上角一小块内容。
function resolveExportContentBounds() {
  const page = document.value.content.page || { width: 1200, height: 720 }
  const boxes = []
  visibleNodes.value.forEach(node => {
    boxes.push(resolveExportNodeBounds(node))
  })
  visibleEdges.value.forEach(edge => {
    ;(edge.points || []).forEach(point => boxes.push({ x: point.x, y: point.y, width: 0, height: 0 }))
    if (edge.labelPosition) {
      boxes.push({ x: edge.labelPosition.x - 56, y: edge.labelPosition.y - 18, width: 112, height: 36 })
    }
  })
  exportTextBlocks.value.forEach(block => {
    boxes.push({
      x: block.x,
      y: block.y,
      width: Math.max(180, Number(block.width) || NOTE_BLOCK_WIDTH),
      height: Math.max(80, Number(block.baseHeight || block.height) || 120)
    })
  })
  if (!boxes.length) {
    return null
  }

  const padding = 48
  const left = Math.max(0, Math.min(...boxes.map(box => box.x)) - padding)
  const top = Math.max(0, Math.min(...boxes.map(box => box.y)) - padding)
  const right = Math.min(Number(page.width) || 1200, Math.max(...boxes.map(box => box.x + box.width)) + padding)
  const bottom = Math.min(Number(page.height) || 720, Math.max(...boxes.map(box => box.y + box.height)) + padding)
  return {
    x: left,
    y: top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top)
  }
}

// SVG 里的图形大量依赖外部 CSS 类；直接序列化会丢样式（链接角标、标签、字体等）。
// 把当前计算样式写回副本的 style 属性，保证导出的 SVG/PNG/PDF 与画布一致。
function inlineSvgComputedStyles(source, clone) {
  const sourceElements = [source, ...source.querySelectorAll('*')]
  const cloneElements = [clone, ...clone.querySelectorAll('*')]
  if (sourceElements.length !== cloneElements.length) {
    return
  }

  sourceElements.forEach((sourceElement, index) => {
    const target = cloneElements[index]
    if (!target?.style) {
      return
    }
    const computed = window.getComputedStyle(sourceElement)
    SVG_EXPORT_STYLE_PROPS.forEach(property => {
      const value = computed.getPropertyValue(property)
      if (!value || value === 'normal' || value === 'auto') {
        return
      }
      target.style.setProperty(property, value)
    })
  })
}

async function appendTextBlocksToExportSvg(svg) {
  if (!exportTextBlocks.value.length) {
    return
  }

  const NS = 'http://www.w3.org/2000/svg'
  const layer = window.document.createElementNS(NS, 'g')
  layer.setAttribute('class', 'export-text-block-layer')

  for (const block of exportTextBlocks.value) {
    const x = Number(block.x) || 0
    const y = Number(block.y) || 0
    const width = Math.max(180, Number(block.width) || NOTE_BLOCK_WIDTH)
    const height = Math.max(80, Number(block.baseHeight || block.height) || 120)
    const group = window.document.createElementNS(NS, 'g')

    const rect = window.document.createElementNS(NS, 'rect')
    rect.setAttribute('x', String(x))
    rect.setAttribute('y', String(y))
    rect.setAttribute('width', String(width))
    rect.setAttribute('height', String(height))
    rect.setAttribute('rx', '18')
    rect.setAttribute('fill', '#ffffff')
    rect.setAttribute('stroke', 'rgba(148, 163, 184, 0.42)')
    group.appendChild(rect)

    const temp = window.document.createElement('div')
    temp.style.cssText = `position:fixed;left:-10000px;top:0;width:${Math.max(120, width - 24)}px;box-sizing:border-box;background:transparent;`
    temp.innerHTML = block.html || ''
    if (!temp.firstChild) {
      temp.textContent = block.text || ''
    }
    window.document.body.appendChild(temp)
    try {
      const dataUrl = await renderHtmlElementToDataUrl(temp, {
        width,
        height,
        scale: 2,
        margin: 12
      })
      const image = window.document.createElementNS(NS, 'image')
      image.setAttribute('x', String(x))
      image.setAttribute('y', String(y))
      image.setAttribute('width', String(width))
      image.setAttribute('height', String(height))
      image.setAttribute('preserveAspectRatio', 'xMinYMin meet')
      image.setAttribute('href', dataUrl)
      group.appendChild(image)
    } catch {
      appendTextBlockFallback(group, block, x, y, width, height)
    } finally {
      temp.remove()
    }
    layer.appendChild(group)
  }

  svg.appendChild(layer)
}

function appendTextBlockFallback(group, block, x, y, width, height) {
  const NS = 'http://www.w3.org/2000/svg'
  const padding = 14
  const lineHeight = 19
  const maxUnits = Math.max(10, Math.floor((width - padding * 2) / 7))
  const lines = wrapExportText(resolveExportTextBlockText(block), maxUnits)
  const text = window.document.createElementNS(NS, 'text')
  text.setAttribute('x', String(x + padding))
  text.setAttribute('y', String(y + 26))
  text.setAttribute('fill', '#0f172a')
  text.setAttribute('font-family', 'Consolas, Monaco, monospace')
  text.setAttribute('font-size', '13.5')

  lines.slice(0, Math.max(1, Math.floor((height - 28) / lineHeight))).forEach((line, index) => {
    const tspan = window.document.createElementNS(NS, 'tspan')
    tspan.setAttribute('x', String(x + padding))
    tspan.setAttribute('dy', index === 0 ? '0' : String(lineHeight))
    tspan.textContent = line || ' '
    text.appendChild(tspan)
  })

  group.appendChild(text)
}

function resolveExportTextBlockText(block) {
  const value = String(block.text || '')
  if (block.format !== 'list') {
    return value
  }
  return value
    .split(/\r?\n/)
    .map(line => (line.trim() ? `• ${line}` : ''))
    .join('\n')
}

function wrapExportText(value, maxUnits = 26) {
  const output = []
  String(value ?? '').split(/\r?\n/).forEach(sourceLine => {
    if (!sourceLine) {
      output.push('')
      return
    }
    let line = ''
    let units = 0
    for (const char of sourceLine) {
      const width = /[\u0000-\u00ff]/.test(char) ? 1 : 2
      if (line && units + width > maxUnits) {
        output.push(line)
        line = ''
        units = 0
      }
      line += char
      units += width
    }
    output.push(line)
  })
  return output.length ? output : ['']
}

function resolveExportBaseName() {
  const title = document.value.title || 'diagram'
  const pages = document.value.content.pages || []
  if (pages.length <= 1) {
    return title
  }
  const activePage = pages.find(page => page.id === document.value.content.activePageId)
  return activePage?.name ? `${title}-${activePage.name}` : title
}

async function handleExportPdf() {
  const target = document.value.mode === 'markdown'
    ? previewRef.value
    : await buildExportSvgClone()
  props.editorState.exportPdf(target, { title: resolveExportBaseName() })
}

async function handlePrintDocument(options = {}) {
  const target = document.value.mode === 'markdown'
    ? previewRef.value
    : await buildExportSvgClone()
  props.editorState.printDocument(target, {
    title: resolveExportBaseName(),
    ...options
  })
}

async function handleExport(format) {
  const normalizedFormat = format === 'jpg' ? 'jpeg' : format
  const useHtmlPreview = document.value.mode === 'markdown' && ['png', 'jpeg'].includes(normalizedFormat)
  const cropToContent = !useHtmlPreview && ['png', 'jpeg', 'svg'].includes(normalizedFormat)
  const exportTarget = useHtmlPreview
    ? previewRef.value
    : (await buildExportSvgClone({ cropToContent }) || svgRef.value)
  props.editorState.exportDocument(normalizedFormat, exportTarget, { baseName: resolveExportBaseName() })
}

function textBlockStyle(block) {
  const viewport = document.value.content.viewport
  return {
    left: `${block.x * viewport.zoom + viewport.x}px`,
    top: `${block.y * viewport.zoom + viewport.y}px`,
    width: `${block.width || NOTE_BLOCK_WIDTH}px`,
    minHeight: `${block.baseHeight || block.height || 96}px`,
    transform: `scale(${viewport.zoom})`,
    transformOrigin: 'top left'
  }
}

function selectionForClipboard() {
  if (selectedNodeIds.value.length) {
    return [...selectedNodeIds.value]
  }
  const activeId = props.editorState.activeNodeId.value
  return activeId ? [activeId] : []
}

function handleClipboardShortcut(event) {
  const editable = isEditableTarget(event.target)
  if (editable || !(event.ctrlKey || event.metaKey)) {
    return false
  }

  const key = String(event.key || '').toLowerCase()
  const ids = selectionForClipboard()

  if (key === 'a') {
    event.preventDefault()
    setSelectedNodes(visibleNodes.value.map(node => node.id))
    return true
  }

  if (key === 'c') {
    event.preventDefault()
    props.editorState.copyNodes(ids)
    return true
  }

  if (key === 'x') {
    event.preventDefault()
    if (props.editorState.copyNodes(ids)) {
      props.editorState.removeNodes(ids)
      setSelectedNodes([])
    }
    return true
  }

  if (key === 'v') {
    event.preventDefault()
    const pasted = props.editorState.pasteNodes()
    if (pasted.length) {
      setSelectedNodes(pasted)
    }
    return true
  }

  if (key === 'g') {
    event.preventDefault()
    if (event.shiftKey) {
      ungroupSelection()
    } else {
      groupSelection()
    }
    return true
  }

  if (key === 'd') {
    event.preventDefault()
    if (props.editorState.copyNodes(ids)) {
      const pasted = props.editorState.pasteNodes()
      if (pasted.length) {
        setSelectedNodes(pasted)
      }
    }
    return true
  }

  return false
}

function handleKeydown(event) {
  if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'f' && isTreeMode.value) {
    event.preventDefault()
    searchInputRef.value?.focus()
    searchInputRef.value?.select()
    return
  }

  if (contextMenu.value) {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeContextMenu()
      return
    }
  }

  if (contextSubmenu.value && event.key === 'Escape') {
    event.preventDefault()
    closeContextMenu()
    return
  }

  if (connectState.value && event.key === 'Escape') {
    event.preventDefault()
    stopConnectTracking()
    return
  }

  if (markdownCodeBlockControlsOpen.value && event.key === 'Escape') {
    event.preventDefault()
    markdownCodeBlockControlsOpen.value = false
    return
  }

  if (markdownTableControlsOpen.value && event.key === 'Escape') {
    event.preventDefault()
    markdownTableControlsOpen.value = false
    return
  }

  // Esc 关闭属性抽屉（不改变选中状态）
  if (inspectorOpen.value && event.key === 'Escape') {
    event.preventDefault()
    closeInspector()
    return
  }

  if (shortcutsOpen.value) {
    if (event.key === 'Escape') {
      event.preventDefault()
      shortcutsOpen.value = false
    }
    return
  }

  if (presentationActive.value) {
    if (event.key === 'Escape') {
      event.preventDefault()
      endPresentation()
      return
    }
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(event.key)) {
      event.preventDefault()
      stepPresentation(1)
      return
    }
    if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(event.key)) {
      event.preventDefault()
      stepPresentation(-1)
      return
    }
    return
  }

  if (handleClipboardShortcut(event)) {
    return
  }

  if (relationSourceId.value && event.key === 'Escape') {
    event.preventDefault()
    relationSourceId.value = null
    return
  }

  if (focusNodeId.value && event.key === 'Escape') {
    event.preventDefault()
    focusNodeId.value = null
    return
  }

  if (event.key === '?' && !isEditableTarget(event.target)) {
    event.preventDefault()
    shortcutsOpen.value = true
    return
  }

  // 流程图的多选由编辑器本地维护，Delete/Backspace 必须按多选集删除，
  // 不能落到只认识 activeNodeId 的通用 removeSelection。
  if (
    !isTreeMode.value &&
    !isEditableTarget(event.target) &&
    (event.key === 'Delete' || event.key === 'Backspace') &&
    selectedNodeIds.value.length
  ) {
    event.preventDefault()
    props.editorState.removeNodes([...selectedNodeIds.value])
    setSelectedNodes([])
    return
  }

  if (props.editorState.handleShortcut(event)) {
    return
  }

  if (isEditableTarget(event.target)) {
    return
  }

  // 按住 Alt 临时关闭对齐吸附（与 draw.io 一致）
  altPressed.value = event.altKey === true

  if (event.code === 'Space') {
    event.preventDefault()
    spacePressed.value = true
    return
  }

  if (event.key === 'F2' && props.editorState.activeEdgeId.value) {
    event.preventDefault()
    const edge = visibleEdges.value.find(item => item.id === props.editorState.activeEdgeId.value)
    if (edge) {
      openEdgeLabelEditor(edge)
    }
    return
  }

  if (event.key === 'F2' && props.editorState.activeNodeId.value) {
    event.preventDefault()
    openTextOverlay(props.editorState.activeNodeId.value)
    return
  }

  if (!isTreeMode.value && event.key === 'Enter' && props.editorState.activeNodeId.value) {
    event.preventDefault()
    openTextOverlay(props.editorState.activeNodeId.value)
  }
}

function handleKeyup(event) {
  if (event.code === 'Space') {
    spacePressed.value = false
  }
  if (event.key === 'Alt') {
    altPressed.value = false
  }
}

function isEditableTarget(target) {
  return Boolean(
    target &&
    typeof target.closest === 'function' &&
    target.closest('input, textarea, select, [contenteditable="true"]')
  )
}

const connectState = ref(null)

const connectPreview = computed(() => {
  const state = connectState.value
  if (!state) {
    return null
  }

  const source = visibleNodes.value.find(node => node.id === state.fromNodeId)
  if (!source) {
    return null
  }

  const from = resolveAnchorPoint(source, state.fromAnchor)
  let to = { x: state.x, y: state.y }

  if (state.targetNodeId) {
    const target = visibleNodes.value.find(node => node.id === state.targetNodeId)
    if (target) {
      to = resolveAnchorPoint(target, state.targetAnchor)
    }
  }

  return {
    from,
    to,
    path: `M ${from.x} ${from.y} L ${to.x} ${to.y}`
  }
})

function startConnectFromAnchor(node, anchor, event) {
  if (document.value.mode !== 'flowchart') {
    return
  }

  event.preventDefault()
  event.stopPropagation()

  const point = resolveClientPoint(event.clientX, event.clientY)
  connectState.value = {
    fromNodeId: node.id,
    fromAnchor: anchor.name,
    x: point.x,
    y: point.y,
    startClientX: event.clientX,
    startClientY: event.clientY,
    moved: false,
    targetNodeId: null,
    targetAnchor: null
  }

  window.addEventListener('pointermove', onConnectPointerMove)
  window.addEventListener('pointerup', onConnectPointerUp)
  window.addEventListener('pointercancel', cancelConnect)
}

function onConnectPointerMove(event) {
  const state = connectState.value
  if (!state) {
    return
  }

  const point = resolveClientPoint(event.clientX, event.clientY)
  const target = resolveConnectTarget(state.fromNodeId, point)
  const moved = state.moved || Math.hypot(
    event.clientX - (state.startClientX ?? event.clientX),
    event.clientY - (state.startClientY ?? event.clientY)
  ) > 4

  connectState.value = {
    ...state,
    x: point.x,
    y: point.y,
    moved,
    targetNodeId: target?.nodeId || null,
    targetAnchor: target?.anchor || null
  }
}

function resolveConnectTarget(sourceNodeId, point) {
  const PADDING = 16
  let best = null

  visibleNodes.value.forEach(node => {
    if (node.id === sourceNodeId) {
      return
    }
    if (
      point.x < node.x - PADDING ||
      point.x > node.x + node.width + PADDING ||
      point.y < node.y - PADDING ||
      point.y > node.y + node.height + PADDING
    ) {
      return
    }

    resolveNodeAnchors(node).forEach(anchor => {
      const distance = (anchor.x - point.x) ** 2 + (anchor.y - point.y) ** 2
      if (!best || distance < best.distance) {
        best = { nodeId: node.id, anchor: anchor.name, distance }
      }
    })
  })

  return best
}

function onConnectPointerUp() {
  const state = connectState.value
  if (!state) {
    return
  }

  // 单击连接点不立即取消，而是进入“待连接”状态；再点目标节点即可完成连线。
  // 按住拖动超过阈值时仍走原来的拖拽连线逻辑。
  if (!state.moved) {
    window.removeEventListener('pointerup', onConnectPointerUp)
    window.removeEventListener('pointercancel', cancelConnect)
    return
  }

  stopConnectTracking()
  if (!state.targetNodeId || state.targetNodeId === state.fromNodeId) {
    return
  }

  props.editorState.addEdge({
    fromNodeId: state.fromNodeId,
    toNodeId: state.targetNodeId,
    fromAnchor: state.fromAnchor,
    toAnchor: state.targetAnchor
  })
}

function cancelConnect() {
  stopConnectTracking()
}

function stopConnectTracking() {
  connectState.value = null
  window.removeEventListener('pointermove', onConnectPointerMove)
  window.removeEventListener('pointerup', onConnectPointerUp)
  window.removeEventListener('pointercancel', cancelConnect)
}

function resolveConnection(fromNode, toNode) {
  const deltaX = (toNode.x + toNode.width / 2) - (fromNode.x + fromNode.width / 2)
  const deltaY = (toNode.y + toNode.height / 2) - (fromNode.y + fromNode.height / 2)

  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    return {
      fromNodeId: fromNode.id,
      toNodeId: toNode.id,
      fromAnchor: deltaX >= 0 ? 'right' : 'left',
      toAnchor: deltaX >= 0 ? 'left' : 'right'
    }
  }

  return {
    fromNodeId: fromNode.id,
    toNodeId: toNode.id,
    fromAnchor: deltaY >= 0 ? 'bottom' : 'top',
    toAnchor: deltaY >= 0 ? 'top' : 'bottom'
  }
}

function resolveDropTargetNode(point) {
  if (!point || !visibleNodes.value.length) {
    return null
  }

  return visibleNodes.value.reduce((closest, node) => {
    if (!closest) {
      return node
    }

    const nodeDistance = squaredDistance(point, node)
    const closestDistance = squaredDistance(point, closest)
    return nodeDistance < closestDistance ? node : closest
  }, null)
}

function squaredDistance(point, node) {
  const centerX = node.x + node.width / 2
  const centerY = node.y + node.height / 2
  return ((point.x - centerX) ** 2) + ((point.y - centerY) ** 2)
}

function resolveEdgeLabelPosition(points) {
  if (!points.length) {
    return { x: 0, y: 0 }
  }
  const middleIndex = Math.floor(points.length / 2)
  const previousPoint = points[Math.max(middleIndex - 1, 0)]
  const middlePoint = points[middleIndex]
  return {
    x: (previousPoint.x + middlePoint.x) / 2,
    y: (previousPoint.y + middlePoint.y) / 2
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('keyup', handleKeyup)
  window.addEventListener('resize', refreshRulers)
  window.addEventListener('click', closeToolbarMenu)
  window.addEventListener('pointerdown', handleContextMenuOutsidePointerDown, true)
  window.addEventListener('pointerdown', handleDocumentPointerDown, true)
  window.addEventListener('pointerdown', handleInspectorOutsidePointerDown, true)
  window.addEventListener('scroll', closeContextMenu, true)
  window.addEventListener('blur', closeContextMenu)
  if (canvasCardRef.value && window.ResizeObserver) {
    canvasResizeObserver = new ResizeObserver(() => {
      nextTick(() => {
        refreshRulers()
        syncOverlayAnchor()
      })
    })
    canvasResizeObserver.observe(canvasCardRef.value)
  }
  nextTick(refreshRulers)
})

watch(() => [document.value.content.viewport.x, document.value.content.viewport.y, document.value.content.viewport.zoom], () => {
  nextTick(refreshRulers)
})

onBeforeUnmount(() => {
  clearEditorToastTimer()
  stopPresentationTimer()
  canvasResizeObserver?.disconnect()
  canvasResizeObserver = null
  window.removeEventListener('resize', refreshRulers)
  window.removeEventListener('click', closeToolbarMenu)
  window.removeEventListener('pointerdown', handleContextMenuOutsidePointerDown, true)
  window.removeEventListener('pointerdown', handleDocumentPointerDown, true)
  window.removeEventListener('pointerdown', handleInspectorOutsidePointerDown, true)
  window.removeEventListener('scroll', closeContextMenu, true)
  window.removeEventListener('blur', closeContextMenu)
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('keyup', handleKeyup)
  stopPalettePointerTracking()
  stopOverlayPointerTracking()
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', endDrag)
  window.removeEventListener('pointermove', onTextBlockPointerMove)
  window.removeEventListener('pointerup', endTextBlockDrag)
  window.removeEventListener('pointercancel', endTextBlockDrag)
  window.removeEventListener('pointermove', onTextBlockResizeMove)
  window.removeEventListener('pointerup', endTextBlockResize)
  window.removeEventListener('pointercancel', endTextBlockResize)
  window.removeEventListener('pointermove', onCanvasPanMove)
  window.removeEventListener('pointerup', endCanvasPan)
  window.removeEventListener('pointermove', onSelectionMarqueeMove)
  window.removeEventListener('pointerup', endSelectionMarquee)
  window.removeEventListener('pointercancel', endSelectionMarquee)
})
</script>

<style scoped src="../styles/editor.css"></style>
