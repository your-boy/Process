<template>
  <div class="app-shell">
    <main class="app-content" :class="{ 'app-content-editor': currentUser && workspaceView === 'editor' }">
      <header class="topbar" :class="{ 'topbar-plain': !currentUser }">
        <button
          v-if="currentUser && workspaceView === 'editor'"
          type="button"
          class="icon-button topbar-back"
          data-testid="topbar-back"
          aria-label="返回"
          title="返回"
          @click="returnToWorkspace"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"></path></svg>
        </button>
        <button
          type="button"
          class="brand"
          :class="{ 'brand-clickable': currentUser && workspaceView === 'editor' }"
          data-testid="brand-home"
          @click="handleBrandClick"
        >
          <span class="brand-mark">P</span>
          <span class="brand-name">Process</span>
        </button>
        <button
          v-if="currentUser && workspaceView === 'home'"
          type="button"
          class="workspace-primary topbar-create-button"
          data-testid="workspace-create-button"
          @click="openCreateDialog"
        >
          <span class="topbar-create-plus" aria-hidden="true">+</span>
          {{ t('workspace.new') }}
        </button>
        <div v-if="currentUser && workspaceView === 'home'" class="workspace-search-bar">
          <input
            v-model="workspaceSearchDraft"
            type="search"
            class="workspace-search-input"
            data-testid="workspace-search"
            :placeholder="t('workspace.searchPlaceholder')"
            @keydown.enter.prevent="applyWorkspaceSearch"
            @keydown.esc="resetWorkspaceSearch"
          />
          <select
            v-model="workspaceModeFilter"
            class="workspace-mode-filter"
            data-testid="workspace-mode-filter"
            :aria-label="t('workspace.filterByType')"
            @change="applyWorkspaceModeFilter"
          >
            <option value="all">{{ t('workspace.allTypes') }}</option>
            <option v-for="mode in workspaceModeFilterOptions" :key="mode" :value="mode">{{ modeLabel(mode) }}</option>
          </select>
          <button type="button" data-testid="workspace-search-submit" @click="applyWorkspaceSearch">{{ t('workspace.query') }}</button>
          <button type="button" data-testid="workspace-search-reset" :disabled="!workspaceSearchDraft && !workspaceSearchQuery && workspaceModeFilter === 'all'" @click="resetWorkspaceSearch">{{ t('workspace.reset') }}</button>
        </div>
        <div v-if="currentUser && workspaceView === 'home'" class="workspace-view-switch" role="group" :aria-label="t('workspace.viewMode')">
          <button type="button" data-testid="workspace-view-grid" :class="{ active: workspaceLayout === 'grid' }" @click="setWorkspaceLayout('grid')">{{ t('workspace.cardView') }}</button>
          <button type="button" data-testid="workspace-view-list" :class="{ active: workspaceLayout === 'list' }" @click="setWorkspaceLayout('list')">{{ t('workspace.listView') }}</button>
        </div>
        <div v-if="currentUser && workspaceView === 'home'" class="workspace-batch-bar" data-testid="workspace-batch-bar">
          <span>{{ t('workspace.selectedCount', { count: selectedWorkspaceKeys.length }) }}</span>
          <button
            type="button"
            class="workspace-batch-delete"
            data-testid="workspace-batch-delete"
            :disabled="!selectedWorkspaceKeys.length"
            :title="selectedWorkspaceKeys.length ? '' : t('workspace.batchSelectHint')"
            @click="deleteSelectedWorkspaceDocuments"
          >{{ t('workspace.deleteSelected') }}</button>
          <button v-if="selectedWorkspaceKeys.length" type="button" class="workspace-batch-cancel" data-testid="workspace-batch-cancel" @click="clearWorkspaceSelection">{{ t('workspace.clearSelection') }}</button>
        </div>
        <div class="topbar-actions">
          <button
            class="icon-button"
            type="button"
            :aria-label="theme === 'dark' ? t('theme.toLight') : t('theme.toDark')"
            :title="theme === 'dark' ? t('theme.toLight') : t('theme.toDark')"
            @click="toggleTheme"
          >
            <svg v-if="theme === 'dark'" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="4"></circle>
              <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"></path>
            </svg>
            <svg v-else viewBox="0 0 24 24">
              <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"></path>
            </svg>
          </button>
          <button
            class="ghost-button language-button"
            type="button"
            data-testid="locale-toggle"
            :title="locale === 'zh' ? 'English' : '中文'"
            @click="toggleLocale"
          >{{ locale === 'zh' ? 'EN' : '中' }}</button>
          <template v-if="currentUser">
            <span class="user-chip">{{ currentUser.displayName }}</span>
            <button class="ghost-button" type="button" @click="toggleSecurityPanel">{{ t('auth.changePassword') }}</button>
            <button class="ghost-button" type="button" :disabled="isLoggingOut" @click="logout">{{ isLoggingOut ? t('auth.loggingOut') : t('auth.logout') }}</button>
          </template>
        </div>
      </header>

      <LoginPanel
        v-if="!currentUser"
        :loading="isLoggingIn"
        :error="loginError"
        @login="login"
        @forgot-password="forgotPassword"
      />

      <section v-else class="workspace-shell">
        <p v-if="workspaceMessage" class="workspace-message" role="status" aria-live="polite">{{ workspaceMessage }}</p>

        <section v-if="isSecurityPanelOpen" class="security-panel">
          <div class="security-copy">
            <h3>{{ t('auth.changePassword') }}</h3>
          </div>

          <form class="security-form" @submit.prevent="changePassword">
            <div class="security-grid">
              <label class="field-label" for="current-password">{{ t('auth.currentPassword') }}</label>
              <div class="password-field">
                <input
                  id="current-password"
                  v-model="passwordForm.currentPassword"
                  class="security-input"
                  :type="passwordVisibility.current ? 'text' : 'password'"
                  maxlength="64"
                  autocomplete="current-password"
                  :placeholder="t('auth.currentPasswordPlaceholder')"
                />
                <button
                  type="button"
                  class="visibility-button"
                  data-testid="toggle-current-password"
                  :aria-label="passwordVisibility.current ? t('auth.hidePassword') : t('auth.showPassword')"
                  @click="passwordVisibility.current = !passwordVisibility.current"
                >
                  <svg class="visibility-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M2.6 12C4.6 8.1 8 5.8 12 5.8S19.4 8.1 21.4 12C19.4 15.9 16 18.2 12 18.2S4.6 15.9 2.6 12Z"></path>
                    <circle cx="12" cy="12" r="3.2"></circle>
                    <path v-if="!passwordVisibility.current" d="M4 4 20 20"></path>
                  </svg>
                </button>
              </div>

              <label class="field-label" for="new-password">{{ t('auth.newPassword') }}</label>
              <div class="password-field">
                <input
                  id="new-password"
                  v-model="passwordForm.newPassword"
                  class="security-input"
                  :type="passwordVisibility.next ? 'text' : 'password'"
                  maxlength="64"
                  autocomplete="new-password"
                  :placeholder="t('auth.newPasswordPlaceholder')"
                />
                <button
                  type="button"
                  class="visibility-button"
                  data-testid="toggle-new-password"
                  :aria-label="passwordVisibility.next ? t('auth.hideNewPassword') : t('auth.showNewPassword')"
                  @click="passwordVisibility.next = !passwordVisibility.next"
                >
                  <svg class="visibility-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M2.6 12C4.6 8.1 8 5.8 12 5.8S19.4 8.1 21.4 12C19.4 15.9 16 18.2 12 18.2S4.6 15.9 2.6 12Z"></path>
                    <circle cx="12" cy="12" r="3.2"></circle>
                    <path v-if="!passwordVisibility.next" d="M4 4 20 20"></path>
                  </svg>
                </button>
              </div>

              <label class="field-label" for="confirm-password">{{ t('auth.confirmPassword') }}</label>
              <div class="password-field">
                <input
                  id="confirm-password"
                  v-model="passwordForm.confirmPassword"
                  class="security-input"
                  :type="passwordVisibility.confirm ? 'text' : 'password'"
                  maxlength="64"
                  autocomplete="new-password"
                  :placeholder="t('auth.confirmPasswordPlaceholder')"
                />
                <button
                  type="button"
                  class="visibility-button"
                  data-testid="toggle-confirm-password"
                  :aria-label="passwordVisibility.confirm ? t('auth.hideConfirmPassword') : t('auth.showConfirmPassword')"
                  @click="passwordVisibility.confirm = !passwordVisibility.confirm"
                >
                  <svg class="visibility-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M2.6 12C4.6 8.1 8 5.8 12 5.8S19.4 8.1 21.4 12C19.4 15.9 16 18.2 12 18.2S4.6 15.9 2.6 12Z"></path>
                    <circle cx="12" cy="12" r="3.2"></circle>
                    <path v-if="!passwordVisibility.confirm" d="M4 4 20 20"></path>
                  </svg>
                </button>
              </div>
            </div>

            <p class="form-note">{{ t('auth.passwordHint') }}</p>
            <p v-if="securityError" class="error-text" role="alert">{{ securityError }}</p>
            <p v-if="securityMessage" class="success-text" role="status">{{ securityMessage }}</p>

            <div class="security-actions">
              <button class="primary-button" type="submit" :disabled="isChangingPassword">
                {{ isChangingPassword ? t('auth.updating') : t('auth.updatePassword') }}
              </button>
              <button class="ghost-button" type="button" :disabled="isChangingPassword" @click="closeSecurityPanel">{{ t('auth.collapse') }}</button>
            </div>
          </form>
        </section>

        <section
          v-if="workspaceView === 'home'"
          ref="workspaceBrowserRef"
          class="workspace-browser"
          @click="closeDocumentMenu"
        >
          <div v-if="isWorkspaceLoading" class="workspace-browser-state">
            {{ t('common.loading') }}
          </div>

          <template v-else-if="filteredWorkspaceCards.length">
          <div
            v-if="workspaceLayout === 'list'"
            class="workspace-list-header"
            role="row"
            data-testid="workspace-list-header"
          >
            <button
              type="button"
              role="columnheader"
              data-testid="workspace-sort-sequence"
              :class="{ active: workspaceSortKey === 'sequence' }"
              :aria-sort="workspaceSortKey === 'sequence' ? (workspaceSortDirection === 'asc' ? 'ascending' : 'descending') : 'none'"
              :title="t('workspace.sortColumn', { column: t('workspace.sequenceColumn') })"
              @click="sortWorkspaceCards('sequence')"
            >{{ t('workspace.sequenceColumn') }}<span class="workspace-sort-indicator">{{ workspaceSortKey === 'sequence' ? (workspaceSortDirection === 'asc' ? '↑' : '↓') : '↕' }}</span></button>
            <button
              type="button"
              role="columnheader"
              data-testid="workspace-sort-title"
              :class="{ active: workspaceSortKey === 'title' }"
              :aria-sort="workspaceSortKey === 'title' ? (workspaceSortDirection === 'asc' ? 'ascending' : 'descending') : 'none'"
              :title="t('workspace.sortColumn', { column: t('workspace.titleColumn') })"
              @click="sortWorkspaceCards('title')"
            >{{ t('workspace.titleColumn') }}<span class="workspace-sort-indicator">{{ workspaceSortKey === 'title' ? (workspaceSortDirection === 'asc' ? '↑' : '↓') : '↕' }}</span></button>
            <button
              type="button"
              role="columnheader"
              data-testid="workspace-sort-mode"
              :class="{ active: workspaceSortKey === 'mode' }"
              :aria-sort="workspaceSortKey === 'mode' ? (workspaceSortDirection === 'asc' ? 'ascending' : 'descending') : 'none'"
              :title="t('workspace.sortColumn', { column: t('workspace.typeColumn') })"
              @click="sortWorkspaceCards('mode')"
            >{{ t('workspace.typeColumn') }}<span class="workspace-sort-indicator">{{ workspaceSortKey === 'mode' ? (workspaceSortDirection === 'asc' ? '↑' : '↓') : '↕' }}</span></button>
            <button
              type="button"
              role="columnheader"
              data-testid="workspace-sort-summary"
              :class="{ active: workspaceSortKey === 'summary' }"
              :aria-sort="workspaceSortKey === 'summary' ? (workspaceSortDirection === 'asc' ? 'ascending' : 'descending') : 'none'"
              :title="t('workspace.sortColumn', { column: t('workspace.summaryColumn') })"
              @click="sortWorkspaceCards('summary')"
            >{{ t('workspace.summaryColumn') }}<span class="workspace-sort-indicator">{{ workspaceSortKey === 'summary' ? (workspaceSortDirection === 'asc' ? '↑' : '↓') : '↕' }}</span></button>
            <button
              type="button"
              role="columnheader"
              data-testid="workspace-sort-pages"
              :class="{ active: workspaceSortKey === 'pages' }"
              :aria-sort="workspaceSortKey === 'pages' ? (workspaceSortDirection === 'asc' ? 'ascending' : 'descending') : 'none'"
              :title="t('workspace.sortColumn', { column: t('workspace.pagesColumn') })"
              @click="sortWorkspaceCards('pages')"
            >{{ t('workspace.pagesColumn') }}<span class="workspace-sort-indicator">{{ workspaceSortKey === 'pages' ? (workspaceSortDirection === 'asc' ? '↑' : '↓') : '↕' }}</span></button>
          </div>
          <div
            :class="['workspace-gallery', `layout-${workspaceLayout}`, { 'marquee-active': workspaceMarquee?.active }]"
            :data-page-size="workspacePageSize"
            @pointerdown.capture="beginWorkspaceMarquee"
          >
            <article
              v-for="item in pagedWorkspaceCards"
              :key="item.key"
              :class="['workspace-card', `mode-${item.mode}`, {
                active: item.key === activeDocumentKey,
                'menu-open': activeDocumentMenuKey === item.key,
                selected: selectedWorkspaceKeySet.has(item.key)
              }]"
              :data-testid="`workspace-card-${item.key}`"
              @contextmenu.prevent.stop="openDocumentContextMenu(item.key, $event)"
            >
              <button
                v-if="selectedWorkspaceKeySet.has(item.key)"
                type="button"
                class="workspace-card-selected-check"
                data-testid="workspace-card-selected-check"
                :aria-label="t('workspace.deselectOne')"
                :title="t('workspace.deselectOne')"
                @click.stop.prevent="toggleWorkspaceSelection(item.key)"
              >✓</button>
              <button
                type="button"
                class="workspace-card-main"
                :aria-label="item.title"
                @click="handleWorkspaceCardOpen(item.key, $event)"
              >
                <div v-if="workspaceLayout === 'grid'" :class="['workspace-card-preview', `mode-${item.mode}`]">
                  <div class="workspace-card-badges">
                    <span class="workspace-card-sequence" data-testid="workspace-card-sequence">{{ formatWorkspaceSequence(item.sequenceNo) }}</span>
                    <span v-if="item.title !== modeLabel(item.mode)" class="workspace-card-badge strong">{{ modeLabel(item.mode) }}</span>
                    <span class="workspace-card-filename" :title="item.title">{{ item.title }}</span>
                    <span v-if="!item.snapshot.id" class="workspace-card-badge">{{ t('workspace.localDraft') }}</span>
                  </div>

                  <div
                    v-if="!item.currentPreview.empty && item.currentPreview.kind === 'markdown'"
                    class="workspace-markdown-preview"
                  >
                    <span
                      v-for="(line, index) in item.currentPreview.lines"
                      :key="`${item.key}-line-${index}`"
                      :class="['workspace-markdown-line', { heading: index === 0 }]"
                    >{{ line }}</span>
                  </div>

                  <svg
                    v-else-if="!item.currentPreview.empty"
                    class="workspace-diagram-preview"
                    viewBox="0 0 220 150"
                    aria-hidden="true"
                  >
                    <line
                      v-for="edge in item.currentPreview.edges"
                      :key="edge.key"
                      :x1="edge.x1"
                      :y1="edge.y1"
                      :x2="edge.x2"
                      :y2="edge.y2"
                      class="workspace-preview-edge"
                    />

                    <template v-for="node in item.currentPreview.nodes" :key="node.key">
                      <path
                        v-if="node.shape === 'diamond'"
                        :d="node.path"
                        class="workspace-preview-node"
                      />
                      <rect
                        v-else
                        :x="node.x"
                        :y="node.y"
                        :width="node.width"
                        :height="node.height"
                        :rx="node.radius"
                        class="workspace-preview-node"
                      />
                      <text
                        v-if="node.label"
                        :x="node.textX"
                        :y="node.textY"
                        :style="{ fontSize: `${node.fontSize}px` }"
                        class="workspace-preview-label"
                        text-anchor="middle"
                        dominant-baseline="middle"
                      >{{ node.label }}</text>
                    </template>

                    <g
                      v-for="block in item.currentPreview.textBlocks"
                      :key="`text-block-${block.key}`"
                      class="workspace-preview-text-block"
                    >
                      <rect
                        :x="block.x"
                        :y="block.y"
                        :width="block.width"
                        :height="block.height"
                        rx="2"
                      />
                      <text
                        v-for="(line, index) in block.lines"
                        :key="`${block.key}-line-${index}`"
                        :x="block.textX"
                        :y="block.textY + index * block.lineHeight"
                        :style="{ fontSize: `${block.fontSize}px` }"
                      >{{ line }}</text>
                    </g>
                  </svg>
                </div>
                <div v-else class="workspace-list-row">
                  <span class="workspace-list-index">
                    <span class="workspace-list-sequence" data-testid="workspace-list-sequence">{{ formatWorkspaceSequence(item.sequenceNo) }}</span>
                    <span :class="['workspace-list-mode-dot', `mode-${item.mode}`]"></span>
                  </span>
                  <span class="workspace-list-title" :title="item.title">{{ item.title }}</span>
                  <span class="workspace-list-mode">{{ modeLabel(item.mode) }}</span>
                  <span class="workspace-list-summary">{{ item.summary }}</span>
                  <span class="workspace-list-pages">{{ t('workspace.pagesCount', { count: item.previewPageCount }) }}</span>
                </div>
              </button>

              <div
                v-if="workspaceLayout === 'grid' && item.previewPageCount > 1"
                class="workspace-card-page-switcher"
                @click.stop
              >
                <button
                  type="button"
                  data-testid="workspace-preview-prev"
                  :aria-label="t('workspace.previousPage')"
                  @click.stop="cycleWorkspacePreviewPage(item.key, -1)"
                >‹</button>
                <button
                  v-for="(page, index) in item.preview.pages"
                  :key="`${item.key}-page-${page.id}`"
                  type="button"
                  :class="{ active: index === item.previewPageIndex }"
                  :title="page.name || `${index + 1}`"
                  @click.stop="selectWorkspacePreviewPage(item.key, page.id)"
                >{{ index + 1 }}</button>
                <button
                  type="button"
                  data-testid="workspace-preview-next"
                  :aria-label="t('workspace.nextPage')"
                  @click.stop="cycleWorkspacePreviewPage(item.key, 1)"
                >›</button>
              </div>

              <button
                type="button"
                class="workspace-card-menu-trigger"
                :aria-label="t('common.more')"
                @click.stop="toggleDocumentMenu(item.key)"
              >
                <span></span><span></span><span></span>
              </button>

              <div
                v-if="activeDocumentMenuKey === item.key"
                class="workspace-card-menu"
                @click.stop
              >
                <button type="button" class="workspace-card-menu-item" @click="openDocument(item.key)">{{ t('common.open') }}</button>
                <button type="button" class="workspace-card-menu-item" @click="startRenameDocument(item.key)">{{ t('common.rename') }}</button>
                <div class="workspace-card-menu-divider"></div>
                <button type="button" class="workspace-card-menu-item danger" @click="deleteDocument(item.key)">{{ t('common.delete') }}</button>
              </div>
            </article>
          </div>

          <nav
            v-if="filteredWorkspaceCards.length"
            class="workspace-pagination"
            data-testid="workspace-pagination"
            :data-current-page="workspaceCurrentPage"
            :data-total-pages="workspaceTotalPages"
            :aria-label="t('workspace.paginationLabel')"
          >
            <label class="workspace-page-size">
              <span>{{ t('workspace.pageSize') }}</span>
              <select
                :value="String(workspacePageSize)"
                data-testid="workspace-page-size"
                @change="setWorkspacePageSize"
              >
                <option
                  v-if="!WORKSPACE_PAGE_SIZE_OPTIONS.includes(workspacePageSize)"
                  :value="workspacePageSize"
                >{{ workspacePageSize }}</option>
                <option v-for="size in WORKSPACE_PAGE_SIZE_OPTIONS" :key="size" :value="size">{{ size }}</option>
              </select>
            </label>
            <span class="workspace-pagination-summary">
              {{ t('workspace.pageRange', {
                start: workspaceVisibleRange.start,
                end: workspaceVisibleRange.end,
                total: filteredWorkspaceCards.length
              }) }}
            </span>
            <div v-if="workspaceTotalPages > 1" class="workspace-pagination-actions">
              <button
                type="button"
                data-testid="workspace-page-prev"
                :aria-label="t('workspace.previousDocPage')"
                :disabled="workspaceCurrentPage <= 1"
                @click="goToWorkspacePage(workspaceCurrentPage - 1)"
              >‹</button>
              <template v-for="(page, index) in workspacePaginationItems" :key="`${page}-${index}`">
                <span v-if="page === '…'" class="workspace-pagination-ellipsis">…</span>
                <button
                  v-else
                  type="button"
                  :class="{ active: page === workspaceCurrentPage }"
                  :aria-current="page === workspaceCurrentPage ? 'page' : undefined"
                  :aria-label="t('workspace.goToPage', { page })"
                  @click="goToWorkspacePage(page)"
                >{{ page }}</button>
              </template>
              <button
                type="button"
                data-testid="workspace-page-next"
                :aria-label="t('workspace.nextDocPage')"
                :disabled="workspaceCurrentPage >= workspaceTotalPages"
                @click="goToWorkspacePage(workspaceCurrentPage + 1)"
              >›</button>
            </div>
          </nav>
          </template>

          <div v-else-if="workspaceCards.length" class="workspace-empty" data-testid="workspace-search-empty">
            <h3>{{ t('workspace.searchNoResults') }}</h3>
            <button type="button" class="workspace-primary" @click="resetWorkspaceSearch">{{ t('workspace.reset') }}</button>
          </div>

          <div v-else class="workspace-empty">
            <h3>{{ t('workspace.empty') }}</h3>
            <button type="button" class="workspace-primary" @click.stop="openCreateDialog">{{ t('workspace.newFile') }}</button>
          </div>
        </section>

        <section v-else class="workspace-editor-shell">
          <Suspense>
            <Editor :editor-state="editorState" :current-user="currentUser" @back="returnToWorkspace" />
            <template #fallback>
              <div class="editor-loading" role="status">{{ t('editor.loading') }}</div>
            </template>
          </Suspense>
        </section>

        <transition name="workspace-fade">
          <div v-if="isCreateDialogOpen" class="workspace-dialog-backdrop" @click.self="closeCreateDialog">
            <section
              ref="createDialogElement"
              class="workspace-dialog create-dialog"
              role="dialog"
              aria-modal="true"
              :aria-label="t('workspace.createTitle')"
              :style="createDialogStyle"
            >
              <div
                class="workspace-dialog-header is-drag-handle"
                @pointerdown="startCreateDialogDrag"
              >
                <div>
                  <h3>{{ t('workspace.createTitle') }}</h3>
                </div>
                <button type="button" class="ghost-button" @click="closeCreateDialog">{{ t('common.cancel') }}</button>
              </div>

              <div class="workspace-type-grid" data-testid="create-document-dialog">
                <template v-for="item in creationModes" :key="item.mode">
                <p v-if="item.mode === '__group__'" class="workspace-dialog-group">{{ item.displayLabel }}</p>
                <button
                  v-else
                  type="button"
                  :aria-label="item.label"
                  class="workspace-type-card"
                  @click="createDocument(item.mode)"
                >
                  <svg class="workspace-type-icon" viewBox="0 0 76 76" aria-hidden="true">
                    <template v-if="item.mode === 'flowchart' || (item.mode.startsWith('template-') && !item.mode.startsWith('template-mind'))">
                      <rect x="10" y="16" width="22" height="16" rx="6"></rect>
                      <path d="M46 16 L62 24 L46 32 L30 24 Z"></path>
                      <rect x="24" y="46" width="28" height="16" rx="8"></rect>
                      <line x1="32" y1="24" x2="46" y2="24"></line>
                      <line x1="46" y1="32" x2="38" y2="46"></line>
                    </template>
                    <template v-else-if="item.mode === 'mindmap' || item.mode.startsWith('template-mind')">
                      <circle cx="20" cy="38" r="8"></circle>
                      <circle cx="50" cy="22" r="6"></circle>
                      <circle cx="56" cy="50" r="6"></circle>
                      <line x1="28" y1="38" x2="44" y2="24"></line>
                      <line x1="28" y1="38" x2="50" y2="48"></line>
                    </template>
                    <template v-else-if="item.mode === 'markdown'">
                      <path d="M18 14 H58 A6 6 0 0 1 64 20 V56 A6 6 0 0 1 58 62 H18 A6 6 0 0 1 12 56 V20 A6 6 0 0 1 18 14 Z"></path>
                      <line x1="22" y1="26" x2="48" y2="26"></line>
                      <line x1="22" y1="38" x2="54" y2="38"></line>
                      <line x1="22" y1="50" x2="44" y2="50"></line>
                    </template>
                    <template v-else>
                      <rect x="14" y="18" width="20" height="14" rx="7"></rect>
                      <rect x="42" y="18" width="20" height="14" rx="7"></rect>
                      <rect x="28" y="46" width="20" height="14" rx="7"></rect>
                      <line x1="34" y1="25" x2="42" y2="25"></line>
                      <line x1="38" y1="32" x2="38" y2="46"></line>
                    </template>
                  </svg>
                  <strong>{{ item.displayLabel }}</strong>
                  <span v-if="item.description" class="workspace-type-desc">{{ item.description }}</span>
                </button>
                </template>
              </div>
            </section>
          </div>
        </transition>

        <transition name="workspace-fade">
          <div v-if="renamingDocumentKey" class="workspace-dialog-backdrop" @click.self="cancelRenameDocument">
            <form class="workspace-dialog rename-dialog" role="dialog" aria-modal="true" :aria-label="t('workspace.renameTitle')" @submit.prevent="commitRenameDocument">
              <div class="workspace-dialog-header">
                <div>
                  <h3>{{ t('workspace.renameTitle') }}</h3>
                </div>
              </div>

              <label class="workspace-rename-field">
                <span>{{ t('workspace.fileName') }}</span>
                <input
                  ref="renamingInput"
                  v-model="renamingDocumentTitle"
                  type="text"
                  maxlength="100"
                  :placeholder="t('workspace.renamePlaceholder')"
                />
              </label>

              <div class="workspace-dialog-actions">
                <button type="button" class="ghost-button" @click="cancelRenameDocument">{{ t('common.cancel') }}</button>
                <button type="submit" class="primary-button">{{ t('workspace.confirmRename') }}</button>
              </div>
            </form>
          </div>
        </transition>
      </section>
    </main>

    <Teleport to="body">
      <div
        v-if="workspaceMarquee?.active"
        class="workspace-card-marquee"
        data-testid="workspace-card-marquee"
        :style="{
          left: `${workspaceMarquee.x}px`,
          top: `${workspaceMarquee.y}px`,
          width: `${workspaceMarquee.width}px`,
          height: `${workspaceMarquee.height}px`
        }"
      ></div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="workspaceContextMenu"
        ref="workspaceContextMenuRef"
        class="workspace-card-context-menu"
        :style="{ left: `${workspaceContextMenu.x}px`, top: `${workspaceContextMenu.y}px` }"
        role="menu"
        data-testid="workspace-card-context-menu"
        @pointerdown.stop
        @click.stop
        @contextmenu.prevent.stop
      >
        <button type="button" role="menuitem" data-testid="workspace-context-open" @click="openWorkspaceContextDocument">{{ t('common.open') }}</button>
        <button type="button" role="menuitem" data-testid="workspace-context-rename" @click="renameWorkspaceContextDocument">{{ t('common.rename') }}</button>
        <div class="workspace-card-menu-divider"></div>
        <button type="button" role="menuitem" class="danger" data-testid="workspace-context-delete" @click="deleteWorkspaceContextDocument">{{ t('common.delete') }}</button>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import LoginPanel from './components/LoginPanel.vue'
import { normalizeDocument } from './editor/model/document'
import { getVisibleTextBlocks, hasMindNoteBlockContent } from './editor/render/textBlockLayer'
import { createDiagramApi } from './editor/services/diagramApi'
import { useEditorState } from './editor/state/useEditorState'
import { useSessionState } from './editor/state/useSessionState'
import { locale, setLocale, t, toggleLocale } from './i18n'

const WORKSPACE_KEY_PREFIX = 'diagram-editor:workspace:'
const WORKSPACE_PAGE_SIZE_KEY = 'diagram-editor:workspace-page-size'
const WORKSPACE_PAGE_SIZE_OPTIONS = [10, 20, 40, 60, 100]
const THEME_KEY = 'diagram-editor:theme'

function readWorkspacePageSizeSetting() {
  if (typeof window === 'undefined') {
    return 'auto'
  }
  try {
    const value = Number(window.localStorage.getItem(WORKSPACE_PAGE_SIZE_KEY))
    return Number.isFinite(value) && value > 0 ? Math.min(1000, Math.round(value)) : 'auto'
  } catch {
    return 'auto'
  }
}

const Editor = defineAsyncComponent(() => import('./components/Editor.vue'))

const theme = ref('light')

function applyTheme(nextTheme) {
  theme.value = nextTheme
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = nextTheme
  }
  try {
    window.localStorage.setItem(THEME_KEY, nextTheme)
  } catch (error) {
    // 存储不可用时只在当前会话生效
  }
}

function toggleTheme() {
  applyTheme(theme.value === 'dark' ? 'light' : 'dark')
}

function handleGlobalKeydown(event) {
  if (event.key !== 'Escape') {
    return
  }
  if (workspaceContextMenu.value) {
    event.preventDefault()
    closeWorkspaceContextMenu()
    return
  }
  if (isCreateDialogOpen.value) {
    event.preventDefault()
    closeCreateDialog()
    return
  }
  if (renamingDocumentKey.value) {
    event.preventDefault()
    cancelRenameDocument()
  }
}

onMounted(() => {
  setLocale(locale.value)
  window.addEventListener('diagram-editor:unauthorized', handleUnauthorized)
  window.addEventListener('resize', clampCreateDialogOffset)
  window.addEventListener('keydown', handleGlobalKeydown)
  window.addEventListener('pointerdown', handleWorkspaceContextPointerDown, true)
  window.addEventListener('scroll', closeWorkspaceContextMenu, true)
  let initialTheme = 'light'
  try {
    const stored = window.localStorage.getItem(THEME_KEY)
    if (stored === 'dark' || stored === 'light') {
      initialTheme = stored
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      initialTheme = 'dark'
    }
  } catch (error) {
    // 读取失败时使用浅色
  }
  applyTheme(initialTheme)
})

const api = createDiagramApi()
const sessionState = useSessionState()
const editorState = useEditorState({ api, sessionState })
const isLoggingIn = ref(false)
const isLoggingOut = ref(false)
const isChangingPassword = ref(false)
const loginError = ref('')
const workspaceMessage = ref('')
const securityError = ref('')
const securityMessage = ref('')
const isSecurityPanelOpen = ref(false)
const isWorkspaceLoading = ref(false)
const openDocuments = ref([])
const activeDocumentKey = ref(null)
const workspaceView = ref('home')
const isCreateDialogOpen = ref(false)
const activeDocumentMenuKey = ref(null)
const workspaceContextMenu = ref(null)
const workspaceContextMenuRef = ref(null)
const workspacePreviewPageIds = reactive({})
const selectedWorkspaceKeys = ref([])
const workspaceLayout = ref('grid')
const workspaceSearchDraft = ref('')
const workspaceSearchQuery = ref('')
const workspaceModeFilter = ref('all')
const workspaceSortKey = ref('')
const workspaceSortDirection = ref('asc')
const workspaceMarquee = ref(null)
const workspaceBrowserRef = ref(null)
const workspaceBrowserHeight = ref(0)
const workspaceBrowserWidth = ref(0)
const workspacePage = ref(1)
const workspacePageSizeSetting = ref(readWorkspacePageSizeSetting())
const selectedWorkspaceKeySet = computed(() => new Set(selectedWorkspaceKeys.value))
let workspaceMarqueeGesture = null
let suppressWorkspaceCardOpen = false
let workspaceBrowserResizeObserver = null
const WORKSPACE_MODE_FILTERS = ['flowchart', 'mindmap', 'markdown', 'mind-note']
const workspaceModeFilterOptions = WORKSPACE_MODE_FILTERS
const WORKSPACE_PAGINATION_SPACE = 44
const WORKSPACE_LIST_HEADER_SPACE = 34
const WORKSPACE_GRID_CARD_HEIGHT = 142
const WORKSPACE_GRID_GAP = 12
const WORKSPACE_GRID_MIN_COLUMN_WIDTH = 300
const WORKSPACE_LIST_ROW_HEIGHT = 48
const WORKSPACE_LIST_GAP = 6
const renamingDocumentKey = ref(null)
const renamingDocumentTitle = ref('')
const renamingInput = ref(null)
const passwordForm = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
})
const passwordVisibility = reactive({
  current: false,
  next: false,
  confirm: false
})

/* ---------- 新建弹窗拖动 ---------- */

const createDialogElement = ref(null)
const createDialogOffset = reactive({ x: 0, y: 0 })
const createDialogStyle = computed(() => (
  createDialogOffset.x || createDialogOffset.y
    ? { transform: `translate3d(${createDialogOffset.x}px, ${createDialogOffset.y}px, 0)` }
    : null
))
const CREATE_DIALOG_EDGE_GAP = 24
let createDialogDrag = null

function resetCreateDialogOffset() {
  createDialogOffset.x = 0
  createDialogOffset.y = 0
}

function startCreateDialogDrag(event) {
  if (event.button !== undefined && event.button !== 0) {
    return
  }

  if (event.target instanceof Element && event.target.closest('button')) {
    return
  }

  const element = createDialogElement.value
  if (!element) {
    return
  }

  const rect = element.getBoundingClientRect()
  createDialogDrag = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    originX: createDialogOffset.x,
    originY: createDialogOffset.y,
    left: rect.left - createDialogOffset.x,
    top: rect.top - createDialogOffset.y,
    width: rect.width,
    height: rect.height
  }

  if (typeof event.currentTarget?.setPointerCapture === 'function') {
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // 指针捕获不可用时仍然可以用全局监听拖动
    }
  }

  window.addEventListener('pointermove', moveCreateDialogDrag)
  window.addEventListener('pointerup', endCreateDialogDrag)
  window.addEventListener('pointercancel', endCreateDialogDrag)
}

function moveCreateDialogDrag(event) {
  if (!createDialogDrag || event.pointerId !== createDialogDrag.pointerId) {
    return
  }

  event.preventDefault()
  const drag = createDialogDrag
  const bounds = getCreateDialogBounds(drag)

  createDialogOffset.x = clampNumber(drag.originX + event.clientX - drag.startX, bounds.minX, bounds.maxX)
  createDialogOffset.y = clampNumber(drag.originY + event.clientY - drag.startY, bounds.minY, bounds.maxY)
}

// 限制拖动范围：弹窗始终完整留在视口内（视口变小时会重新夹紧），避免拖出屏幕后找不回来
function getCreateDialogBounds({ left, top, width, height }) {
  return {
    minX: CREATE_DIALOG_EDGE_GAP - left,
    maxX: window.innerWidth - CREATE_DIALOG_EDGE_GAP - left - width,
    minY: CREATE_DIALOG_EDGE_GAP - top,
    maxY: window.innerHeight - CREATE_DIALOG_EDGE_GAP - top - height
  }
}

function clampCreateDialogOffset() {
  if (!isCreateDialogOpen.value) {
    return
  }

  const element = createDialogElement.value
  if (!element) {
    return
  }

  const rect = element.getBoundingClientRect()
  const bounds = getCreateDialogBounds({
    left: rect.left - createDialogOffset.x,
    top: rect.top - createDialogOffset.y,
    width: rect.width,
    height: rect.height
  })
  createDialogOffset.x = clampNumber(createDialogOffset.x, bounds.minX, bounds.maxX)
  createDialogOffset.y = clampNumber(createDialogOffset.y, bounds.minY, bounds.maxY)
}

function endCreateDialogDrag() {
  createDialogDrag = null
  window.removeEventListener('pointermove', moveCreateDialogDrag)
  window.removeEventListener('pointerup', endCreateDialogDrag)
  window.removeEventListener('pointercancel', endCreateDialogDrag)
}

function clampNumber(value, min, max) {
  const lower = Math.min(min, max)
  const upper = Math.max(min, max)
  return Math.min(Math.max(value, lower), upper)
}

let workspaceMessageTimer = null
let documentCounter = 0

function clearWorkspaceMessageTimer() {
  if (!workspaceMessageTimer) {
    return
  }

  window.clearTimeout(workspaceMessageTimer)
  workspaceMessageTimer = null
}

function clearWorkspaceMessage() {
  clearWorkspaceMessageTimer()
  workspaceMessage.value = ''
}

function setWorkspaceMessage(message, { duration = 2600 } = {}) {
  clearWorkspaceMessageTimer()
  workspaceMessage.value = message || ''

  if (!workspaceMessage.value || duration <= 0) {
    return
  }

  workspaceMessageTimer = window.setTimeout(() => {
    workspaceMessage.value = ''
    workspaceMessageTimer = null
  }, duration)
}

onBeforeUnmount(() => {
  workspaceBrowserResizeObserver?.disconnect()
  workspaceBrowserResizeObserver = null
  clearWorkspaceMessageTimer()
  endCreateDialogDrag()
  window.removeEventListener('resize', clampCreateDialogOffset)
  window.removeEventListener('diagram-editor:unauthorized', handleUnauthorized)
  window.removeEventListener('keydown', handleGlobalKeydown)
  window.removeEventListener('pointerdown', handleWorkspaceContextPointerDown, true)
  window.removeEventListener('scroll', closeWorkspaceContextMenu, true)
  window.removeEventListener('pointermove', onWorkspaceMarqueeMove)
  window.removeEventListener('pointerup', endWorkspaceMarquee)
  window.removeEventListener('pointercancel', endWorkspaceMarquee)
})

const blankModes = computed(() => [
  {
    mode: 'flowchart',
    label: t('workspace.newFlowchart'),
    displayLabel: t('workspace.flowchart'),
  },
  {
    mode: 'mindmap',
    label: t('workspace.newMindmap'),
    displayLabel: t('workspace.mindmap'),
  },
  {
    mode: 'markdown',
    label: t('workspace.newMarkdown'),
    displayLabel: t('workspace.markdown'),
  },
  {
    mode: 'mind-note',
    label: t('workspace.newMindNote'),
    displayLabel: t('workspace.mindNote'),
  }
])

const templateModes = computed(() => [
  {
    mode: 'template-flow',
    label: t('workspace.newFlowSample'),
    displayLabel: t('workspace.flowSample'),
    description: t('workspace.flowSampleDesc'),
  },
  {
    mode: 'template-approval',
    label: t('workspace.newApproval'),
    displayLabel: t('workspace.approval'),
    description: t('workspace.approvalDesc'),
  },
  {
    mode: 'template-lane',
    label: t('workspace.newLane'),
    displayLabel: t('workspace.lane'),
    description: t('workspace.laneDesc'),
  },
  {
    mode: 'template-org',
    label: t('workspace.newOrg'),
    displayLabel: t('workspace.org'),
    description: t('workspace.orgDesc'),
  },
  {
    mode: 'template-timeline',
    label: t('workspace.newTimeline'),
    displayLabel: t('workspace.timeline'),
    description: t('workspace.timelineDesc'),
  }
])

const mindmapTemplateModes = computed(() => [
  {
    mode: 'template-mind-project',
    label: t('workspace.newMindProject'),
    displayLabel: t('workspace.mindProject'),
    description: t('workspace.mindProjectDesc'),
  },
  {
    mode: 'template-mind-meeting',
    label: t('workspace.newMindMeeting'),
    displayLabel: t('workspace.mindMeeting'),
    description: t('workspace.mindMeetingDesc'),
  },
  {
    mode: 'template-mind-reading',
    label: t('workspace.newMindReading'),
    displayLabel: t('workspace.mindReading'),
    description: t('workspace.mindReadingDesc'),
  },
  {
    mode: 'template-mind-swot',
    label: t('workspace.newMindSwot'),
    displayLabel: t('workspace.mindSwot'),
    description: t('workspace.mindSwotDesc'),
  },
  {
    mode: 'template-mind-retro',
    label: t('workspace.newMindRetro'),
    displayLabel: t('workspace.mindRetro'),
    description: t('workspace.mindRetroDesc'),
  },
  {
    mode: 'template-mind-competitor',
    label: t('workspace.newMindCompetitor'),
    displayLabel: t('workspace.mindCompetitor'),
    description: t('workspace.mindCompetitorDesc'),
  },
  {
    mode: 'template-mind-weekly',
    label: t('workspace.newMindWeekly'),
    displayLabel: t('workspace.mindWeekly'),
    description: t('workspace.mindWeeklyDesc'),
  },
  {
    mode: 'template-mind-prd',
    label: t('workspace.newMindPrd'),
    displayLabel: t('workspace.mindPrd'),
    description: t('workspace.mindPrdDesc'),
  }
])

const noteTemplateModes = computed(() => [
  {
    mode: 'template-note-meeting',
    label: t('workspace.newNoteMeeting'),
    displayLabel: t('workspace.noteMeeting'),
    description: t('workspace.noteMeetingDesc'),
  },
  {
    mode: 'template-note-retro',
    label: t('workspace.newNoteRetro'),
    displayLabel: t('workspace.noteRetro'),
    description: t('workspace.noteRetroDesc'),
  }
])

const creationModes = computed(() => [
  { mode: '__group__', displayLabel: t('workspace.blankDocs') },
  ...blankModes.value,
  { mode: '__group__', displayLabel: t('workspace.templates') },
  ...templateModes.value,
  { mode: '__group__', displayLabel: t('workspace.mindTemplates') },
  ...mindmapTemplateModes.value,
  { mode: '__group__', displayLabel: t('workspace.noteTemplates') },
  ...noteTemplateModes.value
])

const currentUser = computed(() => sessionState.currentUser.value)
const activeWorkspaceDocument = computed(() => openDocuments.value.find(item => item.key === activeDocumentKey.value) || null)
const workspaceCards = computed(() => openDocuments.value.map(item => {
  const preview = buildWorkspacePreview(item)
  const pages = preview.pages || []
  const preferredPageId = workspacePreviewPageIds[item.key]
  let previewPageIndex = pages.findIndex(page => page.id === preferredPageId)
  if (previewPageIndex < 0) {
    previewPageIndex = pages.findIndex(page => page.id === preview.activePageId)
  }
  if (previewPageIndex < 0) {
    previewPageIndex = 0
  }
  const currentPreview = pages[previewPageIndex] || preview
  return {
    ...item,
    sequenceNo: Number(item.snapshot?.sequenceNo) || null,
    preview,
    currentPreview,
    previewPageIndex,
    previewPageCount: pages.length,
    summary: describeWorkspaceDocument(item)
  }
}))

const filteredWorkspaceCards = computed(() => {
  const query = workspaceSearchQuery.value.trim().toLowerCase()
  return workspaceCards.value.filter(item => {
    if (workspaceModeFilter.value !== 'all' && item.mode !== workspaceModeFilter.value) {
      return false
    }
    return !query || workspaceCardSearchText(item).includes(query)
  })
})

const sortedWorkspaceCards = computed(() => {
  const cards = [...filteredWorkspaceCards.value]
  if (!workspaceSortKey.value) {
    return cards
  }
  const direction = workspaceSortDirection.value === 'desc' ? -1 : 1
  return cards.sort((left, right) => {
    let result = 0
    if (workspaceSortKey.value === 'pages') {
      result = left.previewPageCount - right.previewPageCount
    } else if (workspaceSortKey.value === 'sequence') {
      result = (left.sequenceNo || Number.MAX_SAFE_INTEGER) - (right.sequenceNo || Number.MAX_SAFE_INTEGER)
    } else {
      const leftValue = workspaceSortKey.value === 'title'
        ? String(left.title || '')
        : (workspaceSortKey.value === 'mode' ? modeLabel(left.mode) : String(left.summary || ''))
      const rightValue = workspaceSortKey.value === 'title'
        ? String(right.title || '')
        : (workspaceSortKey.value === 'mode' ? modeLabel(right.mode) : String(right.summary || ''))
      result = leftValue.localeCompare(rightValue, 'zh-CN', { numeric: true, sensitivity: 'base' })
    }
    if (result === 0) {
      result = String(left.key).localeCompare(String(right.key), 'zh-CN', { numeric: true })
    }
    return result * direction
  })
})

const workspaceAutoPageSize = computed(() => {
  const fallbackHeight = typeof window === 'undefined' ? 720 : window.innerHeight - 92
  const browserHeight = Math.max(220, workspaceBrowserHeight.value || fallbackHeight)
  const headerSpace = workspaceLayout.value === 'list' ? WORKSPACE_LIST_HEADER_SPACE : 0
  const availableHeight = Math.max(120, browserHeight - WORKSPACE_PAGINATION_SPACE - headerSpace)
  if (workspaceLayout.value === 'list') {
    const rowStep = WORKSPACE_LIST_ROW_HEIGHT + WORKSPACE_LIST_GAP
    return Math.max(1, Math.floor((availableHeight + WORKSPACE_LIST_GAP) / rowStep))
  }

  const browserWidth = workspaceBrowserWidth.value || (typeof window === 'undefined' ? 1200 : window.innerWidth - 48)
  const columns = Math.max(1, Math.floor(
    (browserWidth + WORKSPACE_GRID_GAP) / (WORKSPACE_GRID_MIN_COLUMN_WIDTH + WORKSPACE_GRID_GAP)
  ))
  const rowStep = WORKSPACE_GRID_CARD_HEIGHT + WORKSPACE_GRID_GAP
  const rows = Math.max(1, Math.floor((availableHeight + WORKSPACE_GRID_GAP) / rowStep))
  return columns * rows
})

const workspacePageSize = computed(() => (
  typeof workspacePageSizeSetting.value === 'number'
    ? workspacePageSizeSetting.value
    : workspaceAutoPageSize.value
))

const workspaceTotalPages = computed(() => Math.max(
  1,
  Math.ceil(filteredWorkspaceCards.value.length / workspacePageSize.value)
))

const workspaceCurrentPage = computed(() => Math.min(
  workspaceTotalPages.value,
  Math.max(1, workspacePage.value)
))

const pagedWorkspaceCards = computed(() => {
  const start = (workspaceCurrentPage.value - 1) * workspacePageSize.value
  return sortedWorkspaceCards.value.slice(start, start + workspacePageSize.value)
})

const workspaceVisibleRange = computed(() => {
  const total = filteredWorkspaceCards.value.length
  if (!total) {
    return { start: 0, end: 0 }
  }
  const start = (workspaceCurrentPage.value - 1) * workspacePageSize.value + 1
  return {
    start,
    end: Math.min(total, start + workspacePageSize.value - 1)
  }
})

const workspacePaginationItems = computed(() => {
  const total = workspaceTotalPages.value
  const current = workspaceCurrentPage.value
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1)
  }
  const pages = new Set([1, total, current - 1, current, current + 1])
  const sorted = [...pages].filter(page => page >= 1 && page <= total).sort((a, b) => a - b)
  const result = []
  sorted.forEach((page, index) => {
    if (index && page - sorted[index - 1] > 1) {
      result.push('…')
    }
    result.push(page)
  })
  return result
})

function measureWorkspaceBrowser(element = workspaceBrowserRef.value) {
  if (!element) {
    return
  }
  workspaceBrowserHeight.value = element.clientHeight
  workspaceBrowserWidth.value = element.clientWidth
}

watch(workspaceBrowserRef, element => {
  workspaceBrowserResizeObserver?.disconnect()
  workspaceBrowserResizeObserver = null
  if (!element) {
    return
  }
  measureWorkspaceBrowser(element)
  if (typeof ResizeObserver === 'undefined') {
    return
  }
  workspaceBrowserResizeObserver = new ResizeObserver(() => measureWorkspaceBrowser(element))
  workspaceBrowserResizeObserver.observe(element)
}, { flush: 'post' })

watch(workspaceTotalPages, total => {
  if (workspacePage.value > total) {
    workspacePage.value = total
  } else if (workspacePage.value < 1) {
    workspacePage.value = 1
  }
})

function workspaceCardSearchText(item) {
  const content = item.snapshot?.content || {}
  const nodes = Array.isArray(content.nodes) ? content.nodes : []
  const textBlocks = Array.isArray(content.textBlocks) ? content.textBlocks : []
  return [
    item.title,
    item.summary,
    modeLabel(item.mode),
    content.sourceText,
    ...nodes.flatMap(node => [node.text, node.note, ...(node.labels || [])]),
    ...textBlocks.map(block => block.text)
  ].join(' ').toLowerCase()
}

function applyWorkspaceSearch() {
  workspaceSearchQuery.value = workspaceSearchDraft.value.trim()
  workspacePage.value = 1
  clearWorkspaceSelection()
}

function applyWorkspaceModeFilter() {
  workspacePage.value = 1
  clearWorkspaceSelection()
}

function formatWorkspaceSequence(sequenceNo) {
  const value = Number(sequenceNo)
  return Number.isFinite(value) && value > 0 ? `#${String(Math.round(value)).padStart(3, '0')}` : '#—'
}

function sortWorkspaceCards(key) {
  if (!['sequence', 'title', 'mode', 'summary', 'pages'].includes(key)) {
    return
  }
  if (workspaceSortKey.value === key) {
    workspaceSortDirection.value = workspaceSortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    workspaceSortKey.value = key
    workspaceSortDirection.value = 'asc'
  }
  workspacePage.value = 1
}

function resetWorkspaceSearch() {
  workspaceSearchDraft.value = ''
  workspaceSearchQuery.value = ''
  workspaceModeFilter.value = 'all'
  workspacePage.value = 1
  clearWorkspaceSelection()
}

if (currentUser.value) {
  void hydrateAuthenticatedWorkspace(currentUser.value)
}

watch(() => editorState.document.value, document => {
  if (!activeDocumentKey.value || !document) {
    return
  }

  const target = openDocuments.value.find(item => item.key === activeDocumentKey.value)
  if (!target) {
    return
  }

  target.title = document.title
  target.mode = document.mode
  target.snapshot = cloneDocument(document)
}, { deep: true })

watch([
  () => currentUser.value?.userId || '',
  openDocuments,
  activeDocumentKey
], ([userId, documents, activeKey]) => {
  if (!userId) {
    return
  }

  persistWorkspace(userId, {
    activeDocumentKey: activeKey,
    documentCounter,
    openDocuments: documents
  })
}, { deep: true })

const REMEMBERED_LOGIN_KEY = 'process:remembered-login'

function persistRememberedLogin(username, password, remember) {
  try {
    if (!remember) {
      window.localStorage.removeItem(REMEMBERED_LOGIN_KEY)
      return
    }
    window.localStorage.setItem(REMEMBERED_LOGIN_KEY, JSON.stringify({
      username,
      password: window.btoa(unescape(encodeURIComponent(password)))
    }))
  } catch {
    // 本地存储不可用时只影响记住密码
  }
}

function clearRememberedLogin() {
  try {
    window.localStorage.removeItem(REMEMBERED_LOGIN_KEY)
  } catch {
    // ignore
  }
}

async function login(credentials) {
  const normalized = String(credentials?.username || '').trim()
  const password = String(credentials?.password || '')
  const remember = credentials?.remember === true

  if (!normalized) {
    loginError.value = t('auth.enterUsername')
    return
  }

  if (!password) {
    loginError.value = t('auth.enterPassword')
    return
  }

  isLoggingIn.value = true
  loginError.value = ''
  clearWorkspaceMessage()

  try {
    const user = await api.login(normalized, password)
    persistRememberedLogin(normalized, password, remember)
    await hydrateAuthenticatedWorkspace(user)
  } catch (error) {
    loginError.value = error.status === 429
      ? t('auth.tooManyAttempts')
      : (error.status === 401
          ? t('auth.invalidCredentials')
          : (error.message || t('auth.loginFailed')))
  } finally {
    isLoggingIn.value = false
  }
}

async function forgotPassword(payload) {
  const username = String(payload?.username || '').trim()
  const recoveryCode = normalizeRecoveryCode(payload?.recoveryCode)
  const newPassword = String(payload?.newPassword || '')
  const confirmPassword = String(payload?.confirmPassword || '')

  if (!username) {
    loginError.value = t('auth.enterUsername')
    return
  }

  if (!recoveryCode) {
    loginError.value = t('auth.enterRecoveryCode')
    return
  }

  if (!newPassword) {
    loginError.value = t('auth.enterNewPassword')
    return
  }

  if (newPassword.length < 8) {
    loginError.value = t('auth.passwordTooShort')
    return
  }

  if (newPassword !== confirmPassword) {
    loginError.value = t('auth.passwordMismatch')
    return
  }

  isLoggingIn.value = true
  loginError.value = ''

  try {
    await hydrateAuthenticatedWorkspace(await api.forgotPassword(username, recoveryCode, newPassword))
    setWorkspaceMessage(t('workspace.passwordReset'), { duration: 3200 })
  } catch (error) {
    loginError.value = error.status === 429
      ? t('auth.tooManyAttempts')
      : (error.status === 400 || error.status === 401
          ? t('auth.recoveryCodeWrong')
          : (error.message || t('auth.forgotFailed')))
  } finally {
    isLoggingIn.value = false
  }
}

function normalizeRecoveryCode(value) {
  return String(value || '')
    .replace(/\s+/g, '')
    .toUpperCase()
}

async function changePassword() {
  if (!passwordForm.currentPassword) {
    securityError.value = t('auth.enterCurrentPassword')
    return
  }

  if (!passwordForm.newPassword) {
    securityError.value = t('auth.enterNewPassword')
    return
  }

  if (passwordForm.newPassword.length < 8) {
    securityError.value = t('auth.passwordTooShort')
    return
  }

  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    securityError.value = t('auth.passwordMismatch')
    return
  }

  isChangingPassword.value = true
  securityError.value = ''
  securityMessage.value = ''

  try {
    sessionState.setUser(await api.changePassword(
      passwordForm.currentPassword,
      passwordForm.newPassword,
      currentUser.value.token
    ))
    clearPasswordForm()
    clearRememberedLogin()
    securityMessage.value = t('auth.passwordUpdated')
  } catch (error) {
    securityError.value = error.status === 429
      ? t('auth.tooManyAttempts')
      : (error.status === 400 || error.status === 401
          ? t('auth.currentPasswordWrong')
          : (error.message || t('auth.changeFailed')))
  } finally {
    isChangingPassword.value = false
  }
}

function handleUnauthorized(event) {
  if (!currentUser.value) {
    return
  }
  const message = t('auth.sessionExpired')
  sessionState.clearUser()
  editorState.resetForLogout()
  cancelRenameDocument()
  closeCreateDialog()
  closeDocumentMenu()
  clearWorkspaceMessage()
  securityError.value = ''
  securityMessage.value = ''
  isSecurityPanelOpen.value = false
  clearPasswordForm()
  openDocuments.value = []
  selectedWorkspaceKeys.value = []
  workspaceModeFilter.value = 'all'
  workspaceSortKey.value = ''
  workspaceSortDirection.value = 'asc'
  activeDocumentKey.value = null
  workspaceView.value = 'home'
  loginError.value = message
}

async function logout() {
  if (isLoggingOut.value) {
    return
  }
  isLoggingOut.value = true
  const token = currentUser.value?.token
  if (token) {
    try {
      await api.logout(token)
    } catch (error) {
      // 退出登录必须在本地完成，即使服务端会话已经失效。
    }
  }
  sessionState.clearUser()
  editorState.resetForLogout()
  cancelRenameDocument()
  closeCreateDialog()
  closeDocumentMenu()
  loginError.value = ''
  clearWorkspaceMessage()
  securityError.value = ''
  securityMessage.value = ''
  isSecurityPanelOpen.value = false
  clearPasswordForm()
  openDocuments.value = []
  selectedWorkspaceKeys.value = []
  workspaceModeFilter.value = 'all'
  workspaceSortKey.value = ''
  workspaceSortDirection.value = 'asc'
  activeDocumentKey.value = null
  workspaceView.value = 'home'
  isLoggingOut.value = false
}

async function hydrateAuthenticatedWorkspace(user) {
  sessionState.setUser(user)
  await loadWorkspaceCatalog(user)
  securityError.value = ''
  securityMessage.value = ''
}

function toggleSecurityPanel() {
  if (!isSecurityPanelOpen.value) {
    closeCreateDialog()
    cancelRenameDocument()
  }
  isSecurityPanelOpen.value = !isSecurityPanelOpen.value
  if (!isSecurityPanelOpen.value) {
    closeSecurityPanel()
  }
}

function closeSecurityPanel() {
  isSecurityPanelOpen.value = false
  securityError.value = ''
  securityMessage.value = ''
  clearPasswordForm()
}

function clearPasswordForm() {
  passwordForm.currentPassword = ''
  passwordForm.newPassword = ''
  passwordForm.confirmPassword = ''
  passwordVisibility.current = false
  passwordVisibility.next = false
  passwordVisibility.confirm = false
}

function createDocument(mode) {
  closeDocumentMenu()
  cancelRenameDocument()
  closeCreateDialog()
  const localizedTitle = {
    flowchart: t('workspace.flowchart'),
    mindmap: t('workspace.mindmap'),
    markdown: t('workspace.markdown'),
    'mind-note': t('workspace.mindNote')
  }[mode]
  editorState.startNewDocument({ mode, title: localizedTitle })
  const firstPage = editorState.document.value.content.pages?.[0]
  if (firstPage) {
    editorState.renamePage(firstPage.id, t('editor.pageDefault', { n: 1 }))
  }
  const key = nextDocumentKey()
  const storedMode = mode.startsWith('template-mind') ? 'mindmap' : mode
  activeDocumentKey.value = key
  openDocuments.value.unshift({
    key,
    title: editorState.document.value.title,
    mode: storedMode,
    snapshot: cloneDocument(editorState.document.value)
  })
  workspaceView.value = 'editor'
}

async function openDocument(key) {
  closeDocumentMenu()
  closeWorkspaceContextMenu()
  clearWorkspaceSelection()
  cancelRenameDocument()
  const target = openDocuments.value.find(item => item.key === key)
  if (!target || isWorkspaceLoading.value) {
    return
  }

  if (target.summaryOnly && target.snapshot?.id) {
    isWorkspaceLoading.value = true
    try {
      const remote = await api.getDocument(target.snapshot.id, currentUser.value.token)
      target.snapshot = normalizeDocument(remote)
      target.title = target.snapshot.title
      target.mode = target.snapshot.mode
      target.summaryOnly = false
    } catch (error) {
      setWorkspaceMessage(error.message || t('workspace.loadFailed'), { duration: 3600 })
      return
    } finally {
      isWorkspaceLoading.value = false
    }
  }

  activeDocumentKey.value = key
  editorState.openDocumentSnapshot(target.snapshot)
  workspaceView.value = 'editor'
}

function startRenameDocument(key) {
  closeDocumentMenu()
  closeWorkspaceContextMenu()
  closeCreateDialog()
  const target = openDocuments.value.find(item => item.key === key)
  if (!target) {
    return
  }

  renamingDocumentKey.value = key
  renamingDocumentTitle.value = target.title
  nextTick(() => {
    renamingInput.value?.focus()
    renamingInput.value?.select()
  })
}

async function commitRenameDocument() {
  const key = renamingDocumentKey.value
  if (!key) {
    return
  }

  const target = openDocuments.value.find(item => item.key === key)
  if (!target) {
    cancelRenameDocument()
    return
  }

  const currentTitle = String(target.title || target.snapshot?.title || t('workspace.untitled')).trim() || t('workspace.untitled')
  const nextTitle = String(renamingDocumentTitle.value || '').trim() || currentTitle

  if (nextTitle === currentTitle) {
    cancelRenameDocument()
    return
  }

  try {
    if (target.snapshot?.id) {
      const fullSnapshot = target.summaryOnly
        ? normalizeDocument(await api.getDocument(target.snapshot.id, currentUser.value.token))
        : cloneDocument(target.snapshot)
      const payload = cloneDocument(fullSnapshot)
      payload.title = nextTitle
      const savedDocument = normalizeDocument(await api.updateDocument(payload.id, payload, currentUser.value.token))
      target.title = savedDocument.title
      target.mode = savedDocument.mode
      target.summaryOnly = false
      target.snapshot = savedDocument
    } else {
      target.title = nextTitle
      if (target.snapshot && typeof target.snapshot === 'object') {
        target.snapshot.title = nextTitle
      }
    }

    if (activeDocumentKey.value === key) {
      editorState.updateTitle(nextTitle)
    }

    setWorkspaceMessage(t('workspace.renamed'))
  } catch (error) {
    setWorkspaceMessage(error.message || t('workspace.renameFailed'), { duration: 3600 })
  }

  cancelRenameDocument()
}

function cancelRenameDocument() {
  renamingDocumentKey.value = null
  renamingDocumentTitle.value = ''
}

async function deleteDocument(key) {
  closeDocumentMenu()
  closeWorkspaceContextMenu()
  cancelRenameDocument()
  const target = openDocuments.value.find(item => item.key === key)
  if (!target) {
    return
  }

  try {
    if (target.snapshot?.id) {
      await api.deleteDocument(target.snapshot.id, currentUser.value.token)
    }
    removeWorkspaceDocument(key)
    setWorkspaceMessage(t('workspace.deleted'))
  } catch (error) {
    setWorkspaceMessage(error.message || t('workspace.deleteFailed'), { duration: 3600 })
  }
}

function removeWorkspaceDocument(key) {
  openDocuments.value = openDocuments.value.filter(item => item.key !== key)
  if (activeDocumentKey.value === key) {
    activeDocumentKey.value = null
    workspaceView.value = 'home'
  }
}

function returnToWorkspace() {
  workspaceView.value = 'home'
  closeDocumentMenu()
  clearWorkspaceSelection()
}

function handleBrandClick() {
  if (currentUser.value && workspaceView.value === 'editor') {
    returnToWorkspace()
  }
}

function openCreateDialog() {
  closeDocumentMenu()
  closeWorkspaceContextMenu()
  clearWorkspaceSelection()
  cancelRenameDocument()
  closeSecurityPanel()
  resetCreateDialogOffset()
  isCreateDialogOpen.value = true
}

function closeCreateDialog() {
  isCreateDialogOpen.value = false
  resetCreateDialogOffset()
}

function selectWorkspacePreviewPage(key, pageId) {
  if (!key || !pageId) {
    return
  }
  workspacePreviewPageIds[key] = pageId
}

function cycleWorkspacePreviewPage(key, delta) {
  const item = workspaceCards.value.find(card => card.key === key)
  const pages = item?.preview?.pages || []
  if (pages.length < 2) {
    return
  }
  const nextIndex = (item.previewPageIndex + delta + pages.length) % pages.length
  selectWorkspacePreviewPage(key, pages[nextIndex].id)
}

function toggleDocumentMenu(key) {
  closeWorkspaceContextMenu()
  activeDocumentMenuKey.value = activeDocumentMenuKey.value === key ? null : key
}

function closeDocumentMenu() {
  activeDocumentMenuKey.value = null
}

function openDocumentContextMenu(key, event) {
  activeDocumentMenuKey.value = null
  workspaceContextMenu.value = {
    key,
    x: event.clientX,
    y: event.clientY
  }
  nextTick(() => {
    const menu = workspaceContextMenuRef.value
    if (!menu || !workspaceContextMenu.value) {
      return
    }
    const rect = menu.getBoundingClientRect()
    workspaceContextMenu.value.x = Math.max(8, Math.min(event.clientX, window.innerWidth - rect.width - 8))
    workspaceContextMenu.value.y = Math.max(8, Math.min(event.clientY, window.innerHeight - rect.height - 8))
  })
}

function closeWorkspaceContextMenu() {
  workspaceContextMenu.value = null
}

function handleWorkspaceContextPointerDown(event) {
  if (!workspaceContextMenu.value) {
    return
  }
  if (workspaceContextMenuRef.value?.contains(event.target)) {
    return
  }
  closeWorkspaceContextMenu()
}

function openWorkspaceContextDocument() {
  const key = workspaceContextMenu.value?.key
  closeWorkspaceContextMenu()
  if (key) {
    openDocument(key)
  }
}

function renameWorkspaceContextDocument() {
  const key = workspaceContextMenu.value?.key
  closeWorkspaceContextMenu()
  if (key) {
    startRenameDocument(key)
  }
}

function deleteWorkspaceContextDocument() {
  const key = workspaceContextMenu.value?.key
  closeWorkspaceContextMenu()
  if (key) {
    deleteDocument(key)
  }
}

function clearWorkspaceSelection() {
  selectedWorkspaceKeys.value = []
}

function setWorkspaceLayout(layout) {
  workspaceLayout.value = layout === 'list' ? 'list' : 'grid'
  workspacePage.value = 1
  clearWorkspaceSelection()
}

function goToWorkspacePage(page) {
  if (typeof page !== 'number') {
    return
  }
  workspacePage.value = Math.min(workspaceTotalPages.value, Math.max(1, page))
}

function setWorkspacePageSize(event) {
  const numericValue = Number(event?.target?.value)
  const nextValue = Number.isFinite(numericValue) && numericValue > 0
    ? Math.min(1000, Math.round(numericValue))
    : 'auto'
  workspacePageSizeSetting.value = nextValue
  workspacePage.value = 1
  try {
    window.localStorage.setItem(WORKSPACE_PAGE_SIZE_KEY, String(nextValue))
  } catch {
    // 本地存储不可用时只影响持久化，当前选择仍然生效
  }
}

function toggleWorkspaceSelection(key) {
  if (!key) {
    return
  }
  const current = new Set(selectedWorkspaceKeys.value)
  if (current.has(key)) {
    current.delete(key)
  } else {
    current.add(key)
  }
  selectedWorkspaceKeys.value = [...current]
}

function workspaceKeyFromElement(element) {
  const card = element?.closest?.('[data-testid^="workspace-card-"]')
  return card?.getAttribute('data-testid')?.replace('workspace-card-', '') || null
}

function handleWorkspaceCardOpen(key, event) {
  if (suppressWorkspaceCardOpen) {
    event?.preventDefault?.()
    event?.stopPropagation?.()
    suppressWorkspaceCardOpen = false
    return
  }
  if (event?.ctrlKey || event?.metaKey) {
    event.preventDefault()
    event.stopPropagation()
    toggleWorkspaceSelection(key)
    return
  }
  if (selectedWorkspaceKeys.value.length) {
    event?.preventDefault?.()
    event?.stopPropagation?.()
    toggleWorkspaceSelection(key)
    return
  }
  clearWorkspaceSelection()
  openDocument(key)
}

function beginWorkspaceMarquee(event) {
  if (event.button !== 0 || !(event.ctrlKey || event.metaKey)) {
    return
  }
  if (event.target instanceof Element && event.target.closest(
    '.workspace-card-menu-trigger, .workspace-card-page-switcher, .workspace-card-menu'
  )) {
    return
  }
  event.preventDefault()
  workspaceMarqueeGesture = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    cardKey: workspaceKeyFromElement(event.target)
  }
  workspaceMarquee.value = {
    x: event.clientX,
    y: event.clientY,
    width: 0,
    height: 0,
    active: false
  }
  window.addEventListener('pointermove', onWorkspaceMarqueeMove)
  window.addEventListener('pointerup', endWorkspaceMarquee)
  window.addEventListener('pointercancel', endWorkspaceMarquee)
}

function onWorkspaceMarqueeMove(event) {
  const gesture = workspaceMarqueeGesture
  if (!gesture || event.pointerId !== gesture.pointerId) {
    return
  }
  const distance = Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY)
  if (distance < 4 && !workspaceMarquee.value?.active) {
    return
  }
  const left = Math.min(gesture.startX, event.clientX)
  const top = Math.min(gesture.startY, event.clientY)
  const right = Math.max(gesture.startX, event.clientX)
  const bottom = Math.max(gesture.startY, event.clientY)
  workspaceMarquee.value = {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
    active: true
  }
  const selected = []
  window.document.querySelectorAll('.workspace-gallery .workspace-card').forEach(card => {
    const rect = card.getBoundingClientRect()
    if (rect.left < right && rect.right > left && rect.top < bottom && rect.bottom > top) {
      const key = workspaceKeyFromElement(card)
      if (key) {
        selected.push(key)
      }
    }
  })
  selectedWorkspaceKeys.value = selected
}

function endWorkspaceMarquee(event) {
  const gesture = workspaceMarqueeGesture
  if (!gesture) {
    return
  }
  const wasActive = Boolean(workspaceMarquee.value?.active)
  if (!wasActive && gesture.cardKey && event?.pointerId === gesture.pointerId) {
    toggleWorkspaceSelection(gesture.cardKey)
  }
  workspaceMarqueeGesture = null
  workspaceMarquee.value = null
  window.removeEventListener('pointermove', onWorkspaceMarqueeMove)
  window.removeEventListener('pointerup', endWorkspaceMarquee)
  window.removeEventListener('pointercancel', endWorkspaceMarquee)
  suppressWorkspaceCardOpen = true
  window.setTimeout(() => {
    suppressWorkspaceCardOpen = false
  }, 0)
}

async function deleteSelectedWorkspaceDocuments() {
  const keys = [...selectedWorkspaceKeys.value]
  if (!keys.length || !currentUser.value) {
    return
  }
  closeDocumentMenu()
  closeWorkspaceContextMenu()
  const failed = []
  let deleted = 0
  for (const key of keys) {
    const target = openDocuments.value.find(item => item.key === key)
    if (!target) {
      continue
    }
    try {
      if (target.snapshot?.id) {
        await api.deleteDocument(target.snapshot.id, currentUser.value.token)
      }
      removeWorkspaceDocument(key)
      deleted += 1
    } catch (error) {
      failed.push(key)
    }
  }
  selectedWorkspaceKeys.value = failed
  if (deleted) {
    setWorkspaceMessage(t('workspace.batchDeleted', { count: deleted }))
  }
  if (failed.length) {
    setWorkspaceMessage(t('workspace.batchDeleteFailed', { count: failed.length }), { duration: 3600 })
  }
}

async function loadWorkspaceCatalog(user) {
  isWorkspaceLoading.value = true
  workspacePage.value = 1
  workspaceModeFilter.value = 'all'
  workspaceSortKey.value = ''
  workspaceSortDirection.value = 'asc'
  closeDocumentMenu()
  clearWorkspaceSelection()
  cancelRenameDocument()
  closeCreateDialog()

  const savedWorkspace = readWorkspace(user?.userId)
  const localDocuments = normalizeWorkspaceDocuments(savedWorkspace?.openDocuments)
  documentCounter = Math.max(
    documentCounter,
    Number(savedWorkspace?.documentCounter) || 0,
    getWorkspaceCounter(localDocuments)
  )

  try {
    const remoteDocuments = normalizeRemoteWorkspaceDocuments(
      await api.listDocuments(user.token),
      localDocuments
    )
    openDocuments.value = mergeWorkspaceDocuments(localDocuments, remoteDocuments)
    clearWorkspaceMessage()
  } catch (error) {
    openDocuments.value = localDocuments
    setWorkspaceMessage(
      localDocuments.length
        ? t('workspace.restored')
        : (error.message || t('workspace.loadFailed')),
      { duration: localDocuments.length ? 2400 : 3600 }
    )
  } finally {
    activeDocumentKey.value = null
    workspaceView.value = 'home'
    isWorkspaceLoading.value = false
  }
}

function nextDocumentKey() {
  documentCounter += 1
  return `workspace-${documentCounter}`
}

function cloneDocument(document) {
  return JSON.parse(JSON.stringify(document))
}

function persistWorkspace(userId, workspace) {
  if (!userId || typeof window === 'undefined') {
    return
  }

  const normalizedDocuments = normalizeWorkspaceDocuments(workspace.openDocuments)
  try {
    if (!normalizedDocuments.length) {
      window.localStorage.removeItem(`${WORKSPACE_KEY_PREFIX}${userId}`)
      return
    }

    const payload = {
      activeDocumentKey: resolveActiveDocumentKey(normalizedDocuments, workspace.activeDocumentKey),
      documentCounter: Number(workspace.documentCounter) || getWorkspaceCounter(normalizedDocuments),
      openDocuments: normalizedDocuments
    }

    window.localStorage.setItem(`${WORKSPACE_KEY_PREFIX}${userId}`, JSON.stringify(payload))
  } catch {
    setWorkspaceMessage(t('workspace.storageFull'), { duration: 4200 })
  }
}

function readWorkspace(userId) {
  if (!userId || typeof window === 'undefined') {
    return null
  }

  try {
    const raw = window.localStorage.getItem(`${WORKSPACE_KEY_PREFIX}${userId}`)
    if (!raw) {
      return null
    }
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function normalizeWorkspaceDocuments(documents = []) {
  if (!Array.isArray(documents)) {
    return []
  }

  return documents.flatMap((item, index) => {
    if (!item?.snapshot || typeof item.snapshot !== 'object') {
      return []
    }

    const snapshot = normalizeDocument(cloneDocument(item.snapshot))
    const key = typeof item.key === 'string' && item.key.trim()
      ? item.key.trim()
      : `workspace-restored-${index + 1}`

    return [{
      key,
      title: String(item.title || snapshot.title || t('workspace.untitled')).trim() || t('workspace.untitled'),
      mode: String(item.mode || snapshot.mode || 'flowchart').trim() || 'flowchart',
      summaryOnly: item.summaryOnly === true,
      snapshot
    }]
  })
}

function normalizeRemoteWorkspaceDocuments(documents = [], localDocuments = []) {
  if (!Array.isArray(documents)) {
    return []
  }

  return documents.flatMap(item => {
    const snapshot = normalizeDocument(cloneDocument(item))
    if (!snapshot?.mode || !snapshot?.title) {
      return []
    }

    const existing = localDocuments.find(localItem => String(localItem.snapshot?.id || '') === String(snapshot.id || ''))
    return [{
      key: existing?.key || nextDocumentKey(),
      title: snapshot.title,
      mode: snapshot.mode,
      summaryOnly: item.summaryOnly === true,
      snapshot
    }]
  })
}

function mergeWorkspaceDocuments(localDocuments = [], remoteDocuments = []) {
  const merged = [...localDocuments]
  const byId = new Map(merged
    .map(item => [String(item.snapshot?.id || ''), item])
    .filter(([id]) => Boolean(id)))

  remoteDocuments.forEach(item => {
    const snapshotId = String(item.snapshot?.id || '')
    if (!snapshotId) {
      return
    }
    const existing = byId.get(snapshotId)
    if (existing) {
      const sequenceNo = Number(item.snapshot?.sequenceNo)
      if ((!existing.snapshot.sequenceNo || existing.snapshot.sequenceNo <= 0) && sequenceNo > 0) {
        existing.snapshot.sequenceNo = Math.round(sequenceNo)
      }
      return
    }
    merged.push(item)
    byId.set(snapshotId, item)
  })

  return merged
}

function resolveActiveDocumentKey(documents, activeKey) {
  if (!documents.length) {
    return null
  }

  return documents.some(item => item.key === activeKey)
    ? activeKey
    : documents[0].key
}

function getWorkspaceCounter(documents = []) {
  return documents.reduce((maxValue, item) => {
    const match = /^workspace-(\d+)$/.exec(String(item?.key || ''))
    if (!match) {
      return maxValue
    }
    return Math.max(maxValue, Number(match[1]))
  }, 0)
}

function modeLabel(mode) {
  return {
    flowchart: t('workspace.flowchart'),
    mindmap: t('workspace.mindmap'),
    markdown: t('workspace.markdown'),
    'mind-note': t('workspace.mindNote')
  }[mode] || t('workspace.doc')
}

function describeWorkspaceDocument(item) {
  if (item.mode === 'markdown') {
    const lines = buildMarkdownPreviewLines(item.snapshot)
    return lines.slice(0, 2).join(' / ') || t('workspace.emptySummary')
  }

  const labels = extractDiagramPreviewLabels(item.snapshot)
  return labels.join(' / ') || t('workspace.emptySummary')
}

function buildWorkspacePreview(item) {
  const content = item.snapshot?.content || {}
  const activePageId = content.activePageId || ''
  const rawPages = Array.isArray(content.pages) && content.pages.length
    ? content.pages
    : [{ id: activePageId || 'page-1', name: '1', ...content }]

  const pages = rawPages.map((page, index) => {
    if (item.mode === 'markdown') {
      const lines = buildMarkdownPreviewLines({ content: page })
      return {
        id: page.id || `page-${index + 1}`,
        name: page.name || String(index + 1),
        kind: 'markdown',
        lines,
        empty: lines.length === 0
      }
    }
    const preview = buildDiagramPreview({ content: page }, item.mode)
    return {
      ...preview,
      id: page.id || `page-${index + 1}`,
      name: page.name || String(index + 1),
      empty: preview.nodes.length === 0 && preview.textBlocks.length === 0
    }
  })

  const current = pages.find(page => page.id === activePageId) || pages[0]
  return {
    ...current,
    pages,
    activePageId: current.id
  }
}

function buildMarkdownPreviewLines(snapshot) {
  const lines = String(snapshot?.content?.sourceText || '')
    .split(/\r?\n/)
    .map(line => line.replace(/^#+\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 4)

  return lines
}

function extractDiagramPreviewLabels(snapshot) {
  const content = snapshot?.content || {}
  const nodes = Array.isArray(content.nodes) ? content.nodes : []
  const textBlocks = Array.isArray(content.textBlocks) ? content.textBlocks : []
  const labels = [
    ...nodes.map(node => formatPreviewLabel(node.text || '', 10)),
    ...textBlocks.map(block => formatPreviewLabel(block.text || '', 10))
  ].filter(Boolean)

  return [...new Set(labels)].slice(0, 3)
}

function formatPreviewLabel(rawText, maxLength = 9) {
  const text = String(rawText || '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!text) {
    return ''
  }

  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text
}

function buildDiagramPreview(snapshot, mode) {
  const content = snapshot?.content || {}
  const allNodes = Array.isArray(content.nodes) ? content.nodes : []
  const nodes = allNodes.slice(0, 8)
  const edges = Array.isArray(content.edges) ? content.edges.slice(0, 12) : []
  const visibleLayers = new Set((content.layers || [])
    .filter(layer => layer.visible !== false)
    .map(layer => layer.id))
  const textBlocks = getVisibleTextBlocks(
    Array.isArray(content.textBlocks) ? content.textBlocks : [],
    allNodes,
    [],
    visibleLayers,
    Math.max(320, Number(content.page?.width) || 1200)
  ).filter(hasMindNoteBlockContent).slice(0, 4)

  if (!nodes.length && !textBlocks.length) {
    return { kind: 'diagram', nodes: [], edges: [], textBlocks: [] }
  }

  const bounds = [...nodes, ...textBlocks].reduce((result, item) => ({
    minX: Math.min(result.minX, Number(item.x) || 0),
    minY: Math.min(result.minY, Number(item.y) || 0),
    maxX: Math.max(result.maxX, (Number(item.x) || 0) + (Number(item.width) || 0)),
    maxY: Math.max(result.maxY, (Number(item.y) || 0) + (Number(item.height) || 0))
  }), {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY
  })

  const sourceWidth = Math.max(1, bounds.maxX - bounds.minX)
  const sourceHeight = Math.max(1, bounds.maxY - bounds.minY)
  const scale = Math.min(180 / sourceWidth, 104 / sourceHeight)
  const offsetX = 20
  const offsetY = 22
  const nodeMap = new Map()
  const previewNodes = nodes.map(node => {
    const width = Math.max(16, (Number(node.width) || 160) * scale)
    const height = Math.max(10, (Number(node.height) || 64) * scale)
    const x = offsetX + ((Number(node.x) || 0) - bounds.minX) * scale
    const y = offsetY + ((Number(node.y) || 0) - bounds.minY) * scale
    const label = formatPreviewLabel(node.text || '', mode === 'flowchart' ? 10 : 8)
    const previewNode = {
      key: node.id,
      x,
      y,
      width,
      height,
      radius: mode === 'flowchart' ? 8 : 14,
      shape: mode === 'flowchart' && node.kind === 'decision' ? 'diamond' : 'rect',
      path: `M ${x + width / 2} ${y} L ${x + width} ${y + height / 2} L ${x + width / 2} ${y + height} L ${x} ${y + height / 2} Z`,
      label,
      textX: x + width / 2,
      textY: y + height / 2,
      fontSize: Math.max(8, Math.min(12.5, width / Math.max(label.length + 2, 5), height * 0.48))
    }
    nodeMap.set(node.id, previewNode)
    return previewNode
  })

  const previewEdges = edges.flatMap(edge => {
    const fromNode = nodeMap.get(edge.fromNodeId)
    const toNode = nodeMap.get(edge.toNodeId)
    if (!fromNode || !toNode) {
      return []
    }
    return [{
      key: edge.id,
      x1: fromNode.x + fromNode.width / 2,
      y1: fromNode.y + fromNode.height / 2,
      x2: toNode.x + toNode.width / 2,
      y2: toNode.y + toNode.height / 2
    }]
  })

  const previewTextBlocks = textBlocks.map(block => {
    const x = offsetX + ((Number(block.x) || 0) - bounds.minX) * scale
    const y = offsetY + ((Number(block.y) || 0) - bounds.minY) * scale
    const width = Math.max(12, (Number(block.width) || 260) * scale)
    const height = Math.max(9, (Number(block.height) || 96) * scale)
    const fontSize = Math.max(3.8, Math.min(6.4, width / 18))
    const lineHeight = fontSize + 2
    const maxChars = Math.max(4, Math.floor((width - 6) / Math.max(2.4, fontSize * 0.58)))
    const lines = String(block.text || '')
      .split(/\r?\n/)
      .map(line => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .slice(0, Math.max(1, Math.floor((height - 4) / lineHeight)))
      .map(line => formatPreviewLabel(line, maxChars))
    return {
      key: block.id,
      x,
      y,
      width,
      height,
      lines,
      fontSize,
      lineHeight,
      textX: x + 3,
      textY: y + 5
    }
  })

  return {
    kind: 'diagram',
    nodes: previewNodes,
    edges: previewEdges,
    textBlocks: previewTextBlocks
  }
}
</script>

<style scoped>
.app-shell {
  position: relative;
  min-height: 100vh;
  user-select: text;
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans);
}

.app-content {
  width: 100%;
  max-width: 1560px;
  margin: 0 auto;
  padding: 0 24px 24px;
}

.app-content.app-content-editor {
  max-width: none;
  padding: 0 12px 12px;
}

/* ---------- top bar ---------- */

.topbar {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 52px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--border-strong);
}

.brand {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: default;
}

.brand-clickable {
  cursor: pointer;
}

.brand-clickable:hover .brand-name {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.brand-mark {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  background: var(--foreground);
  color: var(--background);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
}

.brand-name {
  font-size: 13px;
  font-weight: 650;
  letter-spacing: 0.015em;
}

.topbar-copy,
.eyebrow {
  display: none;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.topbar-create-button {
  height: 30px;
  margin-left: 6px;
  padding: 0 14px;
  font-size: 12.5px;
}

.workspace-search-bar {
  display: flex;
  flex: 1 1 260px;
  align-items: center;
  gap: 5px;
  min-width: 220px;
  max-width: 470px;
}

.workspace-search-input {
  flex: 1;
  min-width: 0;
  height: 28px;
  padding: 0 9px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--card);
  color: var(--foreground);
  font-size: 11.5px;
}

.workspace-search-input:focus,
.workspace-mode-filter:focus {
  border-color: var(--ring);
  outline: none;
  box-shadow: 0 0 0 3px var(--ring-soft);
}

.workspace-mode-filter {
  flex: none;
  width: 108px;
  height: 28px;
  padding: 0 22px 0 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--card);
  color: var(--foreground);
  font-family: inherit;
  font-size: 11px;
  cursor: pointer;
}

.workspace-search-bar > button {
  flex: none;
  height: 28px;
  padding: 0 9px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--card);
  color: var(--foreground);
  font-size: 11px;
}

.workspace-search-bar > button:hover:not(:disabled) {
  border-color: var(--border-strong);
  background: var(--muted);
}

.workspace-search-bar > button:disabled {
  opacity: 0.4;
  cursor: default;
}

.workspace-view-switch {
  display: inline-flex;
  align-items: center;
  padding: 2px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--muted);
}

.workspace-view-switch button {
  height: 24px;
  padding: 0 10px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--muted-foreground);
  font-size: 11px;
}

.workspace-view-switch button.active {
  background: var(--card);
  color: var(--foreground);
  box-shadow: var(--shadow-sm);
}

.workspace-batch-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: 4px;
  color: var(--muted-foreground);
  font-family: var(--font-mono);
  font-size: 10.5px;
}

.workspace-batch-bar button {
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--card);
  color: var(--foreground);
  font-size: 11.5px;
}

.workspace-batch-bar .workspace-batch-delete {
  border-color: color-mix(in srgb, var(--destructive) 45%, var(--border));
  color: var(--destructive);
}

.workspace-batch-bar .workspace-batch-delete:disabled {
  opacity: 0.45;
  cursor: default;
}

.workspace-batch-bar .workspace-batch-cancel {
  border-color: transparent;
  background: transparent;
  color: var(--muted-foreground);
}

.topbar-back {
  margin-left: -6px;
  margin-right: -2px;
  border-color: transparent;
  background: transparent;
}

.user-chip {
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--muted);
  color: var(--muted-foreground);
  font-size: 12px;
  line-height: 1.4;
}

/* ---------- buttons ---------- */

.ghost-button,
.primary-button,
.icon-button,
.workspace-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--card);
  color: var(--foreground);
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  line-height: 1;
  cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s, opacity 0.15s;
}

.ghost-button:hover,
.icon-button:hover {
  background: var(--muted);
}

.ghost-button.accent {
  border-color: var(--border);
  background: var(--card);
  color: var(--foreground);
}

.primary-button,
.workspace-primary {
  border-color: var(--primary);
  background: var(--primary);
  color: var(--primary-foreground);
}

.topbar .topbar-create-button {
  border-color: var(--foreground);
  background: transparent;
  color: var(--foreground);
  font-weight: 600;
}

.topbar .topbar-create-button:hover {
  border-color: var(--foreground);
  background: var(--foreground);
  color: var(--background);
  opacity: 1;
}

.topbar-create-plus {
  color: var(--accent);
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
}

.primary-button:hover,
.workspace-primary:hover {
  opacity: 0.88;
}

.icon-button {
  width: 32px;
  padding: 0;
  color: var(--foreground);
}

.icon-button svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.ghost-button:disabled,
.primary-button:disabled,
.workspace-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ---------- layout ---------- */

.workspace-shell {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: calc(100dvh - 92px);
  min-height: 0;
}

.workspace-message {
  margin: 0;
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--muted);
  color: var(--muted-foreground);
  font-size: 12.5px;
}

.workspace-browser {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  padding: 0;
  border: 0;
  background: transparent;
}

.workspace-browser-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 12px;
  margin-bottom: 20px;
  border-bottom: 1px solid var(--border);
}

.workspace-browser-copy h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.workspace-browser-actions {
  display: flex;
  gap: 8px;
}

.workspace-browser-state {
  padding: 32px 0;
  color: var(--muted-foreground);
  font-size: 13px;
  text-align: center;
}

/* ---------- document gallery ---------- */

.workspace-gallery {
  display: grid;
  flex: 1;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  align-content: start;
  gap: 12px;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--border-strong) transparent;
}

.workspace-card {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--border);
  border-left: 3px solid var(--mode-color, var(--border-strong));
  border-radius: var(--radius);
  background: var(--card);
  transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
}

.workspace-card.mode-flowchart {
  --mode-color: var(--mode-flow);
}

.workspace-card.mode-mindmap {
  --mode-color: var(--mode-mind);
}

.workspace-card.mode-markdown {
  --mode-color: var(--mode-markdown);
}

.workspace-card.mode-mind-note {
  --mode-color: var(--mode-note);
}

.workspace-card:hover {
  border-color: var(--mode-color, var(--border-strong));
  box-shadow: 3px 3px 0 var(--muted);
  transform: translateY(-1px);
}

.workspace-card.selected {
  border-color: var(--foreground);
  box-shadow: inset 0 0 0 1px var(--foreground), 3px 3px 0 var(--muted);
}

.workspace-card-selected-check {
  position: absolute;
  top: 7px;
  left: 8px;
  z-index: 7;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: var(--foreground);
  color: var(--background);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  box-shadow: 0 0 0 2px var(--card);
  cursor: pointer;
}

.workspace-card-selected-check:hover {
  background: var(--destructive);
}

.workspace-card.selected .workspace-card-badges {
  left: 34px;
}

.workspace-list-header {
  display: grid;
  flex: none;
  grid-template-columns: 64px minmax(140px, 1.25fr) 72px minmax(180px, 2fr) 52px;
  align-items: center;
  gap: 12px;
  height: 30px;
  margin-bottom: 4px;
  padding: 0 52px 0 41px;
  border-bottom: 1px solid var(--border);
  color: var(--muted-foreground);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.workspace-list-header button {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  gap: 4px;
  min-width: 0;
  padding: 3px 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  letter-spacing: inherit;
  text-align: left;
  text-transform: inherit;
  cursor: pointer;
}

.workspace-list-header button:hover,
.workspace-list-header button.active {
  color: var(--foreground);
}

.workspace-sort-indicator {
  opacity: 0.55;
  font-size: 9px;
  letter-spacing: 0;
}

.workspace-list-header button.active .workspace-sort-indicator {
  opacity: 1;
}

.workspace-gallery.layout-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.workspace-gallery.layout-list .workspace-card {
  border-left-width: 3px;
}

.workspace-list-row {
  display: grid;
  grid-template-columns: 64px minmax(140px, 1.25fr) 72px minmax(180px, 2fr) 52px;
  align-items: center;
  gap: 12px;
  min-height: 48px;
  padding: 7px 52px 7px 38px;
  text-align: left;
}

.workspace-list-index {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.workspace-list-sequence {
  color: var(--muted-foreground);
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.03em;
}

.workspace-list-mode-dot {
  flex: none;
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: var(--mode-color, var(--border-strong));
}

.workspace-list-title,
.workspace-list-mode,
.workspace-list-summary,
.workspace-list-pages {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workspace-list-title {
  font-family: var(--font-serif);
  font-size: 13px;
  font-weight: 600;
}

.workspace-list-mode {
  color: var(--mode-color, var(--muted-foreground));
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.workspace-list-summary {
  color: var(--muted-foreground);
  font-size: 11px;
}

.workspace-list-pages {
  color: var(--muted-foreground);
  font-family: var(--font-mono);
  font-size: 10px;
  text-align: right;
}

.workspace-gallery.layout-list .workspace-card-menu-trigger {
  top: 50%;
  transform: translateY(-50%);
}

.workspace-gallery.layout-list .workspace-card-selected-check {
  top: 50%;
  transform: translateY(-50%);
}

.workspace-pagination {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: flex-end;
  gap: 14px;
  min-height: 34px;
  padding-top: 10px;
}

.workspace-page-size {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--muted-foreground);
  font-family: var(--font-mono);
  font-size: 10.5px;
  white-space: nowrap;
}

.workspace-page-size select {
  height: 26px;
  min-width: 66px;
  padding: 0 22px 0 7px;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--card);
  color: var(--foreground);
  font-family: var(--font-mono);
  font-size: 10.5px;
  cursor: pointer;
}

.workspace-page-size select:focus {
  border-color: var(--ring);
  outline: none;
  box-shadow: var(--ring-soft);
}

.workspace-pagination-summary {
  margin-left: auto;
  color: var(--muted-foreground);
  font-family: var(--font-mono);
  font-size: 10.5px;
  letter-spacing: 0.02em;
}

.workspace-pagination-actions {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.workspace-pagination-actions button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 26px;
  height: 26px;
  padding: 0 7px;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--card);
  color: var(--foreground);
  font-family: var(--font-mono);
  font-size: 10.5px;
  cursor: pointer;
}

.workspace-pagination-actions button:hover:not(:disabled),
.workspace-pagination-actions button.active {
  border-color: var(--foreground);
  background: var(--foreground);
  color: var(--background);
}

.workspace-pagination-actions button:disabled {
  opacity: 0.35;
  cursor: default;
}

.workspace-pagination-ellipsis {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  color: var(--muted-foreground);
  font-family: var(--font-mono);
  font-size: 10.5px;
}

.workspace-gallery.marquee-active {
  cursor: crosshair;
  user-select: none;
}

.workspace-card-marquee {
  position: fixed;
  z-index: 150;
  border: 1px solid var(--ring);
  border-radius: 4px;
  background: color-mix(in srgb, var(--ring) 14%, transparent);
  pointer-events: none;
}

.workspace-card-main {
  display: block;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.workspace-card-preview {
  position: relative;
  height: 140px;
  padding: 10px 12px;
  border-bottom: 0;
  background: color-mix(in srgb, var(--mode-color, var(--border-strong)) 5%, var(--muted));
  overflow: hidden;
}

.workspace-card-badges {
  position: absolute;
  top: 9px;
  left: 10px;
  right: 34px;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  z-index: 1;
}

.workspace-card-filename {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--foreground);
  font-family: var(--font-serif);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.01em;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.workspace-card-sequence {
  flex: none;
  padding: 2px 6px;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: var(--surface-raised);
  color: var(--muted-foreground);
  font-family: var(--font-mono);
  font-size: 9.5px;
  line-height: 1.5;
  letter-spacing: 0.04em;
}

.workspace-card-badge {
  padding: 2px 6px;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: var(--surface-raised);
  color: var(--muted-foreground);
  font-family: var(--font-mono);
  font-size: 9.5px;
  line-height: 1.5;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.workspace-card-badge.strong {
  color: var(--mode-color, var(--foreground));
  border-color: color-mix(in srgb, var(--mode-color, var(--border-strong)) 34%, var(--border));
  font-weight: 600;
}

.workspace-markdown-preview {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 30px;
}

.workspace-markdown-line {
  display: block;
  max-width: 100%;
  overflow: hidden;
  color: var(--muted-foreground);
  font-size: 10.5px;
  line-height: 1.4;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.workspace-markdown-line.heading {
  color: var(--foreground);
  font-family: var(--font-serif);
  font-size: 13px;
  font-weight: 600;
}

.workspace-diagram-preview {
  width: 100%;
  height: 100%;
}

.workspace-preview-edge {
  stroke: var(--border-strong);
  stroke-width: 1;
}

.workspace-preview-node {
  fill: var(--card);
  stroke: var(--border-strong);
  stroke-width: 1;
}

.workspace-preview-label {
  fill: var(--muted-foreground);
}

.workspace-preview-text-block rect {
  fill: var(--card);
  stroke: var(--border-strong);
  stroke-width: 0.7;
}

.workspace-preview-text-block text {
  fill: var(--muted-foreground);
  font-family: var(--font-sans);
}

.workspace-card-copy {
  padding: 10px 12px 11px;
}

.workspace-card-copy h4 {
  margin: 0;
  overflow: hidden;
  font-family: var(--font-serif);
  font-size: 14.5px;
  font-weight: 600;
  letter-spacing: -0.01em;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.workspace-card-copy p {
  margin: 2px 0 0;
  overflow: hidden;
  color: var(--muted-foreground);
  font-size: 11.5px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.workspace-card-page-switcher {
  position: absolute;
  left: 10px;
  bottom: 8px;
  z-index: 4;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: color-mix(in srgb, var(--card) 88%, transparent);
  box-shadow: 0 2px 8px rgb(9 9 11 / 0.08);
  backdrop-filter: blur(6px);
}

.workspace-card-page-switcher button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 4px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--muted-foreground);
  font-family: var(--font-mono);
  font-size: 9.5px;
  line-height: 1;
  cursor: pointer;
}

.workspace-card-page-switcher button:hover {
  background: var(--muted);
  color: var(--foreground);
}

.workspace-card-page-switcher button.active {
  background: var(--foreground);
  color: var(--background);
}

.workspace-card-menu-trigger {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s, background-color 0.15s;
}

.workspace-card:hover .workspace-card-menu-trigger,
.workspace-card.menu-open .workspace-card-menu-trigger {
  opacity: 1;
}

.workspace-card-menu-trigger:hover {
  border-color: var(--border);
  background: var(--card);
}

.workspace-card-menu-trigger span {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--muted-foreground);
}

.workspace-card-menu {
  position: absolute;
  top: 36px;
  right: 8px;
  z-index: 5;
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 112px;
  padding: 4px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--card);
  box-shadow: var(--shadow-lg);
}

.workspace-card-menu-item {
  padding: 6px 8px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--foreground);
  font-family: inherit;
  font-size: 12.5px;
  text-align: left;
  cursor: pointer;
}

.workspace-card-menu-item:hover {
  background: var(--muted);
}

.workspace-card-menu-item.danger {
  color: var(--destructive);
}

.workspace-card-menu-divider {
  height: 1px;
  margin: 4px 2px;
  background: var(--border);
}

.workspace-card-context-menu {
  position: fixed;
  z-index: 140;
  display: flex;
  flex-direction: column;
  min-width: 144px;
  padding: 5px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--card);
  box-shadow: 4px 4px 0 var(--muted);
}

.workspace-card-context-menu button {
  width: 100%;
  padding: 7px 9px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--foreground);
  font: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}

.workspace-card-context-menu button:hover {
  background: var(--muted);
}

.workspace-card-context-menu button.danger {
  color: var(--destructive);
}

.workspace-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 64px 24px;
  border: 1px dashed var(--border);
  border-radius: var(--radius);
  text-align: center;
}

.workspace-empty-art {
  display: none;
}

.workspace-empty h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
}

.workspace-empty p {
  margin: 0;
  color: var(--muted-foreground);
  font-size: 12.5px;
}

/* ---------- editor shell ---------- */

.workspace-editor-shell {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: calc(100dvh - 80px);
  min-height: 480px;
  min-width: 0;
}

.workspace-editor-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.workspace-editor-copy {
  min-width: 0;
  flex: 1;
}

.workspace-editor-copy h3 {
  margin: 0;
  overflow: hidden;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.workspace-editor-copy p {
  margin: 1px 0 0;
  color: var(--muted-foreground);
  font-size: 12px;
}

/* ---------- security panel ---------- */

.security-panel {
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--card);
}

.security-copy h3 {
  margin: 0 0 16px;
  font-size: 14px;
  font-weight: 600;
}

.security-copy p {
  margin: 0 0 16px;
  color: var(--muted-foreground);
  font-size: 12.5px;
}

.security-kicker {
  display: none;
}

.security-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 560px;
}

.security-grid {
  display: grid;
  grid-template-columns: 112px minmax(0, 1fr);
  align-items: center;
  gap: 10px 12px;
}

.field-label {
  display: flex;
  align-items: center;
  min-height: 34px;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--foreground);
}

.password-field {
  position: relative;
  min-width: 0;
}

.security-input {
  width: 100%;
  height: 34px;
  padding: 0 38px 0 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--background);
  color: var(--foreground);
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.security-input:focus {
  border-color: var(--ring);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ring) 24%, transparent);
}

.visibility-button {
  position: absolute;
  top: 50%;
  right: 3px;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--muted-foreground);
  cursor: pointer;
  transform: translateY(-50%);
}

.visibility-button:hover {
  background: var(--muted);
  color: var(--foreground);
}

.visibility-icon {
  width: 15px;
  height: 15px;
}

.visibility-icon path,
.visibility-icon circle {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.form-note {
  margin: 0;
  color: var(--muted-foreground);
  font-size: 12px;
}

.error-text {
  margin: 0;
  color: var(--destructive);
  font-size: 12.5px;
}

.success-text {
  margin: 0;
  color: var(--success);
  font-size: 12.5px;
}

.security-actions {
  display: flex;
  gap: 8px;
}

/* ---------- dialogs ---------- */

.workspace-dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 24px;
  overflow-y: auto;
  overscroll-behavior: contain;
  background: rgb(0 0 0 / 0.45);
}

.workspace-dialog {
  display: flex;
  flex-direction: column;
  width: min(520px, 100%);
  /* 视口很矮时不要再撑破屏幕：留出上下 24px 的内边距，内容在弹窗内部滚动 */
  max-height: calc(100vh - 48px);
  max-height: calc(100dvh - 48px);
  /* 弹窗比视口矮时自动垂直居中，比视口高时从顶部开始并随背景滚动 */
  margin: auto;
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--card);
  box-shadow: var(--shadow-lg);
}

.workspace-dialog-header {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.workspace-dialog-header.is-drag-handle {
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.workspace-dialog-header.is-drag-handle:active {
  cursor: grabbing;
}

.workspace-dialog-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.workspace-type-grid {
  display: grid;
  flex: 1 1 auto;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  min-height: 0;
  /* 弹窗内容超出可用高度时在这里滚动，标题栏和取消按钮始终可见 */
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-right: 2px;
  scrollbar-width: thin;
  scrollbar-color: var(--border-strong) transparent;
}

.workspace-type-grid::-webkit-scrollbar {
  width: 10px;
}

.workspace-type-grid::-webkit-scrollbar-track {
  background: transparent;
}

.workspace-type-grid::-webkit-scrollbar-thumb {
  border: 3px solid transparent;
  border-radius: 999px;
  background: var(--border-strong);
  background-clip: content-box;
}

.workspace-type-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--card);
  color: var(--foreground);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s;
}

.workspace-type-card:hover {
  border-color: var(--border-strong);
  background: var(--muted);
}

.workspace-type-card strong {
  font-size: 13px;
  font-weight: 500;
}

.workspace-type-card span {
  color: var(--muted-foreground);
  font-size: 12px;
  line-height: 1.5;
}

.workspace-type-icon {
  width: 32px;
  height: 32px;
  fill: none;
  stroke: var(--muted-foreground);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.workspace-type-card:hover .workspace-type-icon {
  stroke: var(--foreground);
}

.workspace-rename-field {
  display: grid;
  grid-template-columns: 68px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.workspace-rename-field span {
  font-size: 12.5px;
  font-weight: 500;
}

.workspace-rename-field input,
input,
textarea {
  user-select: text;
}

.workspace-rename-field input {
  width: 100%;
  height: 34px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--background);
  color: var(--foreground);
  font-size: 13px;
  outline: none;
}

.workspace-rename-field input:focus {
  border-color: var(--ring);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ring) 24%, transparent);
}

.workspace-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/* ---------- transitions ---------- */

.workspace-fade-enter-active,
.workspace-fade-leave-active {
  transition: opacity 0.15s ease;
}

.workspace-fade-enter-from,
.workspace-fade-leave-to {
  opacity: 0;
}

.topbar-plain {
  border-bottom: 0;
}

@media (max-width: 900px) {
  .workspace-gallery {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .workspace-gallery {
    grid-template-columns: 1fr;
  }

  .app-content {
    padding: 0 16px 48px;
  }

  .workspace-type-grid {
    grid-template-columns: 1fr;
  }
}

.workspace-dialog-group {
  grid-column: 1 / -1;
  margin: 4px 0 -2px;
  color: var(--muted-foreground);
  font-size: 10.5px;
  font-weight: 500;
  letter-spacing: 0.08em;
}

.workspace-type-desc {
  color: var(--muted-foreground);
  font-size: 11px;
  line-height: 1.4;
}

.language-button {
  min-width: 40px;
  padding: 0 10px;
  font-size: 12px;
}

.editor-loading {
  display: grid;
  place-items: center;
  min-height: 320px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--card);
  color: var(--muted-foreground);
  font-size: 13px;
}

/* ---------- 视觉打磨：工作区 ---------- */

.topbar {
  position: sticky;
  top: 0;
  z-index: 30;
  background: color-mix(in srgb, var(--background) 84%, transparent);
  backdrop-filter: saturate(140%) blur(12px);
}

.brand-mark {
  border-radius: 7px;
  box-shadow: 0 1px 2px rgb(9 9 11 / 0.24);
}

.workspace-browser-copy h3 {
  letter-spacing: -0.02em;
}

.workspace-card {
  border-radius: 14px;
  transition: transform var(--duration) var(--ease-out), box-shadow var(--duration) var(--ease-out), border-color var(--duration) var(--ease-out);
}

.workspace-card:hover {
  transform: translateY(-2px);
  border-color: var(--border-strong);
  box-shadow: var(--shadow-card);
}

.workspace-card:focus-within {
  border-color: var(--ring);
  box-shadow: var(--ring-soft);
}

.workspace-card-preview {
  background: linear-gradient(180deg, color-mix(in srgb, var(--foreground) 3%, var(--muted)), var(--muted) 70%);
}

.workspace-card-badge {
  border-radius: 999px;
  font-size: 10.5px;
}

.workspace-card-copy h4 {
  font-weight: 600;
  letter-spacing: -0.01em;
}

.workspace-browser-actions .workspace-primary,
.workspace-primary {
  border-radius: 9px;
  box-shadow: 0 1px 2px rgb(9 9 11 / 0.2);
}

</style>
