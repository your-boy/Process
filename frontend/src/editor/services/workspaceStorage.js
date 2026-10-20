import { del as deleteIndexedDb, get as readIndexedDb, set as writeIndexedDb } from 'idb-keyval'

export const WORKSPACE_META_KEY_PREFIX = 'diagram-editor:workspace-meta:'
export const WORKSPACE_CACHE_KEY_PREFIX = 'diagram-editor:workspace-cache:'
export const WORKSPACE_DRAFT_FALLBACK_PREFIX = 'diagram-editor:workspace-draft-fallback:'
export const WORKSPACE_LEGACY_KEY_PREFIX = 'diagram-editor:workspace:'
export const WORKSPACE_PERSIST_DELAY_MS = 350

export function cloneDocument(document) {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(document)
    } catch {
      // Vue reactive proxies and non-cloneable browser handles fall back to JSON.
    }
  }
  return JSON.parse(JSON.stringify(document))
}

export function readWorkspaceMeta(userId) {
  if (!userId || typeof window === 'undefined') {
    return null
  }
  try {
    const raw = window.localStorage.getItem(`${WORKSPACE_META_KEY_PREFIX}${userId}`)
      || window.localStorage.getItem(`${WORKSPACE_LEGACY_KEY_PREFIX}${userId}`)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export async function readWorkspaceCache(userId) {
  if (!userId || typeof window === 'undefined') {
    return null
  }
  try {
    const cached = await readIndexedDb(`${WORKSPACE_CACHE_KEY_PREFIX}${userId}`)
    if (cached) {
      return cached
    }
  } catch {
    // Fall through to the synchronous draft fallback below.
  }
  return readWorkspaceFallback(userId)
}

export function persistWorkspaceFallback(userId, payload) {
  if (!userId || typeof window === 'undefined' || !payload) {
    return false
  }
  try {
    window.localStorage.setItem(
      `${WORKSPACE_DRAFT_FALLBACK_PREFIX}${userId}`,
      JSON.stringify({
        ...payload,
        savedAt: Date.now(),
        fallback: true
      })
    )
    return true
  } catch {
    return false
  }
}

export function readWorkspaceFallback(userId) {
  if (!userId || typeof window === 'undefined') {
    return null
  }
  try {
    const raw = window.localStorage.getItem(`${WORKSPACE_DRAFT_FALLBACK_PREFIX}${userId}`)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export async function persistWorkspaceCache(userId, payload, onError) {
  if (!userId || typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(`${WORKSPACE_META_KEY_PREFIX}${userId}`, JSON.stringify({
      activeDocumentKey: payload.activeDocumentKey,
      documentCounter: payload.documentCounter,
      documentCount: payload.openDocuments.length,
      savedAt: Date.now()
    }))
    window.localStorage.removeItem(`${WORKSPACE_LEGACY_KEY_PREFIX}${userId}`)
  } catch {
    // IndexedDB can still persist the full cache when localStorage is unavailable.
  }

  try {
    await writeIndexedDb(`${WORKSPACE_CACHE_KEY_PREFIX}${userId}`, {
      ...payload,
      savedAt: Date.now()
    })
    try {
      window.localStorage.removeItem(`${WORKSPACE_DRAFT_FALLBACK_PREFIX}${userId}`)
    } catch {
      // A stale fallback is harmless; IndexedDB is authoritative when available.
    }
  } catch (error) {
    if (!persistWorkspaceFallback(userId, payload)) {
      onError?.(error)
    }
  }
}

export async function clearWorkspaceCache(userId) {
  if (!userId || typeof window === 'undefined') {
    return
  }
  try {
    window.localStorage.removeItem(`${WORKSPACE_META_KEY_PREFIX}${userId}`)
    window.localStorage.removeItem(`${WORKSPACE_LEGACY_KEY_PREFIX}${userId}`)
    window.localStorage.removeItem(`${WORKSPACE_DRAFT_FALLBACK_PREFIX}${userId}`)
  } catch {
    // Ignore storage access failures during sign-out / cleanup.
  }
  try {
    await deleteIndexedDb(`${WORKSPACE_CACHE_KEY_PREFIX}${userId}`)
  } catch {
    // IndexedDB may be unavailable (private mode / browser policy).
  }
}
