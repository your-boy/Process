import { computed, ref } from 'vue'

const SESSION_STORAGE_KEY = 'diagram-editor:session'
const OCCUPIED_STORAGE_KEY = 'diagram-editor:occupied-documents'

const currentUser = ref(readSessionUser())
const occupiedDocumentIds = ref(readOccupiedIds())

export function useSessionState() {
  function setUser(user) {
    currentUser.value = normalizeSessionUser(user)
    writeJson(SESSION_STORAGE_KEY, currentUser.value)
  }

  function clearUser() {
    currentUser.value = null
    occupiedDocumentIds.value = []
    writeJson(SESSION_STORAGE_KEY, null)
    writeJson(OCCUPIED_STORAGE_KEY, [])
  }

  function acquireDocument(documentId) {
    if (!documentId) {
      return true
    }
    const normalizedId = String(documentId)
    if (occupiedDocumentIds.value.includes(normalizedId)) {
      return false
    }
    occupiedDocumentIds.value = [...occupiedDocumentIds.value, normalizedId]
    writeJson(OCCUPIED_STORAGE_KEY, occupiedDocumentIds.value)
    return true
  }

  function releaseDocument(documentId) {
    if (!documentId) {
      return
    }
    const normalizedId = String(documentId)
    occupiedDocumentIds.value = occupiedDocumentIds.value.filter(id => id !== normalizedId)
    writeJson(OCCUPIED_STORAGE_KEY, occupiedDocumentIds.value)
  }

  function isDocumentOccupied(documentId) {
    return occupiedDocumentIds.value.includes(String(documentId))
  }

  return {
    currentUser: computed(() => currentUser.value),
    occupiedDocumentIds: computed(() => occupiedDocumentIds.value),
    setUser,
    clearUser,
    acquireDocument,
    releaseDocument,
    isDocumentOccupied
  }
}

function readSessionUser() {
  return normalizeSessionUser(readSessionJson(SESSION_STORAGE_KEY))
}

function readOccupiedIds() {
  const value = readSessionJson(OCCUPIED_STORAGE_KEY)
  return Array.isArray(value) ? value.map(String) : []
}

function readSessionJson(key) {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    const raw = window.sessionStorage.getItem(key)
    if (!raw) {
      return null
    }
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function writeJson(key, value) {
  if (typeof window === 'undefined') {
    return
  }
  try {
    const serialized = JSON.stringify(value)
    window.sessionStorage.setItem(key, serialized)
    window.localStorage.removeItem(key)
  } catch {
    // 存储空间不足或浏览器禁用存储时，当前会话仍可继续使用。
  }
}

function normalizeSessionUser(user) {
  if (!user || typeof user !== 'object') {
    return null
  }

  const userId = typeof user.userId === 'string' ? user.userId.trim() : ''
  const displayName = typeof user.displayName === 'string' ? user.displayName.trim() : ''
  const token = typeof user.token === 'string' ? user.token.trim() : ''

  if (!userId || !displayName || !token) {
    return null
  }

  return {
    userId,
    displayName,
    token
  }
}