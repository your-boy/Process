import { onBeforeUnmount, watch } from 'vue'
import { t } from '../../i18n'

const DRAFT_KEY_PREFIX = 'diagram-editor:draft:'
const AUTO_SAVE_DELAY_MS = 1500
const AUTO_SAVE_RETRY_BASE_MS = 3000
const AUTO_SAVE_RETRY_MAX_MS = 30000
const AUTO_SAVE_ELIGIBLE_STATES = new Set(['本地草稿已更新', '保存失败，已保留本地草稿'])

export function isAutoSaveEligibleSaveState(state) {
  return AUTO_SAVE_ELIGIBLE_STATES.has(state)
}

function cloneDraft(value) {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value)
    } catch {
      // Vue proxies can contain non-cloneable handles; fall back to JSON.
    }
  }
  return JSON.parse(JSON.stringify(value))
}

/**
 * Owns draft persistence and background autosave/retry scheduling.
 * Document mutation and API semantics stay in useEditorState.
 */
export function useDocumentAutoSave({
  documentRef,
  sessionState,
  saveDocument,
  saveState,
  syncState,
  commitPendingEdit
}) {
  let autosaveTimer = null
  let autosaveRetryDelay = 0
  let draftPersistTimer = null
  let pendingDraft = null

  function persistDraft(documentValue) {
    const userId = sessionState.currentUser.value?.userId
    if (!userId || !documentValue || typeof window === 'undefined') {
      return
    }
    try {
      const payload = cloneDraft(documentValue)
      payload.content.meta.autosavedAt = new Date().toISOString()
      window.localStorage.setItem(`${DRAFT_KEY_PREFIX}${userId}`, JSON.stringify(payload))
    } catch {
      saveState.value = t('editor.draftStorageFull')
    }
  }

  function readDraft(userId) {
    if (!userId || typeof window === 'undefined') {
      return null
    }
    try {
      const raw = window.localStorage.getItem(`${DRAFT_KEY_PREFIX}${userId}`)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }

  function flushPendingDraft() {
    if (!pendingDraft) {
      return
    }
    if (draftPersistTimer) {
      window.clearTimeout(draftPersistTimer)
      draftPersistTimer = null
    }
    const snapshot = pendingDraft
    pendingDraft = null
    persistDraft(snapshot)
  }

  function clearAutoSaveTimer() {
    if (!autosaveTimer) {
      return
    }
    window.clearTimeout(autosaveTimer)
    autosaveTimer = null
  }

  function scheduleAutoSave(documentValue) {
    clearAutoSaveTimer()
    if (!documentValue || !sessionState.currentUser.value || !AUTO_SAVE_ELIGIBLE_STATES.has(saveState.value)) {
      return
    }
    autosaveTimer = window.setTimeout(() => {
      autosaveTimer = null
      void saveDocument({ background: true })
    }, AUTO_SAVE_DELAY_MS)
  }

  // Backoff: 3s -> 6s -> 12s -> 24s -> 30s max.
  function scheduleAutoSaveRetry() {
    if (!sessionState.currentUser.value) {
      return
    }
    clearAutoSaveTimer()
    autosaveRetryDelay = autosaveRetryDelay
      ? Math.min(autosaveRetryDelay * 2, AUTO_SAVE_RETRY_MAX_MS)
      : AUTO_SAVE_RETRY_BASE_MS
    autosaveTimer = window.setTimeout(() => {
      autosaveTimer = null
      void saveDocument({ background: true })
    }, autosaveRetryDelay)
  }

  function retryAutoSaveNow() {
    if (syncState.value !== 'offline' || !sessionState.currentUser.value) {
      return
    }
    clearAutoSaveTimer()
    autosaveRetryDelay = 0
    void saveDocument({ background: true })
  }

  function resetAutoSaveBackoff() {
    autosaveRetryDelay = 0
  }

  function handleBrowserOnline() {
    retryAutoSaveNow()
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', flushPendingDraft)
    window.addEventListener('online', handleBrowserOnline)
  }

  onBeforeUnmount(() => {
    clearAutoSaveTimer()
    commitPendingEdit?.()
    flushPendingDraft()
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', flushPendingDraft)
      window.removeEventListener('online', handleBrowserOnline)
    }
  })

  watch(documentRef, documentValue => {
    pendingDraft = documentValue
    if (draftPersistTimer) {
      window.clearTimeout(draftPersistTimer)
    }
    draftPersistTimer = window.setTimeout(() => {
      draftPersistTimer = null
      const snapshot = pendingDraft
      pendingDraft = null
      persistDraft(snapshot)
    }, 250)
    scheduleAutoSave(documentValue)
  }, { deep: true })

  return {
    persistDraft,
    readDraft,
    flushPendingDraft,
    clearAutoSaveTimer,
    scheduleAutoSave,
    scheduleAutoSaveRetry,
    retryAutoSaveNow,
    resetAutoSaveBackoff
  }
}
