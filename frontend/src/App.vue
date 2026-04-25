<template>
  <div class="app-shell">
    <div class="background-grid"></div>
    <div class="background-orb orb-a"></div>
    <div class="background-orb orb-b"></div>

    <main class="app-content">
      <header class="topbar">
        <div class="topbar-copy">
          <p class="eyebrow"></p>
        </div>
        <div v-if="currentUser" class="topbar-actions">
          <span class="user-chip">{{ currentUser.displayName }}</span>
          <button class="ghost-button accent" type="button" @click="toggleSecurityPanel">修改密码</button>
          <button class="ghost-button" type="button" @click="logout">退出登录</button>
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
        <p v-if="workspaceMessage" class="workspace-message">{{ workspaceMessage }}</p>

        <section v-if="isSecurityPanelOpen" class="security-panel">
          <div class="security-copy">
            <p class="security-kicker">账户安全</p>
            <h3>修改当前登录密码</h3>
            <p>
              修改时仍然不会提交明文密码。浏览器会先完成加密，再由后端验证旧密码、保存新哈希并刷新当前登录令牌。
            </p>
          </div>

          <form class="security-form" @submit.prevent="changePassword">
            <div class="security-grid">
              <label class="field-label" for="current-password">当前密码</label>
              <div class="password-field">
                <input
                  id="current-password"
                  v-model="passwordForm.currentPassword"
                  class="security-input"
                  :type="passwordVisibility.current ? 'text' : 'password'"
                  maxlength="64"
                  autocomplete="current-password"
                  placeholder="输入当前密码"
                />
                <button
                  type="button"
                  class="visibility-button"
                  data-testid="toggle-current-password"
                  :aria-label="passwordVisibility.current ? '隐藏当前密码' : '显示当前密码'"
                  @click="passwordVisibility.current = !passwordVisibility.current"
                >
                  <svg class="visibility-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M2.6 12C4.6 8.1 8 5.8 12 5.8S19.4 8.1 21.4 12C19.4 15.9 16 18.2 12 18.2S4.6 15.9 2.6 12Z"></path>
                    <circle cx="12" cy="12" r="3.2"></circle>
                    <path v-if="!passwordVisibility.current" d="M4 4 20 20"></path>
                  </svg>
                </button>
              </div>

              <label class="field-label" for="new-password">新密码</label>
              <div class="password-field">
                <input
                  id="new-password"
                  v-model="passwordForm.newPassword"
                  class="security-input"
                  :type="passwordVisibility.next ? 'text' : 'password'"
                  maxlength="64"
                  autocomplete="new-password"
                  placeholder="输入新密码"
                />
                <button
                  type="button"
                  class="visibility-button"
                  data-testid="toggle-new-password"
                  :aria-label="passwordVisibility.next ? '隐藏新密码' : '显示新密码'"
                  @click="passwordVisibility.next = !passwordVisibility.next"
                >
                  <svg class="visibility-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M2.6 12C4.6 8.1 8 5.8 12 5.8S19.4 8.1 21.4 12C19.4 15.9 16 18.2 12 18.2S4.6 15.9 2.6 12Z"></path>
                    <circle cx="12" cy="12" r="3.2"></circle>
                    <path v-if="!passwordVisibility.next" d="M4 4 20 20"></path>
                  </svg>
                </button>
              </div>

              <label class="field-label" for="confirm-password">确认新密码</label>
              <div class="password-field">
                <input
                  id="confirm-password"
                  v-model="passwordForm.confirmPassword"
                  class="security-input"
                  :type="passwordVisibility.confirm ? 'text' : 'password'"
                  maxlength="64"
                  autocomplete="new-password"
                  placeholder="再次输入新密码"
                />
                <button
                  type="button"
                  class="visibility-button"
                  data-testid="toggle-confirm-password"
                  :aria-label="passwordVisibility.confirm ? '隐藏确认密码' : '显示确认密码'"
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

            <p class="form-note">建议使用至少 6 位的新密码；提交成功后当前会话会自动刷新。</p>
            <p v-if="securityError" class="error-text">{{ securityError }}</p>
            <p v-if="securityMessage" class="success-text">{{ securityMessage }}</p>

            <div class="security-actions">
              <button class="primary-button" type="submit" :disabled="isChangingPassword">
                {{ isChangingPassword ? '更新中...' : '更新密码' }}
              </button>
              <button class="ghost-button" type="button" :disabled="isChangingPassword" @click="closeSecurityPanel">收起面板</button>
            </div>
          </form>
        </section>

        <section
          v-if="workspaceView === 'home'"
          class="workspace-browser"
          @click="closeDocumentMenu"
        >
          <div class="workspace-browser-header">
            <div class="workspace-browser-copy">
              <h3>文件</h3>
            </div>

            <div class="workspace-browser-actions">
              <button
                type="button"
                class="workspace-primary"
                data-testid="workspace-create-button"
                @click.stop="openCreateDialog"
              >
                新建
              </button>
            </div>
          </div>

          <div v-if="isWorkspaceLoading" class="workspace-browser-state">
            同步中...
          </div>

          <div v-else-if="workspaceCards.length" class="workspace-gallery">
            <article
              v-for="item in workspaceCards"
              :key="item.key"
              :class="['workspace-card', { active: item.key === activeDocumentKey, 'menu-open': activeDocumentMenuKey === item.key }]"
              :data-testid="`workspace-card-${item.key}`"
            >
              <button
                type="button"
                class="workspace-card-main"
                :aria-label="item.title"
                @click="openDocument(item.key)"
              >
                <div :class="['workspace-card-preview', `mode-${item.mode}`]">
                  <div class="workspace-card-badges">
                    <span class="workspace-card-badge strong">{{ modeLabel(item.mode) }}</span>
                    <span class="workspace-card-badge">{{ item.snapshot.id ? '已保存' : '本地草稿' }}</span>
                  </div>

                  <div v-if="item.preview.kind === 'markdown'" class="workspace-markdown-preview">
                    <span
                      v-for="(line, index) in item.preview.lines"
                      :key="`${item.key}-line-${index}`"
                      :class="['workspace-markdown-line', { heading: index === 0 }]"
                    >{{ line }}</span>
                  </div>

                  <svg v-else class="workspace-diagram-preview" viewBox="0 0 220 150" aria-hidden="true">
                    <line
                      v-for="edge in item.preview.edges"
                      :key="edge.key"
                      :x1="edge.x1"
                      :y1="edge.y1"
                      :x2="edge.x2"
                      :y2="edge.y2"
                      class="workspace-preview-edge"
                    />

                    <template v-for="node in item.preview.nodes" :key="node.key">
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
                  </svg>
                </div>

                <div class="workspace-card-copy">
                  <h4>{{ item.title }}</h4>
                  <p>{{ item.summary }}</p>
                </div>
              </button>

              <button
                type="button"
                class="workspace-card-menu-trigger"
                aria-label="更多操作"
                @click.stop="toggleDocumentMenu(item.key)"
              >
                <span></span><span></span><span></span>
              </button>

              <div
                v-if="activeDocumentMenuKey === item.key"
                class="workspace-card-menu"
                @click.stop
              >
                <button type="button" class="workspace-card-menu-item" @click="startRenameDocument(item.key)">重命名</button>
                <button type="button" class="workspace-card-menu-item danger" @click="deleteDocument(item.key)">删除</button>
              </div>
            </article>
          </div>

          <div v-else class="workspace-empty">
            <div class="workspace-empty-art"></div>
            <h3>还没有文件</h3>
            <p>新建一个开始。</p>
            <button type="button" class="workspace-primary" @click.stop="openCreateDialog">新建</button>
          </div>
        </section>

        <section v-else class="workspace-editor-shell">
          <div class="workspace-editor-header">
            <button class="ghost-button" type="button" @click="returnToWorkspace">返回文件卡片</button>

            <div class="workspace-editor-copy">
              <h3>{{ activeWorkspaceDocument?.title || '未命名文档' }}</h3>
              <p v-if="activeWorkspaceDocument">{{ modeLabel(activeWorkspaceDocument.mode) }}</p>
            </div>

            <button class="ghost-button accent" type="button" @click="openCreateDialog">新建</button>
          </div>

          <Editor :editor-state="editorState" :current-user="currentUser" />
        </section>

        <transition name="workspace-fade">
          <div v-if="isCreateDialogOpen" class="workspace-dialog-backdrop" @click.self="closeCreateDialog">
            <section class="workspace-dialog">
              <div class="workspace-dialog-header">
                <div>
                  <h3>新建</h3>
                </div>
                <button type="button" class="ghost-button" @click="closeCreateDialog">取消</button>
              </div>

              <div class="workspace-type-grid" data-testid="create-document-dialog">
                <button
                  v-for="item in creationModes"
                  :key="item.mode"
                  type="button"
                  :aria-label="item.label"
                  class="workspace-type-card"
                  @click="createDocument(item.mode)"
                >
                  <svg class="workspace-type-icon" viewBox="0 0 76 76" aria-hidden="true">
                    <template v-if="item.mode === 'flowchart'">
                      <rect x="10" y="16" width="22" height="16" rx="6"></rect>
                      <path d="M46 16 L62 24 L46 32 L30 24 Z"></path>
                      <rect x="24" y="46" width="28" height="16" rx="8"></rect>
                      <line x1="32" y1="24" x2="46" y2="24"></line>
                      <line x1="46" y1="32" x2="38" y2="46"></line>
                    </template>
                    <template v-else-if="item.mode === 'mindmap'">
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
                  <span>{{ item.description }}</span>
                </button>
              </div>
            </section>
          </div>
        </transition>

        <transition name="workspace-fade">
          <div v-if="renamingDocumentKey" class="workspace-dialog-backdrop" @click.self="cancelRenameDocument">
            <form class="workspace-dialog rename-dialog" @submit.prevent="commitRenameDocument">
              <div class="workspace-dialog-header">
                <div>
                  <h3>重命名</h3>
                </div>
                <button type="button" class="ghost-button" @click="cancelRenameDocument">取消</button>
              </div>

              <label class="workspace-rename-field">
                <span>文件名</span>
                <input
                  ref="renamingInput"
                  v-model="renamingDocumentTitle"
                  type="text"
                  maxlength="100"
                  placeholder="输入新的文件名"
                />
              </label>

              <div class="workspace-dialog-actions">
                <button type="button" class="ghost-button" @click="cancelRenameDocument">取消</button>
                <button type="submit" class="primary-button">确认重命名</button>
              </div>
            </form>
          </div>
        </transition>
      </section>
    </main>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import Editor from './components/Editor.vue'
import LoginPanel from './components/LoginPanel.vue'
import { normalizeDocument } from './editor/model/document'
import { createDiagramApi } from './editor/services/diagramApi'
import { useEditorState } from './editor/state/useEditorState'
import { useSessionState } from './editor/state/useSessionState'

const WORKSPACE_KEY_PREFIX = 'diagram-editor:workspace:'

const api = createDiagramApi()
const sessionState = useSessionState()
const editorState = useEditorState({ api, sessionState })
const isLoggingIn = ref(false)
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
  clearWorkspaceMessageTimer()
})

const creationModes = [
  {
    mode: 'flowchart',
    label: '新建流程图',
    displayLabel: '流程图',
    description: '更适合步骤、判断、线型和多形状编排。'
  },
  {
    mode: 'mindmap',
    label: '新建思维导图',
    displayLabel: '思维导图',
    description: '适合层级梳理、分支延展与结构收拢。'
  },
  {
    mode: 'markdown',
    label: '新建 Markdown',
    displayLabel: 'Markdown',
    description: '支持富文本编辑、实时预览与源码同步。'
  },
  {
    mode: 'mind-note',
    label: '新建思维笔记',
    displayLabel: '思维笔记',
    description: '把节点结构和文本块沉淀为可导出的笔记。'
  }
]

const currentUser = computed(() => sessionState.currentUser.value)
const activeWorkspaceDocument = computed(() => openDocuments.value.find(item => item.key === activeDocumentKey.value) || null)
const workspaceCards = computed(() => openDocuments.value.map(item => ({
  ...item,
  preview: buildWorkspacePreview(item),
  summary: describeWorkspaceDocument(item)
})))

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

async function login(credentials) {
  const normalized = String(credentials?.username || '').trim()
  const password = String(credentials?.password || '')

  if (!normalized) {
    loginError.value = '请输入用户名。'
    return
  }

  if (!password) {
    loginError.value = '请输入密码。'
    return
  }

  isLoggingIn.value = true
  loginError.value = ''
  clearWorkspaceMessage()

  try {
    await hydrateAuthenticatedWorkspace(await api.login(normalized, password))
  } catch (error) {
    loginError.value = error.message || '登录失败，请稍后重试。'
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
    loginError.value = '请输入用户名。'
    return
  }

  if (!recoveryCode) {
    loginError.value = '请输入恢复口令。'
    return
  }

  if (!newPassword) {
    loginError.value = '请输入新密码。'
    return
  }

  if (newPassword !== confirmPassword) {
    loginError.value = '两次输入的新密码不一致。'
    return
  }

  isLoggingIn.value = true
  loginError.value = ''

  try {
    await hydrateAuthenticatedWorkspace(await api.forgotPassword(username, recoveryCode, newPassword))
    setWorkspaceMessage('密码已重置，已自动进入工作台。', { duration: 3200 })
  } catch (error) {
    loginError.value = error.message || '忘记密码处理失败，请稍后重试。'
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
    securityError.value = '请输入当前密码。'
    return
  }

  if (!passwordForm.newPassword) {
    securityError.value = '请输入新密码。'
    return
  }

  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    securityError.value = '两次输入的新密码不一致。'
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
    securityMessage.value = '密码已更新。'
    setWorkspaceMessage('密码已更新。')
  } catch (error) {
    securityError.value = error.message || '修改密码失败，请稍后重试。'
  } finally {
    isChangingPassword.value = false
  }
}

function logout() {
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
  activeDocumentKey.value = null
  workspaceView.value = 'home'
}

async function hydrateAuthenticatedWorkspace(user) {
  sessionState.setUser(user)
  await loadWorkspaceCatalog(user)
  securityError.value = ''
  securityMessage.value = ''
}

function toggleSecurityPanel() {
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
  editorState.startNewDocument({ mode })
  const key = nextDocumentKey()
  activeDocumentKey.value = key
  openDocuments.value.unshift({
    key,
    title: editorState.document.value.title,
    mode,
    snapshot: cloneDocument(editorState.document.value)
  })
  workspaceView.value = 'editor'
}

function openDocument(key) {
  closeDocumentMenu()
  cancelRenameDocument()
  const target = openDocuments.value.find(item => item.key === key)
  if (!target) {
    return
  }

  activeDocumentKey.value = key
  editorState.openDocumentSnapshot(target.snapshot)
  workspaceView.value = 'editor'
}

function startRenameDocument(key) {
  closeDocumentMenu()
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

  const currentTitle = String(target.title || target.snapshot?.title || '未命名文档').trim() || '未命名文档'
  const nextTitle = String(renamingDocumentTitle.value || '').trim() || currentTitle

  if (nextTitle === currentTitle) {
    cancelRenameDocument()
    return
  }

  try {
    if (target.snapshot?.id) {
      const payload = cloneDocument(target.snapshot)
      payload.title = nextTitle
      const savedDocument = normalizeDocument(await api.updateDocument(payload.id, payload, currentUser.value.token))
      target.title = savedDocument.title
      target.mode = savedDocument.mode
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

    setWorkspaceMessage('已重命名。')
  } catch (error) {
    setWorkspaceMessage(error.message || '重命名失败，请稍后重试。', { duration: 3600 })
  }

  cancelRenameDocument()
}

function cancelRenameDocument() {
  renamingDocumentKey.value = null
  renamingDocumentTitle.value = ''
}

async function deleteDocument(key) {
  closeDocumentMenu()
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
    setWorkspaceMessage('已删除。')
  } catch (error) {
    setWorkspaceMessage(error.message || '删除失败，请稍后重试。', { duration: 3600 })
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
}

function openCreateDialog() {
  closeDocumentMenu()
  cancelRenameDocument()
  isCreateDialogOpen.value = true
}

function closeCreateDialog() {
  isCreateDialogOpen.value = false
}

function toggleDocumentMenu(key) {
  activeDocumentMenuKey.value = activeDocumentMenuKey.value === key ? null : key
}

function closeDocumentMenu() {
  activeDocumentMenuKey.value = null
}

async function loadWorkspaceCatalog(user) {
  isWorkspaceLoading.value = true
  closeDocumentMenu()
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
        ? '已恢复本地文件。'
        : (error.message || '获取文件失败。'),
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
}

function readWorkspace(userId) {
  if (!userId || typeof window === 'undefined') {
    return null
  }

  const raw = window.localStorage.getItem(`${WORKSPACE_KEY_PREFIX}${userId}`)
  if (!raw) {
    return null
  }

  try {
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
      title: String(item.title || snapshot.title || '未命名文档').trim() || '未命名文档',
      mode: String(item.mode || snapshot.mode || 'flowchart').trim() || 'flowchart',
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
      snapshot
    }]
  })
}

function mergeWorkspaceDocuments(localDocuments = [], remoteDocuments = []) {
  const merged = [...localDocuments]
  const knownIds = new Set(merged.map(item => String(item.snapshot?.id || '')).filter(Boolean))

  remoteDocuments.forEach(item => {
    const snapshotId = String(item.snapshot?.id || '')
    if (!snapshotId || !knownIds.has(snapshotId)) {
      merged.push(item)
    }
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
    flowchart: '流程图',
    mindmap: '思维导图',
    markdown: 'Markdown',
    'mind-note': '思维笔记'
  }[mode] || '文档'
}

function describeWorkspaceDocument(item) {
  if (item.mode === 'markdown') {
    const lines = buildMarkdownPreviewLines(item.snapshot)
    return lines.slice(0, 2).join(' / ') || '未填写内容'
  }

  const labels = extractDiagramPreviewLabels(item.snapshot)
  return labels.join(' / ') || '未填写内容'
}

function buildWorkspacePreview(item) {
  if (item.mode === 'markdown') {
    return {
      kind: 'markdown',
      lines: buildMarkdownPreviewLines(item.snapshot)
    }
  }

  return buildDiagramPreview(item.snapshot, item.mode)
}

function buildMarkdownPreviewLines(snapshot) {
  const lines = String(snapshot?.content?.sourceText || '')
    .split(/\r?\n/)
    .map(line => line.replace(/^#+\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 4)

  return lines.length ? lines : ['未填写内容']
}

function extractDiagramPreviewLabels(snapshot) {
  const nodes = Array.isArray(snapshot?.content?.nodes) ? snapshot.content.nodes : []
  const labels = nodes
    .map(node => formatPreviewLabel(node.text || '', 10))
    .filter(Boolean)

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
  const nodes = Array.isArray(snapshot?.content?.nodes) ? snapshot.content.nodes.slice(0, 8) : []
  const edges = Array.isArray(snapshot?.content?.edges) ? snapshot.content.edges.slice(0, 12) : []
  if (!nodes.length) {
    return { kind: 'diagram', nodes: [], edges: [] }
  }

  const bounds = nodes.reduce((result, node) => ({
    minX: Math.min(result.minX, Number(node.x) || 0),
    minY: Math.min(result.minY, Number(node.y) || 0),
    maxX: Math.max(result.maxX, (Number(node.x) || 0) + (Number(node.width) || 0)),
    maxY: Math.max(result.maxY, (Number(node.y) || 0) + (Number(node.height) || 0))
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

  return {
    kind: 'diagram',
    nodes: previewNodes,
    edges: previewEdges
  }
}
</script>

<style scoped>
.app-shell {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  font-family: 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  background:
    radial-gradient(circle at 12% 12%, rgba(170, 118, 77, 0.18), transparent 24%),
    radial-gradient(circle at 86% 18%, rgba(63, 74, 88, 0.14), transparent 20%),
    radial-gradient(circle at 80% 88%, rgba(128, 98, 76, 0.12), transparent 22%),
    linear-gradient(180deg, #f6f0e6 0%, #efe7da 52%, #e7dece 100%);
}

.background-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(80, 66, 49, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(80, 66, 49, 0.04) 1px, transparent 1px),
    repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.16) 0 2px, transparent 2px 20px);
  background-size: 56px 56px, 56px 56px, auto;
  opacity: 0.72;
  mask-image: radial-gradient(circle at center, rgba(0, 0, 0, 0.92), transparent 92%);
}

.background-orb {
  position: absolute;
  border-radius: 999px;
  filter: blur(40px);
}

.orb-a {
  top: -140px;
  right: -70px;
  width: 340px;
  height: 340px;
  background: rgba(107, 83, 66, 0.16);
}

.orb-b {
  bottom: -120px;
  left: -80px;
  width: 320px;
  height: 320px;
  background: rgba(65, 73, 84, 0.12);
}

.app-content {
  position: relative;
  z-index: 1;
  width: min(1460px, calc(100% - 28px));
  margin: 0 auto;
  padding: 18px 0 32px;
}

.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
  margin-bottom: 14px;
  padding: 12px 16px;
  border: 1px solid rgba(100, 83, 66, 0.14);
  border-radius: 24px;
  background: rgba(250, 246, 239, 0.76);
  box-shadow: 0 18px 42px rgba(54, 42, 30, 0.08);
  backdrop-filter: blur(10px);
}

.eyebrow {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.32em;
  text-transform: uppercase;
  color: #6a5747;
}

.topbar-copy {
  display: flex;
  align-items: center;
  min-height: 36px;
}

.topbar-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.user-chip,
.ghost-button,
.workspace-action {
  border-radius: 999px;
}

.user-chip {
  padding: 10px 16px;
  background: rgba(255, 252, 247, 0.88);
  border: 1px solid rgba(100, 83, 66, 0.1);
  color: #0f172a;
  box-shadow: 0 10px 24px rgba(54, 42, 30, 0.06);
}

.ghost-button,
.workspace-action {
  border: 1px solid rgba(100, 83, 66, 0.12);
  padding: 10px 16px;
  background: rgba(255, 251, 245, 0.9);
  color: #0f172a;
  cursor: pointer;
  box-shadow: 0 10px 24px rgba(54, 42, 30, 0.06);
}

.ghost-button.accent {
  background: #2d3440;
  color: #f8f1e6;
  border-color: #2d3440;
}

.workspace-shell {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.workspace-message {
  margin: 0;
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  max-width: min(100%, 420px);
  padding: 10px 14px;
  border-radius: 16px;
  border: 1px solid rgba(108, 92, 74, 0.12);
  background: rgba(255, 250, 242, 0.84);
  color: #5d554b;
  box-shadow: 0 12px 28px rgba(54, 42, 30, 0.05);
}

.security-panel {
  display: grid;
  grid-template-columns: minmax(220px, 0.7fr) minmax(0, 1.3fr);
  gap: 18px;
  padding: 22px;
  border-radius: 28px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.88), rgba(239, 246, 255, 0.74));
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.08);
}

.security-copy h3,
.security-copy p {
  margin: 0;
}

.security-copy h3 {
  margin-top: 8px;
  color: #0f172a;
  font-size: 1.3rem;
}

.security-copy p {
  margin-top: 12px;
  color: #475569;
  line-height: 1.7;
}

.security-kicker {
  margin: 0;
  color: #2563eb;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.security-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.security-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.password-field {
  position: relative;
}

.field-label {
  color: #334155;
  font-size: 0.94rem;
}

.security-input {
  width: 100%;
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 16px;
  padding: 14px 48px 14px 16px;
  background: rgba(255, 255, 255, 0.9);
  font-size: 0.96rem;
}

.visibility-button {
  position: absolute;
  top: 50%;
  right: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: rgba(45, 52, 64, 0.08);
  color: #5b6473;
  cursor: pointer;
  transform: translateY(-50%);
  box-shadow: none;
}

.visibility-button:hover {
  transform: translateY(-50%);
  box-shadow: none;
  background: rgba(45, 52, 64, 0.14);
}

.visibility-icon {
  width: 18px;
  height: 18px;
}

.visibility-icon path,
.visibility-icon circle {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.form-note {
  margin: 0;
  color: #64748b;
  font-size: 0.88rem;
  line-height: 1.6;
}

.error-text,
.success-text {
  margin: 0;
}

.error-text {
  color: #b91c1c;
}

.success-text {
  color: #0f766e;
}

.security-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.primary-button {
  border: 1px solid #2d3440;
  border-radius: 16px;
  padding: 12px 18px;
  font-size: 0.96rem;
  font-weight: 700;
  color: #f8f1e6;
  background: #2d3440;
  cursor: pointer;
}

.primary-button:disabled {
  cursor: wait;
  opacity: 0.72;
}

.workspace-browser,
.workspace-editor-shell {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.workspace-browser {
  padding: 22px;
  border-radius: 30px;
  border: 1px solid rgba(108, 92, 74, 0.14);
  background: rgba(250, 246, 239, 0.82);
  box-shadow: 0 22px 54px rgba(54, 42, 30, 0.08);
}

.workspace-browser-header,
.workspace-editor-header,
.workspace-dialog-header,
.workspace-dialog-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 18px;
}

.workspace-browser-copy,
.workspace-editor-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.workspace-browser-copy h3,
.workspace-editor-copy h3,
.workspace-empty h3,
.workspace-dialog-header h3,
.workspace-card-copy h4 {
  margin: 0;
  color: #0f172a;
  font-family: 'Georgia', 'Times New Roman', 'Noto Serif SC', serif;
  letter-spacing: -0.02em;
}

.workspace-browser-copy p,
.workspace-editor-copy p,
.workspace-empty p,
.workspace-dialog-header p,
.workspace-card-copy p {
  margin: 0;
  color: #5d554b;
  line-height: 1.6;
}

.workspace-primary {
  border: 1px solid #2d3440;
  border-radius: 999px;
  padding: 12px 20px;
  background: #2d3440;
  color: #f8f1e6;
  box-shadow: 0 12px 24px rgba(54, 42, 30, 0.08);
  cursor: pointer;
}

.workspace-browser-state,
.workspace-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 320px;
  border-radius: 28px;
  border: 1px dashed rgba(108, 92, 74, 0.24);
  background: rgba(255, 251, 245, 0.76);
  text-align: center;
}

.workspace-empty-art {
  width: 120px;
  height: 120px;
  margin-bottom: 18px;
  border-radius: 36px;
  background:
    radial-gradient(circle at 30% 30%, rgba(167, 123, 91, 0.24), transparent 40%),
    linear-gradient(145deg, rgba(72, 82, 94, 0.12), rgba(255, 255, 255, 0.96));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.92);
}

.workspace-gallery {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 18px;
}

.workspace-card {
  position: relative;
  min-height: 280px;
  border-radius: 28px;
  background: rgba(255, 253, 248, 0.98);
  border: 1px solid rgba(108, 92, 74, 0.16);
  box-shadow: 0 18px 32px rgba(54, 42, 30, 0.08);
  overflow: hidden;
}

.workspace-card-main {
  width: 100%;
  height: 100%;
  border: 0;
  padding: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
  box-shadow: none;
}

.workspace-card:hover .workspace-card-main {
  transform: none;
  box-shadow: none;
}

.workspace-card.active {
  border-color: rgba(45, 52, 64, 0.3);
  box-shadow: 0 24px 42px rgba(45, 52, 64, 0.12);
}

.workspace-card-preview {
  position: relative;
  display: flex;
  align-items: stretch;
  justify-content: center;
  min-height: 184px;
  padding: 18px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0)),
    repeating-linear-gradient(135deg, rgba(113, 93, 72, 0.05) 0 2px, transparent 2px 18px),
    linear-gradient(145deg, #f3ece1, #ece3d5);
}

.workspace-card-preview.mode-markdown {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0)),
    repeating-linear-gradient(180deg, rgba(142, 119, 93, 0.07) 0 1px, transparent 1px 22px),
    linear-gradient(145deg, #f6ecdd, #f0e4d1);
}

.workspace-card-preview.mode-flowchart {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0)),
    repeating-linear-gradient(135deg, rgba(88, 100, 116, 0.05) 0 2px, transparent 2px 18px),
    linear-gradient(145deg, #e6ecef, #dde4e9);
}

.workspace-card-preview.mode-mindmap,
.workspace-card-preview.mode-mind-note {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0)),
    repeating-linear-gradient(135deg, rgba(94, 109, 90, 0.05) 0 2px, transparent 2px 18px),
    linear-gradient(145deg, #e5ebe3, #dbe4d7);
}

.workspace-card-badges {
  position: absolute;
  left: 16px;
  top: 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  z-index: 1;
}

.workspace-card-badge {
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(255, 250, 244, 0.84);
  border: 1px solid rgba(108, 92, 74, 0.1);
  color: #5d554b;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.workspace-card-badge.strong {
  color: #0f172a;
}

.workspace-card-menu-trigger {
  position: absolute;
  top: 16px;
  right: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  width: 38px;
  height: 38px;
  border: 0;
  border-radius: 14px;
  background: rgba(45, 52, 64, 0.86);
  color: #fff;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.18s ease, transform 0.18s ease;
  box-shadow: 0 18px 32px rgba(15, 23, 42, 0.22);
}

.workspace-card:hover .workspace-card-menu-trigger,
.workspace-card.menu-open .workspace-card-menu-trigger {
  opacity: 1;
  pointer-events: auto;
}

.workspace-card-menu-trigger span {
  width: 4px;
  height: 4px;
  border-radius: 999px;
  background: currentColor;
}

.workspace-card-menu {
  position: absolute;
  top: 60px;
  right: 16px;
  display: grid;
  gap: 8px;
  width: 132px;
  padding: 10px;
  border-radius: 18px;
  background: rgba(255, 251, 245, 0.96);
  border: 1px solid rgba(108, 92, 74, 0.14);
  box-shadow: 0 20px 36px rgba(54, 42, 30, 0.12);
  z-index: 2;
}

.workspace-card-menu-item {
  border: 0;
  border-radius: 12px;
  padding: 9px 12px;
  background: rgba(245, 239, 231, 0.96);
  color: #0f172a;
  text-align: left;
  cursor: pointer;
}

.workspace-card-menu-item.danger {
  color: #b91c1c;
  background: rgba(254, 242, 242, 0.96);
}

.workspace-card-copy {
  padding: 18px 18px 20px;
}

.workspace-card-copy p {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.workspace-markdown-preview {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  padding-top: 38px;
}

.workspace-markdown-line {
  display: block;
  width: 100%;
  min-height: 10px;
  padding: 8px 12px;
  border-radius: 14px;
  background: rgba(255, 252, 248, 0.82);
  color: #4f463d;
  font-size: 0.82rem;
  line-height: 1.4;
}

.workspace-markdown-line.heading {
  font-weight: 700;
  color: #0f172a;
}

.workspace-diagram-preview {
  width: 100%;
  height: 148px;
  margin-top: 24px;
}

.workspace-preview-edge {
  stroke: rgba(75, 87, 101, 0.56);
  stroke-width: 3;
  stroke-linecap: round;
}

.workspace-preview-node {
  fill: rgba(255, 251, 245, 0.94);
  stroke: rgba(75, 87, 101, 0.36);
  stroke-width: 2.2;
}

.workspace-preview-label {
  fill: #1f2937;
  font-weight: 700;
  font-family: 'Georgia', 'Times New Roman', 'Noto Serif SC', serif;
  letter-spacing: 0.01em;
  pointer-events: none;
}

.workspace-editor-header {
  padding: 0 4px;
}

.workspace-dialog-backdrop {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(36, 30, 25, 0.2);
  backdrop-filter: blur(8px);
  z-index: 20;
}

.workspace-dialog {
  width: min(760px, calc(100vw - 32px));
  padding: 24px;
  border-radius: 30px;
  background: rgba(251, 247, 240, 0.98);
  border: 1px solid rgba(108, 92, 74, 0.12);
  box-shadow: 0 28px 72px rgba(54, 42, 30, 0.14);
}

.workspace-type-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-top: 20px;
}

.workspace-type-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  min-height: 204px;
  padding: 18px;
  border: 1px solid rgba(108, 92, 74, 0.14);
  border-radius: 24px;
  background: rgba(255, 251, 245, 0.98);
  color: #0f172a;
  cursor: pointer;
  box-shadow: 0 14px 28px rgba(54, 42, 30, 0.06);
}

.workspace-type-card strong {
  font-size: 1rem;
}

.workspace-type-card span {
  color: #5d554b;
  line-height: 1.5;
}

.workspace-type-icon {
  width: 76px;
  height: 76px;
  padding: 14px;
  border-radius: 22px;
  background: linear-gradient(145deg, rgba(82, 71, 60, 0.08), rgba(115, 94, 77, 0.14));
}

.workspace-type-icon * {
  fill: none;
  stroke: #0f172a;
  stroke-width: 4;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.rename-dialog {
  width: min(520px, calc(100vw - 32px));
}

.workspace-rename-field {
  display: grid;
  gap: 10px;
  margin-top: 20px;
  color: #334155;
}

.workspace-rename-field input {
  border: 1px solid rgba(108, 92, 74, 0.2);
  border-radius: 16px;
  padding: 14px 16px;
  background: rgba(255, 252, 247, 0.92);
  font-size: 0.96rem;
}

.workspace-fade-enter-active,
.workspace-fade-leave-active {
  transition: opacity 0.18s ease;
}

.workspace-fade-enter-from,
.workspace-fade-leave-to {
  opacity: 0;
}

@media (max-width: 900px) {
  .app-content {
    width: min(100%, calc(100% - 20px));
    padding-top: 18px;
  }

  .topbar {
    flex-direction: column;
    align-items: flex-start;
  }

  .security-panel {
    grid-template-columns: 1fr;
  }

  .workspace-browser,
  .workspace-dialog {
    padding: 18px;
  }

  .workspace-browser-header,
  .workspace-editor-header,
  .workspace-dialog-header,
  .workspace-dialog-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .workspace-type-grid {
    grid-template-columns: 1fr;
  }
}
</style>
