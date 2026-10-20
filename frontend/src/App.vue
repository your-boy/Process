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
                total: workspaceTotalElements
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
import { buildWorkspacePreview, describeWorkspaceDocument } from './editor/render/workspacePreview'
import { createDiagramApi } from './editor/services/diagramApi'
import {
  clearWorkspaceCache,
  cloneDocument,
  persistWorkspaceCache,
  persistWorkspaceFallback,
  readWorkspaceCache,
  readWorkspaceMeta,
  WORKSPACE_PERSIST_DELAY_MS
} from './editor/services/workspaceStorage'
import { useEditorState } from './editor/state/useEditorState'
import { useSessionState } from './editor/state/useSessionState'
import { locale, setLocale, t, toggleLocale } from './i18n'
import { createWorkspaceDocumentRepository } from './workspace/workspaceDocuments'

const WORKSPACE_PAGE_SIZE_KEY = 'diagram-editor:workspace-page-size'
const WORKSPACE_PAGE_SIZE_OPTIONS = [10, 20, 40, 60, 100]
const WORKSPACE_MAX_FETCH_SIZE = 250
const THEME_KEY = 'diagram-editor:theme'

function readWorkspacePageSizeSetting() {
  if (typeof window === 'undefined') {
    return 'auto'
  }
  try {
    const value = Number(window.localStorage.getItem(WORKSPACE_PAGE_SIZE_KEY))
    return WORKSPACE_PAGE_SIZE_OPTIONS.includes(value) ? value : 'auto'
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

function handlePageVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    flushWorkspacePersistence({ forceFallback: true })
  }
}

function handleBeforeUnload() {
  flushWorkspacePersistence({ forceFallback: true })
}

function handlePageHide() {
  flushWorkspacePersistence({ forceFallback: true })
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
  window.addEventListener('beforeunload', handleBeforeUnload)
  window.addEventListener('pagehide', handlePageHide)
  document.addEventListener('visibilitychange', handlePageVisibilityChange)
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
const workspaceRemoteTotal = ref(0)
const workspaceRemoteLoading = ref(false)
const workspaceKeysById = new Map()
const workspacePreviewCache = new Map()
const {
  normalizeWorkspaceDocuments,
  normalizeRemoteWorkspaceDocuments,
  mergeWorkspaceDocuments,
  resolveActiveDocumentKey,
  getWorkspaceCounter,
  modeLabel
} = createWorkspaceDocumentRepository({
  normalizeDocument,
  cloneDocument,
  translate: t,
  allocateKey: () => nextDocumentKey(),
  keysById: workspaceKeysById
})
let workspaceRequestSequence = 0
let workspaceRefreshTimer = null
let workspacePersistTimer = null
let pendingWorkspacePersistence = null
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
  flushWorkspacePersistence()
  clearWorkspaceMessageTimer()
  endCreateDialogDrag()
  window.removeEventListener('beforeunload', handleBeforeUnload)
  window.removeEventListener('pagehide', handlePageHide)
  document.removeEventListener('visibilitychange', handlePageVisibilityChange)
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
  const snapshot = item.snapshot
  const signature = [
    snapshot?.id || item.key,
    snapshot?.updatedAt || '',
    snapshot?.content?.meta?.revision ?? '',
    snapshot?.content?.sourceText?.length ?? 0,
    item.summaryOnly ? 'summary' : 'full'
  ].join(':')
  let cached = workspacePreviewCache.get(signature)
  if (!cached) {
    cached = {
      preview: buildWorkspacePreview(item),
      summary: describeWorkspaceDocument(item)
    }
    workspacePreviewCache.set(signature, cached)
    if (workspacePreviewCache.size > 300) {
      const oldest = workspacePreviewCache.keys().next().value
      if (oldest) {
        workspacePreviewCache.delete(oldest)
      }
    }
  }
  const preview = cached.preview
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
    previewPageCount: preview.pageCount || pages.length,
    summary: cached.summary
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

const unsavedWorkspaceDraftCount = computed(() => {
  const query = workspaceSearchQuery.value.trim().toLowerCase()
  return openDocuments.value.filter(item => {
    if (item.snapshot?.id) {
      return false
    }
    if (workspaceModeFilter.value !== 'all' && item.mode !== workspaceModeFilter.value) {
      return false
    }
    return !query || workspaceCardSearchText(item).includes(query)
  }).length
})

const workspaceTotalElements = computed(() => workspaceRemoteTotal.value + unsavedWorkspaceDraftCount.value)

const workspaceTotalPages = computed(() => Math.max(
  1,
  Math.ceil(workspaceTotalElements.value / workspacePageSize.value)
))

const workspaceCurrentPage = computed(() => Math.min(
  workspaceTotalPages.value,
  Math.max(1, workspacePage.value)
))

const pagedWorkspaceCards = computed(() => (
  sortedWorkspaceCards.value
    .filter(item => workspaceCurrentPage.value === 1 || Boolean(item.snapshot?.id))
    .slice(0, workspacePageSize.value)
))

const workspaceVisibleRange = computed(() => {
  if (!pagedWorkspaceCards.value.length) {
    return { start: 0, end: 0 }
  }
  const start = (workspaceCurrentPage.value - 1) * workspacePageSize.value + 1
  return {
    start,
    end: start + pagedWorkspaceCards.value.length - 1
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
    scheduleWorkspaceRefresh()
  } else if (workspacePage.value < 1) {
    workspacePage.value = 1
    scheduleWorkspaceRefresh()
  }
})

watch(workspacePageSize, () => {
  if (currentUser.value && workspaceView.value === 'home' && !isWorkspaceLoading.value) {
    scheduleWorkspaceRefresh({ resetPage: true })
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
  scheduleWorkspaceRefresh({ resetPage: true })
}

function applyWorkspaceModeFilter() {
  workspacePage.value = 1
  clearWorkspaceSelection()
  scheduleWorkspaceRefresh({ resetPage: true })
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
  clearWorkspaceSelection()
  scheduleWorkspaceRefresh({ resetPage: true })
}

function resetWorkspaceSearch() {
  workspaceSearchDraft.value = ''
  workspaceSearchQuery.value = ''
  workspaceModeFilter.value = 'all'
  workspacePage.value = 1
  clearWorkspaceSelection()
  scheduleWorkspaceRefresh({ resetPage: true })
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

  scheduleWorkspacePersistence({
    userId,
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
  workspacePage.value = 1
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
    scheduleWorkspaceRefresh()
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
  scheduleWorkspaceRefresh()
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
  scheduleWorkspaceRefresh({ resetPage: true })
}

function goToWorkspacePage(page) {
  if (typeof page !== 'number') {
    return
  }
  workspacePage.value = Math.min(workspaceTotalPages.value, Math.max(1, page))
  clearWorkspaceSelection()
  scheduleWorkspaceRefresh()
}

function setWorkspacePageSize(event) {
  const numericValue = Number(event?.target?.value)
  const nextValue = Number.isFinite(numericValue) && numericValue > 0
    ? Math.min(1000, Math.round(numericValue))
    : 'auto'
  workspacePageSizeSetting.value = nextValue
  workspacePage.value = 1
  clearWorkspaceSelection()
  try {
    window.localStorage.setItem(WORKSPACE_PAGE_SIZE_KEY, String(nextValue))
  } catch {
    // 本地存储不可用时只影响持久化，当前选择仍然生效
  }
  scheduleWorkspaceRefresh({ resetPage: true })
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
    scheduleWorkspaceRefresh()
    setWorkspaceMessage(t('workspace.batchDeleted', { count: deleted }))
  }
  if (failed.length) {
    setWorkspaceMessage(t('workspace.batchDeleteFailed', { count: failed.length }), { duration: 3600 })
  }
}

function workspaceServerSort() {
  const sort = workspaceSortKey.value || 'sequence'
  const direction = workspaceSortKey.value ? workspaceSortDirection.value : 'desc'
  return { sort, direction }
}

function scheduleWorkspaceRefresh({ resetPage = false } = {}) {
  if (resetPage) {
    workspacePage.value = 1
  }
  if (workspaceRefreshTimer) {
    window.clearTimeout(workspaceRefreshTimer)
  }
  workspaceRefreshTimer = window.setTimeout(() => {
    workspaceRefreshTimer = null
    void refreshWorkspacePage()
  }, 120)
}

async function refreshWorkspacePage(user = currentUser.value, explicitLocalDocuments = null) {
  if (!user?.token) {
    return
  }
  const requestId = ++workspaceRequestSequence
  workspaceRemoteLoading.value = true
  const sourceDocuments = explicitLocalDocuments
    ? normalizeWorkspaceDocuments(explicitLocalDocuments)
    : openDocuments.value
  sourceDocuments.forEach(item => {
    const documentId = String(item.snapshot?.id || '')
    if (documentId) {
      workspaceKeysById.set(documentId, item.key)
    }
  })
  const localDrafts = sourceDocuments.filter(item => !item.snapshot?.id)
  const pageIndex = Math.max(0, workspaceCurrentPage.value - 1)
  const pageSize = workspacePageSize.value
  const pageStart = pageIndex * pageSize
  const remoteStart = Math.max(0, pageStart - localDrafts.length)
  const remotePage = Math.floor(remoteStart / pageSize)
  const remoteSkip = remoteStart % pageSize
  const fetchSize = Math.min(WORKSPACE_MAX_FETCH_SIZE, pageSize + remoteSkip)
  const { sort, direction } = workspaceServerSort()
  try {
    const response = await api.pageDocuments(user.token, {
      page: remotePage,
      size: fetchSize,
      mode: workspaceModeFilter.value === 'all' ? '' : workspaceModeFilter.value,
      query: workspaceSearchQuery.value,
      sort,
      direction
    })
    if (requestId !== workspaceRequestSequence) {
      return
    }
    const items = Array.isArray(response?.items) ? response.items : []
    const remoteDocuments = normalizeRemoteWorkspaceDocuments(items, localDrafts)
    const remoteForPage = remoteDocuments
      .slice(remoteSkip, remoteSkip + pageSize)
      .slice(0, pageIndex === 0 ? Math.max(0, pageSize - localDrafts.length) : pageSize)
    openDocuments.value = mergeWorkspaceDocuments(localDrafts, remoteForPage)
    const visibleKeys = new Set(openDocuments.value.map(item => item.key))
    selectedWorkspaceKeys.value = selectedWorkspaceKeys.value.filter(key => visibleKeys.has(key))
    workspaceRemoteTotal.value = Number(response?.totalElements) || 0
    const totalPages = Math.max(
      1,
      Math.ceil((workspaceRemoteTotal.value + localDrafts.length) / pageSize)
    )
    if (workspacePage.value > totalPages) {
      workspacePage.value = totalPages
      scheduleWorkspaceRefresh()
    }
    clearWorkspaceMessage()
  } catch (error) {
    if (requestId !== workspaceRequestSequence) {
      return
    }
    if (!localDrafts.length) {
      openDocuments.value = []
    }
    setWorkspaceMessage(
      localDrafts.length
        ? t('workspace.restored')
        : (error.message || t('workspace.loadFailed')),
      { duration: localDrafts.length ? 2400 : 3600 }
    )
  } finally {
    if (requestId === workspaceRequestSequence) {
      workspaceRemoteLoading.value = false
    }
  }
}

function scheduleWorkspacePersistence(workspace) {
  pendingWorkspacePersistence = workspace
  if (workspacePersistTimer) {
    window.clearTimeout(workspacePersistTimer)
  }
  workspacePersistTimer = window.setTimeout(() => {
    workspacePersistTimer = null
    const pending = pendingWorkspacePersistence
    pendingWorkspacePersistence = null
    if (pending) {
      void persistWorkspaceNow(pending)
    }
  }, WORKSPACE_PERSIST_DELAY_MS)
}

function buildWorkspacePersistencePayload(workspace) {
  const normalizedDocuments = normalizeWorkspaceDocuments(workspace.openDocuments)
  if (!normalizedDocuments.length) {
    return null
  }
  return {
    activeDocumentKey: resolveActiveDocumentKey(normalizedDocuments, workspace.activeDocumentKey),
    documentCounter: Number(workspace.documentCounter) || getWorkspaceCounter(normalizedDocuments),
    openDocuments: normalizedDocuments
  }
}

function flushWorkspacePersistence({ forceFallback = false } = {}) {
  if (workspacePersistTimer) {
    window.clearTimeout(workspacePersistTimer)
    workspacePersistTimer = null
  }
  const pending = pendingWorkspacePersistence
  pendingWorkspacePersistence = null
  if (!pending) {
    return
  }
  if (forceFallback) {
    const payload = buildWorkspacePersistencePayload(pending)
    if (payload) {
      persistWorkspaceFallback(pending.userId, payload)
    }
  }
  void persistWorkspaceNow(pending)
}

async function persistWorkspaceNow(workspace) {
  const payload = buildWorkspacePersistencePayload(workspace)
  if (!payload) {
    await clearWorkspaceCache(workspace.userId)
    return
  }
  await persistWorkspaceCache(workspace.userId, payload, () => {
    setWorkspaceMessage(t('workspace.storageFull'), { duration: 4200 })
  })
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

  const workspaceMeta = readWorkspaceMeta(user?.userId)
  const workspaceCache = await readWorkspaceCache(user?.userId)
  const savedWorkspace = workspaceCache || workspaceMeta
  const localDocuments = normalizeWorkspaceDocuments(savedWorkspace?.openDocuments)
  documentCounter = Math.max(
    documentCounter,
    Number(savedWorkspace?.documentCounter) || 0,
    getWorkspaceCounter(localDocuments)
  )

  const unsavedLocalDocuments = localDocuments.filter(item => !item.snapshot?.id)
  openDocuments.value = unsavedLocalDocuments
  try {
    await refreshWorkspacePage(user, localDocuments)
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


</script>

<style scoped src="./styles/app.css"></style>
